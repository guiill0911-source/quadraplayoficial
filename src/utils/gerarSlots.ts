import type { DiaSemana, Funcionamento } from "../types/funcionamento";

export type Slot1h = {
  horaInicio: string; // "08:00"
  horaFim: string;    // "09:00"
};

// "08:30" -> 510
function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

// 510 -> "08:30"
function toHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Gera slots de 1 hora a partir do funcionamento em um dia da semana.
 * - Se o dia estiver inativo (modo porDia), retorna [].
 * - Só gera slots fechados certinhos: inicio + 60 <= fim.
 */
export function gerarSlots1h(func: Funcionamento, dia: DiaSemana): Slot1h[] {
  // Decide qual horário vale para o dia
  let abre = func.padrao.abre;
  let fecha = func.padrao.fecha;
  let ativo = true;

  if (func.modo === "porDia") {
    const diaCfg = func.porDia[dia];
    ativo = diaCfg.ativo;
    abre = diaCfg.abre;
    fecha = diaCfg.fecha;
  }

  if (!ativo) return [];

  const abreMin = toMin(abre);
  const fechaMin = toMin(fecha);

  // Se horário inválido, retorna vazio para não quebrar app
  if (!Number.isFinite(abreMin) || !Number.isFinite(fechaMin)) return [];
  if (fechaMin <= abreMin) return [];

  const slots: Slot1h[] = [];

  // arredonda inicio para hora cheia (se vier quebrado por qualquer motivo)
  // ex: 08:30 vira 09:00
  const startAligned = Math.ceil(abreMin / 60) * 60;

  for (let t = startAligned; t + 60 <= fechaMin; t += 60) {
    slots.push({
      horaInicio: toHHMM(t),
      horaFim: toHHMM(t + 60),
    });
  }

  return slots;
}
