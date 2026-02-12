import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase";

type QuadraDoc = {
  esportes?: string[];
  valoresPorEsporte?: Record<string, number>;
  valorHora?: number | null;

  funcionamento?: any;

  // ✅ EXCEÇÕES por data: "YYYY-MM-DD" -> { aberto: boolean, inicio?: "HH:MM", fim?: "HH:MM" }
  excecoesFuncionamento?: Record<string, any>;
};

type SlotGerado = {
  horaInicio: string;
  horaFim: string;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function gerarSlotsPadrao1h(): SlotGerado[] {
  const out: SlotGerado[] = [];
  for (let h = 8; h < 22; h++) {
    out.push({ horaInicio: `${pad2(h)}:00`, horaFim: `${pad2(h + 1)}:00` });
  }
  return out;
}

function parseHHMM(hhmm: string): number | null {
  if (typeof hhmm !== "string") return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23) return null;
  if (min < 0 || min > 59) return null;
  return h * 60 + min;
}

function toHHMM(minutes: number) {
  const m = minutes % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${pad2(h)}:${pad2(mm)}`;
}

function gerarSlots1hEntre(inicioHHMM: string, fimHHMM: string): SlotGerado[] {
  const ini0 = parseHHMM(inicioHHMM);
  const fim0 = parseHHMM(fimHHMM);
  if (ini0 == null || fim0 == null) return [];

  let ini = ini0;
  let fim = fim0;

  // ✅ 16:00 -> 00:00 (vira o dia)
  if (fim <= ini) fim = fim + 1440;

  // por enquanto: não passa da meia-noite (mvp)
  const fimEfetivo = Math.min(fim, 1440);
  if (fimEfetivo - ini < 60) return [];

  const out: SlotGerado[] = [];
  for (let t = ini; t + 60 <= fimEfetivo; t += 60) {
    out.push({ horaInicio: toHHMM(t), horaFim: toHHMM(t + 60) });
  }
  return out;
}

function parseDateYYYYMMDD(data: string): Date {
  const [y, m, d] = data.split("-").map((x) => Number(x));
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function weekdayKeyFromData(data: string):
  | "domingo"
  | "segunda"
  | "terca"
  | "quarta"
  | "quinta"
  | "sexta"
  | "sabado" {
  const dt = parseDateYYYYMMDD(data);
  const dow = dt.getDay();
  const keys = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"] as const;
  return keys[dow];
}

// Normaliza qualquer “regra” vinda do Firestore para {aberto,inicio,fim}
function normalizeRegra(raw: any) {
  if (!raw || typeof raw !== "object") return null;

  const aberto =
    typeof raw.aberto === "boolean"
      ? raw.aberto
      : typeof raw.fechado === "boolean"
      ? !raw.fechado
      : true;

  const inicio = raw.inicio ?? raw.abre ?? raw.horaInicio;
  const fim = raw.fim ?? raw.fecha ?? raw.horaFim;

  return { aberto, inicio, fim };
}

function getRegraDoDia(funcionamento: any, key: string) {
  if (!funcionamento || typeof funcionamento !== "object") return null;

  const variants = [
    key,
    key === "terca" ? "terça" : null,
    key === "sabado" ? "sábado" : null,
  ].filter(Boolean) as string[];

  const numberMap: Record<string, number> = {
    domingo: 0,
    segunda: 1,
    terca: 2,
    quarta: 3,
    quinta: 4,
    sexta: 5,
    sabado: 6,
  };
  const idx = numberMap[key];

  const candidates: any[] = [];
  for (const v of variants) if (funcionamento[v] != null) candidates.push(funcionamento[v]);
  if (funcionamento[idx] != null) candidates.push(funcionamento[idx]);
  if (funcionamento[String(idx)] != null) candidates.push(funcionamento[String(idx)]);

  const abrevMap: Record<string, string[]> = {
    domingo: ["dom"],
    segunda: ["seg"],
    terca: ["ter"],
    quarta: ["qua"],
    quinta: ["qui"],
    sexta: ["sex"],
    sabado: ["sab"],
  };
  for (const ab of abrevMap[key] ?? []) if (funcionamento[ab] != null) candidates.push(funcionamento[ab]);

  const regraRaw = candidates.find((x) => x && typeof x === "object");
  return normalizeRegra(regraRaw);
}

export async function gerarDisponibilidadesParaData(quadraId: string, data: string) {
  const quadraRef = doc(db, "quadras", quadraId);
  const quadraSnap = await getDoc(quadraRef);
  if (!quadraSnap.exists()) throw new Error("Quadra não encontrada.");

  const quadra = quadraSnap.data() as QuadraDoc;

  const esportes = Array.isArray(quadra.esportes) ? quadra.esportes : [];
  if (esportes.length === 0) throw new Error("Quadra sem esportes cadastrados.");

  const valoresPorEsporte = quadra.valoresPorEsporte ?? {};
  const valorHoraGeral = typeof quadra.valorHora === "number" ? quadra.valorHora : null;

  // ✅ 1) slots por EXCEÇÃO do dia (se existir)
  let slots: SlotGerado[] = [];
  const excecoes = quadra.excecoesFuncionamento ?? {};
  const excecaoRaw = excecoes?.[data];
  const excecao = normalizeRegra(excecaoRaw);

  if (excecao) {
    if (excecao.aberto === false) {
      return { criados: 0, jaExistia: false, fechado: true, motivo: "excecao" };
    }

    if (typeof excecao.inicio === "string" && typeof excecao.fim === "string") {
      slots = gerarSlots1hEntre(excecao.inicio, excecao.fim);
    }
  }

  // ✅ 2) se não tiver exceção (ou inválida), usa funcionamento semanal
  if (slots.length === 0) {
    const funcionamento = quadra.funcionamento;

    if (funcionamento && typeof funcionamento === "object") {
      const key = weekdayKeyFromData(data);
      const regra = getRegraDoDia(funcionamento, key);

      if (regra && regra.aberto === false) {
        return { criados: 0, jaExistia: false, fechado: true, motivo: "semanal" };
      }

      if (regra && typeof regra.inicio === "string" && typeof regra.fim === "string") {
        slots = gerarSlots1hEntre(regra.inicio, regra.fim);
      }
    }
  }

  // ✅ 3) fallback padrão
  if (slots.length === 0) slots = gerarSlotsPadrao1h();

  // ✅ checagem de duplicidade (mas ignora se só existirem docs removidos)
  const col = collection(db, "disponibilidades");
  const qCheck = query(col, where("quadraId", "==", quadraId), where("data", "==", data));
  const snapCheck = await getDocs(qCheck);

  if (!snapCheck.empty) {
    const docs = snapCheck.docs.map((d) => d.data() as any);
    const existeNaoRemovido = docs.some((x) => x?.removido !== true);
    if (existeNaoRemovido) {
      return { criados: 0, jaExistia: true, fechado: false };
    }
    // se TODOS removidos, deixa gerar de novo
  }

  let criados = 0;

  for (const esp of esportes) {
    const valor = typeof valoresPorEsporte[esp] === "number" ? valoresPorEsporte[esp] : valorHoraGeral;
    if (typeof valor !== "number") throw new Error(`Quadra sem valor definido para o esporte: ${esp}`);

    for (const s of slots) {
      const dispRef = doc(col);

      await setDoc(dispRef, {
        quadraId,
        data,
        esporte: esp,
        horaInicio: s.horaInicio,
        horaFim: s.horaFim,
        valor,

        ativo: true,

        reservadoPorUid: null,
        reservadoEm: null,
        liberadoEm: null,

        bloqueado: false,
        bloqueadoPorUid: null,

        // ✅ SOFT DELETE
        removido: false,

        createdAt: serverTimestamp(),
      });

      criados++;
    }
  }

  return { criados, jaExistia: false, fechado: false };
}
