import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "./firebase";

type QuadraDoc = {
  esportes?: string[];
  valoresPorEsporte?: Record<string, number>;
  valorHora?: number | null;

  funcionamento?: any; // semanal
  excecoesFuncionamento?: Record<string, any>; // por data YYYY-MM-DD
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

  // 16:00 -> 00:00 (vira o dia). MVP: corta em 24:00 do mesmo dia.
  if (fim <= ini) fim = fim + 1440;

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

function weekdayKeyFromData(
  data: string
): "domingo" | "segunda" | "terca" | "quarta" | "quinta" | "sexta" | "sabado" {
  const dt = parseDateYYYYMMDD(data);
  const dow = dt.getDay();
  const keys = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"] as const;
  return keys[dow];
}

function isDiaDeSemana(
  key: "domingo" | "segunda" | "terca" | "quarta" | "quinta" | "sexta" | "sabado"
) {
  return (
    key === "segunda" ||
    key === "terca" ||
    key === "quarta" ||
    key === "quinta" ||
    key === "sexta"
  );
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

  // ✅ novo modelo agrupado
  if (isDiaDeSemana(key as any) && funcionamento.semana != null) {
    candidates.push(funcionamento.semana);
  }
  if (key === "sabado" && funcionamento.sabado != null) {
    candidates.push(funcionamento.sabado);
  }
  if (key === "domingo" && funcionamento.domingo != null) {
    candidates.push(funcionamento.domingo);
  }

  // ✅ compatibilidade com modelo por dia
  for (const v of variants) {
    if (funcionamento[v] != null) candidates.push(funcionamento[v]);
  }

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

  for (const ab of abrevMap[key] ?? []) {
    if (funcionamento[ab] != null) candidates.push(funcionamento[ab]);
  }

  const regra = candidates.find((x) => x && typeof x === "object");
  if (!regra) return null;

  const aberto =
    typeof regra.aberto === "boolean"
      ? regra.aberto
      : typeof regra.fechado === "boolean"
      ? !regra.fechado
      : true;

  const inicio = regra.inicio ?? regra.abre ?? regra.horaInicio;
  const fim = regra.fim ?? regra.fecha ?? regra.horaFim;

  return { aberto, inicio, fim };
}

function normalizeExcecao(raw: any) {
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

function buildStartEndAt(data: string, horaInicio: string, horaFim: string) {
  const [y, m, d] = data.split("-").map((x) => Number(x));
  const [hIni, minIni] = horaInicio.split(":").map(Number);
  const [hFim, minFim] = horaFim.split(":").map(Number);

  const startDate = new Date(y, (m ?? 1) - 1, d ?? 1, hIni ?? 0, minIni ?? 0);
  const endDate = new Date(y, (m ?? 1) - 1, d ?? 1, hFim ?? 0, minFim ?? 0);

  return {
    startAt: Timestamp.fromDate(startDate),
    endAt: Timestamp.fromDate(endDate),
  };
}

type ExistingDisp = {
  id: string;
  data: any;
};

function makeSlotKey(esporte: string, horaInicio: string, horaFim: string) {
  return `${esporte}__${horaInicio}__${horaFim}`;
}

export async function gerarDisponibilidadesParaData(quadraId: string, data: string) {
  const quadraRef = doc(db, "quadras", quadraId);
  const quadraSnap = await getDoc(quadraRef);
  if (!quadraSnap.exists()) throw new Error("Quadra não encontrada.");

  const ownerId = String((quadraSnap.data() as any)?.ownerId ?? "").trim();
if (!ownerId) throw new Error("Quadra sem ownerId.");

const userSnap = await getDoc(doc(db, "users", ownerId));
const userData = userSnap.exists() ? (userSnap.data() as any) : null;

const trialGratisAte = userData?.trialGratisAte ?? null;
const trialAtivo =
  trialGratisAte &&
  typeof trialGratisAte?.toMillis === "function" &&
  trialGratisAte.toMillis() > Date.now();

const finSnap = await getDoc(doc(db, "financeiro_donos", ownerId));
const saldoCentavos = finSnap.exists() ? Number((finSnap.data() as any)?.saldoCentavos ?? 0) : 0;

if (!trialAtivo && saldoCentavos <= -5000) {
  throw new Error("Sua quadra está bloqueada temporariamente por saldo pendente com a plataforma.");
}

  const quadra = quadraSnap.data() as QuadraDoc;

  const esportes = Array.isArray(quadra.esportes) ? quadra.esportes : [];
  if (esportes.length === 0) throw new Error("Quadra sem esportes cadastrados.");

  const valoresPorEsporte = quadra.valoresPorEsporte ?? {};
  const valorHoraGeral = typeof quadra.valorHora === "number" ? quadra.valorHora : null;

  // 1) primeiro: tenta exceção por data
  let slots: SlotGerado[] = [];
  const ex = normalizeExcecao(quadra.excecoesFuncionamento?.[data]);

  if (ex) {
    if (ex.aberto === false) {
      return { criados: 0, jaExistia: false, fechado: true, motivo: "excecao" };
    }

    if (typeof ex.inicio === "string" && typeof ex.fim === "string") {
      slots = gerarSlots1hEntre(ex.inicio, ex.fim);
    }
  }

  // 2) se não tiver exceção válida, usa funcionamento semanal
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

  // 3) fallback padrão
  if (slots.length === 0) slots = gerarSlotsPadrao1h();

  const col = collection(db, "disponibilidades");
  const qCheck = query(col, where("quadraId", "==", quadraId), where("data", "==", data));
  const snapCheck = await getDocs(qCheck);

  const existentes: ExistingDisp[] = snapCheck.docs.map((d) => ({
    id: d.id,
    data: d.data() as any,
  }));

  // se já existe slot "editável" ativo, não duplica geração
  const existeSlotEditavel = existentes.some(
    (x) => x.data?.removido !== true && !x.data?.reservadoPorUid
  );
  if (existeSlotEditavel) {
    return { criados: 0, jaExistia: true, fechado: false };
  }

  const existentesPorChave = new Map<string, ExistingDisp>();
  for (const item of existentes) {
    const esp = String(item.data?.esporte ?? "");
    const hi = String(item.data?.horaInicio ?? "");
    const hf = String(item.data?.horaFim ?? "");
    if (!esp || !hi || !hf) continue;

    const chave = makeSlotKey(esp, hi, hf);

    // guarda apenas slots removidos e sem reserva, que podem ser reativados
    if (item.data?.removido === true && !item.data?.reservadoPorUid) {
      if (!existentesPorChave.has(chave)) {
        existentesPorChave.set(chave, item);
      }
    }
  }

  let criados = 0;

  for (const esp of esportes) {
    const valor =
      typeof valoresPorEsporte[esp] === "number" ? valoresPorEsporte[esp] : valorHoraGeral;

    if (typeof valor !== "number") {
      throw new Error(`Quadra sem valor definido para o esporte: ${esp}`);
    }

    for (const s of slots) {
      const { startAt, endAt } = buildStartEndAt(data, s.horaInicio, s.horaFim);

      const payload = {
        quadraId,
        data,
        esporte: esp,
        horaInicio: s.horaInicio,
        horaFim: s.horaFim,
        valor,
        
        // 🔥 PROMOÇÃO (novo)
promocaoAtiva: false,
valorOriginal: valor,
valorPromocional: null,
promocaoCriadaEm: null,
promocaoCriadaPorUid: null,

        startAt,
        endAt,

        ativo: true,

        reservadoPorUid: null,
        reservadoEm: null,
        liberadoEm: null,

        bloqueado: false,
        bloqueadoPorUid: null,

        removido: false,

        createdAt: serverTimestamp(),
      };

      const chave = makeSlotKey(esp, s.horaInicio, s.horaFim);
      const existenteRemovido = existentesPorChave.get(chave);

      if (existenteRemovido) {
        await setDoc(doc(db, "disponibilidades", existenteRemovido.id), payload);
      } else {
        await setDoc(doc(col), payload);
      }

      criados++;
    }
  }

  return { criados, jaExistia: false, fechado: false };
}