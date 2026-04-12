import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  increment,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db, app } from "./firebase";
import { getFunctions, httpsCallable } from "firebase/functions";

// ✅ MOTOR FINANCEIRO (PASSO 1 já feito por você)
import { calcularDistribuicaoFinanceira, reaisParaCentavos } from "./financeiro";

/* =======================
   TRAVA DE SUSPENSÃO (PASSO 2)
======================= */

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatDateTimeBR(date: Date) {
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()} ${pad2(
    date.getHours()
  )}:${pad2(date.getMinutes())}`;
}

/**
 * ✅ Padroniza erro para o front tratar fácil
 * Formato:
 *  - QP_SUSPENSO|<millis>|<motivo>|<dd/MM/yyyy HH:mm>
 *  - QP_MULTA_PENDENTE|<centavos>
 */
function throwSuspenso(suspMs: number, motivo: string) {
  const ateStr = formatDateTimeBR(new Date(suspMs));
  throw new Error(`QP_SUSPENSO|${suspMs}|${motivo}|${ateStr}`);
}

function throwMulta(centavos: number) {
  throw new Error(`QP_MULTA_PENDENTE|${centavos}`);
}

/**
 * ✅ TRAVA REAL: usada dentro da transaction
 * - users/{uid}.suspensoAte (Timestamp)
 * - (opcional) users/{uid}.multaPendenteCentavos
 */
async function requireNotSuspendedTx(tx: any, uid: string): Promise<void> {
  const userRef = doc(db, "users", uid);
  const snap = await tx.get(userRef);
  const u = snap.exists() ? (snap.data() as any) : null;

  const suspensoAte = u?.suspensoAte ?? null;

  if (suspensoAte && typeof suspensoAte?.toMillis === "function") {
    const suspMs = suspensoAte.toMillis();
    const nowMs = Date.now();
    if (suspMs > nowMs) {
      const motivo = String(u?.suspensoMotivo ?? "suspenso");
      throwSuspenso(suspMs, motivo);
    }
  }

  // ✅ OPCIONAL (recomendado): bloqueia se houver multa pendente
  const multa = Number(u?.multaPendenteCentavos ?? 0);
  if (Number.isFinite(multa) && multa > 0) {
    throwMulta(multa);
  }
}

/**
 * (Mantive sua função antiga caso você ainda use em outros pontos de UX)
 * ✅ Bloqueia usuário suspenso (suspensoAte > agora)
 */
export async function requireNotSuspendedClient(uid: string): Promise<void> {
  const userRef = doc(db, "users", uid);
  const snap = await getDoc(userRef);
  const u = snap.exists() ? (snap.data() as any) : null;

  const suspensoAte = u?.suspensoAte ?? null;

  if (suspensoAte && typeof suspensoAte?.toMillis === "function") {
    const suspMs = suspensoAte.toMillis();
    const nowMs = Date.now();

    if (suspMs > nowMs) {
      const motivo = String(u?.suspensoMotivo ?? "suspenso");
      const ateStr = formatDateTimeBR(new Date(suspMs));
      throw new Error(`Conta suspensa até ${ateStr}. Motivo: ${motivo}`);
    }
  }
}

/* =======================
   TIPOS
======================= */

export type ReservaStatus = "confirmada" | "agendada" | "cancelada" | "finalizada";

export type PagamentoTipo = "presencial" | "online";
export type PagamentoStatus = "pendente" | "pago" | "isento";

export type ReservarHorarioArgs = {
  disponibilidadeId: string;
  nomeCliente: string;
  telefoneCliente: string;
  pagamentoTipo?: "presencial" | "pix"; // vindo do app (Quadra.tsx)
};

type ReservaDoc = {
  disponibilidadeId: string;
  quadraId: string;
  donoUid: string; // ownerId da quadra (dono)
  esporte: string;
  data: string;
  horaInicio: string;
  horaFim: string;
  valor: number;

  status: ReservaStatus;

  startAt?: any;
  endAt?: any;

  clienteUid: string;
  cliente: {
    nome: string;
    telefone: string;
  };

  // pagamentos
  pagamentoTipo: PagamentoTipo; // presencial | online
  pagamentoStatus: PagamentoStatus; // pendente | pago | isento
  pagoEm: any;
  valorPago: number | null;
  registradoPorUid: string | null;

  // resultado / avaliação
  naoCompareceu: boolean;
  naoCompareceuMarcadoEm: any;
  naoCompareceuMarcadoPorUid: string | null;

  avaliadaEm: any;

  // lifecycle
  createdAt: any;
  canceladaEm: any;
  canceladaPorUid?: string | null;

  finalizadaEm: any;
  finalizadaPorTipo: "auto" | "manual" | null;
  finalizadaPorUid: string | null;

  // (NOVOS campos financeiros serão gravados via updateDoc/tx.update)
};

function nowTs() {
  return Timestamp.now();
}

function hojeISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function hhmmToMinutes(h: string) {
  const m = /^(\d{2}):(\d{2})$/.exec(String(h ?? "").trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function combineDateTimeToTimestamp(dateISO: string, hhmm: string) {
  // dateISO: YYYY-MM-DD  hhmm: HH:MM
  const [y, mo, d] = dateISO.split("-").map(Number);
  const [hh, mm] = hhmm.split(":").map(Number);
  if (!y || !mo || !d) return null;
  const js = new Date(y, mo - 1, d, hh || 0, mm || 0, 0, 0);
  return Timestamp.fromDate(js);
}

function asTimestampMaybe(v: any): Timestamp | null {
  if (v && typeof v?.toDate === "function") return v as Timestamp;
  return null;
}

function calcularMinutosAteInicio(startAt: Timestamp | null): number {
  if (!startAt) return 0;
  const diffMs = startAt.toMillis() - Timestamp.now().toMillis();
  return Math.floor(diffMs / 60000); // pode ser negativo (se já passou)
}

async function lerComissaoPercentualQuadraTx(tx: any, quadraId: string): Promise<number> {
  const id = String(quadraId ?? "").trim();
  if (!id) return 5;

  const quadraRef = doc(db, "quadras", id);
  const snap = await tx.get(quadraRef);
  if (!snap.exists()) return 5;

  const data: any = snap.data();
  const raw = Number(data?.comissaoPercentual ?? 5);
  if (!Number.isFinite(raw)) return 5;
  return Math.max(0, Math.min(100, raw));
}

function montarUpdateFinanceiro(args: {
  valorReais: number;
  evento: "normal" | "cancelamento_cliente" | "cancelamento_dono" | "noshow";
  comissaoPercentual: number;
  minutosAntesDoInicio?: number;
}) {
  const dist = calcularDistribuicaoFinanceira({
    valorTotalCentavos: reaisParaCentavos(Number(args.valorReais ?? 0)),
    evento: args.evento,
    comissaoPercentual: args.comissaoPercentual,
    minutosAntesDoInicio: args.minutosAntesDoInicio,
  });

  return {
    politicaVersao: dist.politicaVersao,
    motivoPolitica: dist.motivoPolitica,
    comissaoPercentualAplicada: dist.comissaoPercentual,

    valorTotalCentavos: dist.valorTotalCentavos,
    valorPlataformaCentavos: dist.valorPlataformaCentavos,
    valorDonoCentavos: dist.valorDonoCentavos,
    valorClienteCentavos: dist.valorClienteCentavos,

    calculadoEm: serverTimestamp(),
  };
}

/**
 * ✅ Limite diário blindado (sem query dentro da transaction)
 * Doc contador:
 * users/{uid}/limitesReservasDia/{YYYY-MM-DD} => { ativas: number }
 */
function limiteDiaRef(uid: string, dataISO: string) {
  return doc(db, "users", uid, "limitesReservasDia", dataISO);
}

/* =======================
   RESERVAR
======================= */

export async function reservarHorario(args: ReservarHorarioArgs): Promise<{ reservaId: string }> {
  const user = getAuth().currentUser;
  if (!user?.uid) throw new Error("Você precisa estar logado para reservar.");

  const disponibilidadeId = String(args.disponibilidadeId ?? "").trim();
  const nomeCliente = String(args.nomeCliente ?? "").trim();
  const telefoneCliente = String(args.telefoneCliente ?? "").trim();

  const telDigits = telefoneCliente.replace(/\D/g, "");
  if (!telDigits || !(telDigits.length === 10 || telDigits.length === 11)) {
    throw new Error("Informe um telefone válido com DDD (10 ou 11 dígitos). Ex: (51) 991921169");
  }

  if (!disponibilidadeId) throw new Error("disponibilidadeId inválido.");
  if (!nomeCliente) throw new Error("Informe seu nome.");
  if (!telefoneCliente) throw new Error("Informe seu telefone para contato.");

  const pagamentoTipoApp = (args.pagamentoTipo ?? "presencial") as "presencial" | "pix";

  const functions = getFunctions(app, "us-central1");
  const createReservaSegura = httpsCallable<
    {
      disponibilidadeId: string;
      nomeCliente: string;
      telefoneCliente: string;
      pagamentoTipo: "presencial" | "pix";
    },
    { ok: boolean; reservaId: string }
  >(functions, "createReservaSegura");

  const resp = await createReservaSegura({
    disponibilidadeId,
    nomeCliente,
    telefoneCliente,
    pagamentoTipo: pagamentoTipoApp,
  });

  const reservaId = String(resp.data?.reservaId ?? "").trim();
  if (!reservaId) {
    throw new Error("Falha ao criar reserva.");
  }

  return { reservaId };
}

/* =======================
   CANCELAR
======================= */

export async function cancelarReserva(args: {
  reservaId: string;
  bypassClienteUidCheck?: boolean;
}): Promise<void> {
  const user = getAuth().currentUser;
  if (!user?.uid) throw new Error("Usuário não autenticado.");

  const reservaId = String(args.reservaId ?? "").trim();
  if (!reservaId) throw new Error("reservaId inválido.");

  const reservaRef = doc(db, "reservas", reservaId);

  let deveTentarReembolso = false;

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(reservaRef);
      if (!snap.exists()) throw new Error("Reserva não encontrada.");

      const r: any = snap.data();
      const status = String(r.status ?? "");

      if (status === "cancelada") return;
      if (status === "finalizada") throw new Error("Não é possível cancelar uma reserva finalizada.");

      const clienteUid = String(r.clienteUid ?? "");
      const isMesmoCliente = clienteUid && clienteUid === user.uid;

      if (!args.bypassClienteUidCheck) {
        if (!isMesmoCliente) {
          throw new Error("Você não pode cancelar uma reserva de outro usuário.");
        }
      }

      const quadraId = String(r.quadraId ?? "");
      const comissaoPercentual = await lerComissaoPercentualQuadraTx(tx, quadraId);

      const valorReais = Number(r.valorPago ?? r.valor ?? 0);

      const startAt =
        asTimestampMaybe(r.startAt) ??
        (r.data && r.horaInicio
          ? combineDateTimeToTimestamp(String(r.data), String(r.horaInicio))
          : null);

      const minutosAntes = calcularMinutosAteInicio(startAt);

      const evento = args.bypassClienteUidCheck ? "cancelamento_dono" : "cancelamento_cliente";

      const financeiroUpdate = montarUpdateFinanceiro({
        valorReais,
        evento,
        comissaoPercentual,
        minutosAntesDoInicio: evento === "cancelamento_cliente" ? minutosAntes : undefined,
      });

      const pagamentoTipo = String(r.pagamentoTipo ?? "");
      const valorClienteCentavos = Number(financeiroUpdate.valorClienteCentavos ?? 0);

      deveTentarReembolso =
        pagamentoTipo === "online" && valorClienteCentavos > 0;

      const disponibilidadeId = String(r.disponibilidadeId ?? "");
      if (disponibilidadeId) {
        const dispRef = doc(db, "disponibilidades", disponibilidadeId);
        tx.update(dispRef, {
          ativo: true,
          reservadoPorUid: null,
          reservadoEm: null,
        });
      }

      tx.update(reservaRef, {
        status: "cancelada",
        canceladaEm: serverTimestamp(),
        canceladaPorUid: user.uid,
        ...financeiroUpdate,
      });
    });
  } catch (e: any) {
    console.error("ERRO REAL cancelarReserva:", e);
    throw new Error(
      e?.message || e?.code || "Falha ao cancelar reserva."
    );
  }

  if (deveTentarReembolso) {
    try {
      const functions = getFunctions(app, "us-central1");
      const processarReembolsoReserva = httpsCallable(
        functions,
        "processarReembolsoReserva"
      );

      await processarReembolsoReserva({ reservaId });
    } catch (e) {
      console.error("Falha ao processar reembolso automático:", e);
    }
  }
}
/* =======================
   FINALIZAÇÃO
======================= */

export async function finalizarReservaComoDono(args: {
  reservaId: string;
  naoCompareceu: boolean;
}): Promise<void> {
  const user = getAuth().currentUser;
  if (!user?.uid) throw new Error("Usuário não autenticado.");

  const reservaId = String(args.reservaId ?? "").trim();
  if (!reservaId) throw new Error("reservaId inválido.");

  const reservaRef = doc(db, "reservas", reservaId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(reservaRef);
    if (!snap.exists()) throw new Error("Reserva não encontrada.");

    const r: any = snap.data();
    const status = String(r.status ?? "");

    if (status !== "confirmada" && status !== "agendada") {
      throw new Error("Só é possível finalizar/no-show reservas confirmadas.");
    }

    // primeiro todas as leituras
    const quadraId = String(r.quadraId ?? "");
    const comissaoPercentual = await lerComissaoPercentualQuadraTx(tx, quadraId);
    const valorReais = Number(r.valorPago ?? r.valor ?? 0);

    const evento = args.naoCompareceu ? "noshow" : "normal";
    const financeiroUpdate = montarUpdateFinanceiro({
      valorReais,
      evento,
      comissaoPercentual,
    });

    // depois as escritas
    tx.update(reservaRef, {
      status: "finalizada",
      finalizadaEm: serverTimestamp(),
      finalizadaPorTipo: "manual",
      finalizadaPorUid: user.uid,
      naoCompareceu: !!args.naoCompareceu,
      naoCompareceuMarcadoEm: args.naoCompareceu ? serverTimestamp() : null,
      naoCompareceuMarcadoPorUid: args.naoCompareceu ? user.uid : null,
      ...financeiroUpdate,
    });
  });
}

export async function setNaoCompareceuComoDono(args: {
  reservaId: string;
  naoCompareceu: boolean;
}): Promise<void> {
  const user = getAuth().currentUser;
  if (!user?.uid) throw new Error("Usuário não autenticado.");

  const reservaId = String(args.reservaId ?? "").trim();
  if (!reservaId) throw new Error("reservaId inválido.");

  const reservaRef = doc(db, "reservas", reservaId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(reservaRef);
    if (!snap.exists()) throw new Error("Reserva não encontrada.");

    const r: any = snap.data();
    if (String(r.status ?? "") !== "finalizada") {
      throw new Error("Só pode marcar no-show em reserva finalizada.");
    }

    // ✅ TODAS AS LEITURAS PRIMEIRO
    const quadraId = String(r.quadraId ?? "");
    const comissaoPercentual = await lerComissaoPercentualQuadraTx(tx, quadraId);
    const valorReais = Number(r.valorPago ?? r.valor ?? 0);

    const evento = args.naoCompareceu ? "noshow" : "normal";
    const financeiroUpdate = montarUpdateFinanceiro({
      valorReais,
      evento,
      comissaoPercentual,
    });

    // ✅ ESCRITAS DEPOIS
    tx.update(reservaRef, {
      naoCompareceu: !!args.naoCompareceu,
      naoCompareceuMarcadoEm: args.naoCompareceu ? serverTimestamp() : null,
      naoCompareceuMarcadoPorUid: args.naoCompareceu ? user.uid : null,
      ...financeiroUpdate,
    });
  });
}

/* =======================
   FINALIZAR VENCIDAS (AUTO)
======================= */

export async function finalizarReservasVencidasEmLote(
  reservas: Array<{ id: string; status?: string; data?: string; horaFim?: string; endAt?: any }>
): Promise<{ finalizadas: number }> {
  let finalizadas = 0;

  const agora = nowTs();

  for (const r of reservas) {
    try {
      const status = String(r.status ?? "");
      if (status !== "confirmada" && status !== "agendada") continue;

      let endAt: Timestamp | null = null;
      if (r.endAt && typeof r.endAt?.toDate === "function") {
        endAt = r.endAt as Timestamp;
      } else if (r.data && r.horaFim) {
        endAt = combineDateTimeToTimestamp(String(r.data), String(r.horaFim));
      }

      if (!endAt) continue;

      if (endAt.toMillis() <= agora.toMillis()) {
        const reservaRef = doc(db, "reservas", r.id);

        await runTransaction(db, async (tx) => {
          const snap = await tx.get(reservaRef);
          if (!snap.exists()) return;

          const cur: any = snap.data();
          const curStatus = String(cur.status ?? "");
          if (curStatus !== "confirmada" && curStatus !== "agendada") return;

          // ✅ decrementa limite diário ao auto-finalizar
          const dataReserva = String(cur.data ?? "");
          const clienteUid = String(cur.clienteUid ?? "");
          if (dataReserva && clienteUid) {
            const limRef = limiteDiaRef(clienteUid, dataReserva);
            tx.set(limRef, { ativas: increment(-1), updatedAt: serverTimestamp() }, { merge: true });
          }

          const quadraId = String(cur.quadraId ?? "");
          const comissaoPercentual = await lerComissaoPercentualQuadraTx(tx, quadraId);
          const valorReais = Number(cur.valorPago ?? cur.valor ?? 0);

          const financeiroUpdate = montarUpdateFinanceiro({
            valorReais,
            evento: "normal",
            comissaoPercentual,
          });

          tx.update(reservaRef, {
            status: "finalizada",
            finalizadaEm: serverTimestamp(),
            finalizadaPorTipo: "auto",
            finalizadaPorUid: null,
            ...financeiroUpdate,
          });
        });

        finalizadas++;
      }
    } catch {
      // ignora erro unitário
    }
  }

  return { finalizadas };
}

/* =======================
   PAGAMENTOS (DONO) - presencial
======================= */

export async function marcarReservaComoPagaComoDono(args: { reservaId: string }): Promise<void> {
  const user = getAuth().currentUser;
  if (!user?.uid) throw new Error("Usuário não autenticado.");

  const reservaId = String(args.reservaId ?? "").trim();
  if (!reservaId) throw new Error("reservaId inválido.");

  const reservaRef = doc(db, "reservas", reservaId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(reservaRef);
    if (!snap.exists()) throw new Error("Reserva não encontrada.");

    const r: any = snap.data();
    if (String(r.status ?? "") === "cancelada") throw new Error("Reserva cancelada não pode ser marcada como paga.");

    // se foi pago online, dono não pode marcar
    if (String(r.pagamentoTipo ?? "presencial") === "online") {
      throw new Error("Pagamento pelo aplicativo é automático.");
    }

    const valor = Number(r.valor ?? 0);

    // ✅ FINANCEIRO v1 ao marcar pago (normal)
    const quadraId = String(r.quadraId ?? "");
    const comissaoPercentual = await lerComissaoPercentualQuadraTx(tx, quadraId);

    const financeiroUpdate = montarUpdateFinanceiro({
      valorReais: valor,
      evento: "normal",
      comissaoPercentual,
    });

    tx.update(reservaRef, {
      pagamentoStatus: "pago",
      pagoEm: serverTimestamp(),
      valorPago: valor,
      registradoPorUid: user.uid,
      ...financeiroUpdate,
    });
  });
}

export async function desmarcarPagamentoComoDono(reservaId: string): Promise<void> {
  const user = getAuth().currentUser;
  if (!user?.uid) throw new Error("Usuário não autenticado.");

  const id = String(reservaId ?? "").trim();
  if (!id) throw new Error("reservaId inválido.");

  const reservaRef = doc(db, "reservas", id);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(reservaRef);
    if (!snap.exists()) throw new Error("Reserva não encontrada.");

    const r: any = snap.data();

    if (String(r.pagamentoTipo ?? "presencial") === "online") {
      throw new Error("Pagamento pelo aplicativo é automático.");
    }

    tx.update(reservaRef, {
      pagamentoStatus: "pendente",
      pagoEm: null,
      valorPago: null,
      registradoPorUid: null,
    });
  });
}

export async function cancelarReservaEBloquearHorario(args: { reservaId: string }): Promise<void> {
  const user = getAuth().currentUser;
  if (!user?.uid) throw new Error("Usuário não autenticado.");

  const reservaId = String(args.reservaId ?? "").trim();
  if (!reservaId) throw new Error("reservaId inválido.");

  const reservaRef = doc(db, "reservas", reservaId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(reservaRef);
    if (!snap.exists()) throw new Error("Reserva não encontrada.");

    const r: any = snap.data();
    const status = String(r.status ?? "");

    if (status === "cancelada") return;
    if (status === "finalizada") throw new Error("Não é possível cancelar uma reserva finalizada.");

    // primeiro todas as leituras
    const quadraId = String(r.quadraId ?? "");
    const comissaoPercentual = await lerComissaoPercentualQuadraTx(tx, quadraId);
    const valorReais = Number(r.valorPago ?? r.valor ?? 0);

    const financeiroUpdate = montarUpdateFinanceiro({
      valorReais,
      evento: "cancelamento_dono",
      comissaoPercentual,
    });

    const disponibilidadeId = String(r.disponibilidadeId ?? "");
    const dispRef = disponibilidadeId ? doc(db, "disponibilidades", disponibilidadeId) : null;

    // depois as escritas
    if (dispRef) {
      tx.update(dispRef, {
        ativo: false,
        bloqueado: true,
        bloqueadoPorUid: user.uid,
        reservadoPorUid: null,
        reservadoEm: null,
        liberadoEm: null,
      });
    }

    tx.update(reservaRef, {
      status: "cancelada",
      canceladaEm: serverTimestamp(),
      canceladaPorUid: user.uid,
      ...financeiroUpdate,
    });
  });

  try {
    const functions = getFunctions(app, "us-central1");
    const creditarSaldoCancelamentoDono = httpsCallable(
      functions,
      "creditarSaldoCancelamentoDono"
    );

    await creditarSaldoCancelamentoDono({
      reservaId,
    });
  } catch (e) {
    console.error("Falha ao creditar saldo por cancelamento do dono:", e);
}
}
/* =======================
   TESTE DE CRÉDITO INTERNO
======================= */

export async function testarAdicionarCredito(): Promise<void> {
  const user = getAuth().currentUser;
  if (!user?.uid) {
    throw new Error("Você precisa estar logado para testar crédito.");
  }

  const functions = getFunctions(app, "us-central1");
  const adicionarCredito = httpsCallable<
    { valorCentavos: number; tipo: "saldo" | "bonus" },
    { ok: boolean }
  >(functions, "adicionarCredito");

  await adicionarCredito({
    valorCentavos: 500, // R$ 5,00
    tipo: "saldo",
  });
  console.log("teste ok");
}