// src/services/financeiro.ts

export type EventoFinanceiro =
  | "normal"
  | "cancelamento_cliente"
  | "cancelamento_dono"
  | "noshow";

export type MotivoPolitica =
  | "normal"
  | "cancelamento_cliente_mais_1h"
  | "cancelamento_cliente_menos_1h"
  | "cancelamento_dono"
  | "noshow";

export type PoliticaVersao = "v1";

export type DistribuicaoFinanceira = {
  politicaVersao: PoliticaVersao;
  evento: EventoFinanceiro;
  motivoPolitica: MotivoPolitica;

  // Entradas
  valorTotalCentavos: number;
  comissaoPercentual: number; // ex: 5 => 5%

  // Saídas (centavos)
  valorClienteCentavos: number; // cliente fica com (reembolso/parte)
  valorDonoCentavos: number;
  valorPlataformaCentavos: number;

  // Metadados úteis
  percentualCliente: number; // 0..100
  percentualDono: number; // 0..100
  percentualPlataforma: number; // 0..100
};

type CalcularParams = {
  valorTotalCentavos: number; // sempre em centavos
  evento: EventoFinanceiro;
  minutosAntesDoInicio?: number; // usado só no cancelamento_cliente
  comissaoPercentual: number; // vem de quadras/{id}.comissaoPercentual (default 5)
};

function clampInt(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.round(n));
}

function clampPercent(p: number): number {
  if (!Number.isFinite(p)) return 0;
  return Math.max(0, Math.min(100, p));
}

function pctOf(valorCentavos: number, percent: number): number {
  // arredonda para o centavo mais próximo
  const p = clampPercent(percent);
  return Math.round((valorCentavos * p) / 100);
}

function ensureTotal(
  total: number,
  a: number,
  b: number,
  c: number
): { a: number; b: number; c: number } {
  // garante que a+b+c == total ajustando 1~2 centavos no último campo
  const soma = a + b + c;
  const diff = total - soma;
  return { a, b, c: c + diff };
}

/**
 * Política v1 (definida no checkpoint):
 * - cancelamento_cliente:
 *   - >= 1h: cliente 100%
 *   - < 1h: cliente 90%, e 10% dividido: 5% dono + 5% plataforma
 * - noshow:
 *   - cliente 20%
 *   - restante 80%: plataforma cobra comissaoPercentual em cima desse restante
 *   - dono recebe restante - comissão
 * - cancelamento_dono: cliente 100%
 * - normal:
 *   - (para já) plataforma cobra comissaoPercentual em cima do total, dono recebe resto, cliente 0
 */
export function calcularDistribuicaoFinanceira(
  params: CalcularParams
): DistribuicaoFinanceira {
  const valorTotalCentavos = clampInt(params.valorTotalCentavos);
  const comissaoPercentual = clampPercent(params.comissaoPercentual);

  const evento = params.evento;

  // defaults
  let valorClienteCentavos = 0;
  let valorDonoCentavos = 0;
  let valorPlataformaCentavos = 0;
  let motivoPolitica: MotivoPolitica = "normal";

  if (valorTotalCentavos === 0) {
    return {
      politicaVersao: "v1",
      evento,
      motivoPolitica: "normal",
      valorTotalCentavos: 0,
      comissaoPercentual,
      valorClienteCentavos: 0,
      valorDonoCentavos: 0,
      valorPlataformaCentavos: 0,
      percentualCliente: 0,
      percentualDono: 0,
      percentualPlataforma: 0,
    };
  }

  if (evento === "cancelamento_dono") {
    // cliente 100%
    motivoPolitica = "cancelamento_dono";
    valorClienteCentavos = valorTotalCentavos;
    valorDonoCentavos = 0;
    valorPlataformaCentavos = 0;

    const fixed = ensureTotal(
      valorTotalCentavos,
      valorClienteCentavos,
      valorDonoCentavos,
      valorPlataformaCentavos
    );
    valorClienteCentavos = fixed.a;
    valorDonoCentavos = fixed.b;
    valorPlataformaCentavos = fixed.c;
  }

  if (evento === "cancelamento_cliente") {
    const minutos = params.minutosAntesDoInicio ?? 0;

    if (minutos >= 60) {
      // reembolso 100%
      motivoPolitica = "cancelamento_cliente_mais_1h";
      valorClienteCentavos = valorTotalCentavos;
      valorDonoCentavos = 0;
      valorPlataformaCentavos = 0;
    } else {
      // reembolso 90% / 5% dono / 5% plataforma (fixo, não depende da comissão da quadra)
      motivoPolitica = "cancelamento_cliente_menos_1h";
      valorClienteCentavos = pctOf(valorTotalCentavos, 70);
      valorDonoCentavos = pctOf(valorTotalCentavos, 20);
      valorPlataformaCentavos = pctOf(valorTotalCentavos, 10);
      const fixed = ensureTotal(
        valorTotalCentavos,
        valorClienteCentavos,
        valorDonoCentavos,
        valorPlataformaCentavos
      );
      valorClienteCentavos = fixed.a;
      valorDonoCentavos = fixed.b;
      valorPlataformaCentavos = fixed.c;
    }
  }

 if (evento === "noshow") {
  // cliente 0%
  // dono 90%
  // plataforma 10%
  motivoPolitica = "noshow";

  valorClienteCentavos = 0;
  valorDonoCentavos = pctOf(valorTotalCentavos, 90);
  valorPlataformaCentavos = pctOf(valorTotalCentavos, 10);

  const fixed = ensureTotal(
    valorTotalCentavos,
    valorClienteCentavos,
    valorDonoCentavos,
    valorPlataformaCentavos
  );
  valorClienteCentavos = fixed.a;
  valorDonoCentavos = fixed.b;
  valorPlataformaCentavos = fixed.c;
}

  if (evento === "normal") {
    // Plataforma cobra comissão normal sobre o total (por enquanto)
    // Cliente não recebe nada (já usufruiu do horário).
    motivoPolitica = "normal";

    valorPlataformaCentavos = pctOf(valorTotalCentavos, comissaoPercentual);
    valorDonoCentavos = valorTotalCentavos - valorPlataformaCentavos;
    valorClienteCentavos = 0;

    const fixed = ensureTotal(
      valorTotalCentavos,
      valorClienteCentavos,
      valorDonoCentavos,
      valorPlataformaCentavos
    );
    valorClienteCentavos = fixed.a;
    valorDonoCentavos = fixed.b;
    valorPlataformaCentavos = fixed.c;
  }

  const percentualCliente = Math.round((valorClienteCentavos * 100) / valorTotalCentavos);
  const percentualDono = Math.round((valorDonoCentavos * 100) / valorTotalCentavos);
  const percentualPlataforma = 100 - percentualCliente - percentualDono;

  return {
    politicaVersao: "v1",
    evento,
    motivoPolitica,
    valorTotalCentavos,
    comissaoPercentual,
    valorClienteCentavos,
    valorDonoCentavos,
    valorPlataformaCentavos,
    percentualCliente: clampPercent(percentualCliente),
    percentualDono: clampPercent(percentualDono),
    percentualPlataforma: clampPercent(percentualPlataforma),
  };
}

// Helpers opcionais (pra UI / logs)
export function reaisParaCentavos(valorReais: number): number {
  if (!Number.isFinite(valorReais)) return 0;
  return Math.round(valorReais * 100);
}

export function centavosParaReais(valorCentavos: number): number {
  if (!Number.isFinite(valorCentavos)) return 0;
  return Number(valorCentavos) / 100;
}

export function formatBRLFromCentavos(centavos: number): string {
  const reais = centavosParaReais(centavos);
  return reais.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatBRLFromReais(valorReais: number): string {
  const v = Number(valorReais ?? 0);
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}