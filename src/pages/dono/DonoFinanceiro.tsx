import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Header from "../../components/Header";
import {
  collection,
  getDocs,
  query,
  where,
  Timestamp,
  orderBy,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "../../services/firebase";
import { formatBRLFromCentavos } from "../../services/financeiro";

type Quadra = {
  id: string;
  nome?: string;
  ownerId?: string;
  ownerUid?: string;
};

type Reserva = {
  id: string;
  quadraId: string;

  data?: string;
  startAt?: any;
  endAt?: any;

  status?: string;
  pagamentoStatus?: string;

  motivoPolitica?: string;

  statusRepasse?: string;
  repassadoEm?: any;

  valorTotalCentavos?: number;
  valorPlataformaCentavos?: number;
  valorDonoCentavos?: number;
  valorClienteCentavos?: number;
};

type ResumoMensalAno = {
  mes: number;
  reservas: number;
  pagas: number;
  pendentes: number;

  brutoCentavos: number;
  plataformaCentavos: number;
  donoCentavos: number;
  clienteCentavos: number;

  recebidoCentavos: number;
  pendenteCentavos: number;

  repassadoDonoCentavos: number;
  aRepassarDonoCentavos: number;
};

const styles = {
  page: {
    minHeight: "100vh",
    background:
      "linear-gradient(180deg, #f8fafc 0%, #eef4ff 45%, #f8fafc 100%)",
    paddingBottom: 40,
  } as const,

  container: {
  width: "100%",
  maxWidth: 1200,
  margin: "0 auto",
  padding: "20px 16px 32px",
  boxSizing: "border-box",
  overflowX: "hidden",
} as const,

  backLink: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    textDecoration: "none",
    color: "#0f172a",
    fontWeight: 700,
    marginBottom: 16,
  } as const,

  hero: {
    position: "relative" as const,
    overflow: "hidden",
    borderRadius: 28,
    padding: "28px 24px",
    background:
      "linear-gradient(135deg, #0f172a 0%, #1d4ed8 55%, #38bdf8 100%)",
    color: "#fff",
    boxShadow: "0 22px 60px rgba(15, 23, 42, 0.18)",
  },

  heroGlow: {
    position: "absolute" as const,
    right: -60,
    top: -40,
    width: 220,
    height: 220,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.12)",
    filter: "blur(8px)",
  },

  heroGlow2: {
    position: "absolute" as const,
    left: -40,
    bottom: -80,
    width: 220,
    height: 220,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.10)",
    filter: "blur(10px)",
  },

  heroBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "7px 12px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.15)",
    border: "1px solid rgba(255,255,255,0.18)",
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 0.3,
    marginBottom: 14,
  } as const,

  heroTitle: {
    margin: 0,
    fontSize: "clamp(28px, 4vw, 42px)",
    lineHeight: 1.05,
    fontWeight: 900,
    letterSpacing: -0.6,
    maxWidth: 760,
  } as const,

  heroText: {
    margin: "12px 0 0",
    maxWidth: 760,
    fontSize: 15,
    lineHeight: 1.6,
    color: "rgba(255,255,255,0.92)",
  } as const,

  heroBottomRow: {
    marginTop: 22,
    display: "flex",
    gap: 12,
    flexWrap: "wrap" as const,
  },

  statPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 14px",
    borderRadius: 16,
    background: "rgba(255,255,255,0.14)",
    border: "1px solid rgba(255,255,255,0.18)",
    fontSize: 13,
    fontWeight: 700,
  } as const,

  sectionGrid: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 18,
    marginTop: 18,
  } as const,

  card: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 24,
    boxShadow: "0 14px 34px rgba(15, 23, 42, 0.06)",
  } as const,

  cardBody: {
    padding: 18,
  } as const,

  sectionTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 900,
    color: "#0f172a",
    letterSpacing: -0.3,
  } as const,

  helper: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.5,
  } as const,

  toolbar: {
    marginTop: 18,
    display: "flex",
    gap: 12,
    alignItems: "end",
    flexWrap: "wrap" as const,
  } as const,

  field: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 6,
    minWidth: 160,
  } as const,

  label: {
    fontSize: 13,
    fontWeight: 800,
    color: "#334155",
  } as const,

  input: {
    width: "100%",
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    background: "#fff",
    padding: "12px 14px",
    fontSize: 14,
    outline: "none",
    color: "#0f172a",
  } as const,

  greenBtn: {
    border: "none",
    borderRadius: 14,
    background: "linear-gradient(135deg, #16a34a 0%, #22c55e 100%)",
    color: "#fff",
    padding: "12px 16px",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 10px 24px rgba(34, 197, 94, 0.22)",
  } as const,

  neutralBtn: {
    border: "1px solid #cbd5e1",
    borderRadius: 14,
    background: "#fff",
    color: "#0f172a",
    padding: "12px 16px",
    fontWeight: 800,
    cursor: "pointer",
  } as const,

  darkGhostBtn: {
    border: "1px solid #1e293b",
    borderRadius: 14,
    background: "#0f172a",
    color: "#fff",
    padding: "12px 16px",
    fontWeight: 800,
    cursor: "pointer",
  } as const,

  alertError: {
    marginTop: 16,
    border: "1px solid #fecaca",
    background: "#fff1f2",
    color: "#b91c1c",
    borderRadius: 16,
    padding: 14,
    whiteSpace: "pre-line" as const,
  } as const,

  infoNotice: {
    marginTop: 14,
    padding: 14,
    borderRadius: 16,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    color: "#475569",
    fontWeight: 700,
    lineHeight: 1.5,
  } as const,

  statsGrid: {
    marginTop: 18,
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 14,
  } as const,

  statCard: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 22,
    padding: 18,
    boxShadow: "0 10px 26px rgba(15, 23, 42, 0.05)",
  } as const,

  statLabel: {
    margin: 0,
    fontSize: 12,
    fontWeight: 800,
    color: "#64748b",
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  } as const,

  statValue: {
    margin: "10px 0 0",
    fontSize: 28,
    fontWeight: 900,
    lineHeight: 1.05,
    color: "#0f172a",
    letterSpacing: -0.5,
  } as const,

  statHint: {
    margin: "8px 0 0",
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.4,
  } as const,

  statsMiniGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
    marginTop: 16,
  } as const,

  miniCard: {
    borderRadius: 18,
    padding: 16,
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
  } as const,

  miniLabel: {
    margin: 0,
    fontSize: 12,
    fontWeight: 800,
    color: "#64748b",
    textTransform: "uppercase" as const,
    letterSpacing: 0.4,
  } as const,

  miniValue: {
    margin: "8px 0 0",
    fontSize: 22,
    fontWeight: 900,
    color: "#0f172a",
  } as const,

  sectionBlock: {
    marginTop: 18,
  } as const,

  tableWrap: {
    overflowX: "auto" as const,
    marginTop: 14,
    border: "1px solid #e2e8f0",
    borderRadius: 20,
    background: "#fff",
  } as const,

  table: {
    borderCollapse: "collapse" as const,
    width: "100%",
    minWidth: 980,
  } as const,

  th: {
    textAlign: "left" as const,
    borderBottom: "1px solid #e2e8f0",
    padding: "12px 10px",
    color: "#334155",
    fontSize: 13,
    whiteSpace: "nowrap" as const,
    background: "#f8fafc",
    fontWeight: 800,
  } as const,

  td: {
    padding: "12px 10px",
    borderBottom: "1px solid #f1f5f9",
    color: "#0f172a",
    fontSize: 14,
    whiteSpace: "nowrap" as const,
  } as const,

  reservasList: {
    display: "grid",
    gap: 12,
    marginTop: 14,
  } as const,

  reservaCard: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 22,
    padding: 16,
    boxShadow: "0 10px 24px rgba(15, 23, 42, 0.04)",
  } as const,

  chipsRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap" as const,
    marginTop: 10,
  } as const,

  chip: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "7px 10px",
    fontSize: 12,
    fontWeight: 800,
    border: "1px solid #cbd5e1",
    background: "#f8fafc",
    color: "#0f172a",
  } as const,

  reservaTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap" as const,
  } as const,

  reservaTitle: {
    margin: 0,
    fontSize: 17,
    fontWeight: 900,
    color: "#0f172a",
  } as const,

  reservaSub: {
    margin: "6px 0 0",
    color: "#475569",
    fontSize: 14,
    lineHeight: 1.5,
  } as const,

  moneyRow: {
    marginTop: 12,
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 10,
  } as const,

  moneyBox: {
    borderRadius: 16,
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    padding: 12,
  } as const,

  moneyLabel: {
    margin: 0,
    color: "#64748b",
    fontSize: 12,
    fontWeight: 800,
    textTransform: "uppercase" as const,
    letterSpacing: 0.4,
  } as const,

  moneyValue: {
    margin: "8px 0 0",
    color: "#0f172a",
    fontSize: 15,
    fontWeight: 900,
  } as const,

  footerId: {
    marginTop: 10,
    fontSize: 12,
    color: "#94a3b8",
    wordBreak: "break-all" as const,
  } as const,

  emptyBox: {
    border: "1px dashed #cbd5e1",
    background: "#fff",
    borderRadius: 24,
    padding: 24,
    textAlign: "center" as const,
    color: "#64748b",
    fontWeight: 700,
  } as const,
};

function n(v: any) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function isPagoOuIsento(st: any) {
  const s = String(st ?? "").toLowerCase().trim();
  return s === "pago" || s === "isento";
}

function isPendente(st: any) {
  const s = String(st ?? "").toLowerCase().trim();
  return s === "pendente";
}

function isCancelada(status: any) {
  return String(status ?? "").toLowerCase().trim() === "cancelada";
}

function isRepasseRepassado(v: any) {
  return String(v ?? "").toLowerCase().trim() === "repassado";
}

function isRepassePendente(v: any) {
  return String(v ?? "").toLowerCase().trim() === "pendente";
}

function pad2(v: number) {
  return String(v).padStart(2, "0");
}

function monthLabel(m: number) {
  const labels = [
    "Jan",
    "Fev",
    "Mar",
    "Abr",
    "Mai",
    "Jun",
    "Jul",
    "Ago",
    "Set",
    "Out",
    "Nov",
    "Dez",
  ];
  return labels[m - 1] ?? String(m);
}

function startOfMonthDate(year: number, month1to12: number) {
  return new Date(year, month1to12 - 1, 1, 0, 0, 0, 0);
}

function startOfNextMonthDate(year: number, month1to12: number) {
  return new Date(year, month1to12, 1, 0, 0, 0, 0);
}

function startOfYearDate(year: number) {
  return new Date(year, 0, 1, 0, 0, 0, 0);
}

function startOfNextYearDate(year: number) {
  return new Date(year + 1, 0, 1, 0, 0, 0, 0);
}

function prettyIndexHint(e: any) {
  const msg = String(e?.message ?? "");
  if (msg.toLowerCase().includes("index")) {
    return "⚠️ Parece que falta um índice do Firestore para esta consulta. O erro do Firebase costuma trazer um link para criar o índice exato. Copie o erro completo do console se precisar.";
  }
  return null;
}

function initResumoMensalAno(mes: number): ResumoMensalAno {
  return {
    mes,
    reservas: 0,
    pagas: 0,
    pendentes: 0,
    brutoCentavos: 0,
    plataformaCentavos: 0,
    donoCentavos: 0,
    clienteCentavos: 0,
    recebidoCentavos: 0,
    pendenteCentavos: 0,
    repassadoDonoCentavos: 0,
    aRepassarDonoCentavos: 0,
  };
}

function statusChipStyle(status?: string) {
  const s = String(status ?? "").toLowerCase().trim();

  if (s === "cancelada") {
    return {
      background: "#fff1f2",
      color: "#be123c",
      border: "#fecdd3",
      text: "Cancelada",
    };
  }

  if (s === "finalizada") {
    return {
      background: "#ecfeff",
      color: "#0f766e",
      border: "#a5f3fc",
      text: "Finalizada",
    };
  }

  if (s === "agendada" || s === "confirmada") {
    return {
      background: "#eff6ff",
      color: "#1d4ed8",
      border: "#bfdbfe",
      text: "Ativa",
    };
  }

  return {
    background: "#f8fafc",
    color: "#334155",
    border: "#cbd5e1",
    text: status ?? "—",
  };
}

function pagamentoChipStyle(status?: string) {
  const s = String(status ?? "").toLowerCase().trim();

  if (s === "pago") {
    return {
      background: "#ecfdf3",
      color: "#166534",
      border: "#bbf7d0",
      text: "Pago",
    };
  }

  if (s === "isento") {
    return {
      background: "#f8fafc",
      color: "#475569",
      border: "#cbd5e1",
      text: "Isento",
    };
  }

  return {
    background: "#fef2f2",
    color: "#b91c1c",
    border: "#fecaca",
    text: "Pendente",
  };
}

function repasseChipStyle(status?: string) {
  const s = String(status ?? "").toLowerCase().trim();

  if (s === "repassado") {
    return {
      background: "#ecfdf3",
      color: "#166534",
      border: "#bbf7d0",
      text: "Repassado",
    };
  }

  if (s === "pendente") {
    return {
      background: "#fffbeb",
      color: "#b45309",
      border: "#fde68a",
      text: "Pendente",
    };
  }

  return {
    background: "#f8fafc",
    color: "#475569",
    border: "#cbd5e1",
    text: status ?? "—",
  };
}

export default function DonoFinanceiro() {
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [quadras, setQuadras] = useState<Quadra[]>([]);
  const [quadraId, setQuadraId] = useState<string>("");

  const [reservas, setReservas] = useState<Reserva[]>([]);

  const now = new Date();
  const [ano, setAno] = useState<number>(now.getFullYear());
  const [mes, setMes] = useState<number>(now.getMonth() + 1);

  const [loadingAno, setLoadingAno] = useState(false);
  const [erroAno, setErroAno] = useState<string | null>(null);
  const [resumoAno, setResumoAno] = useState<ResumoMensalAno[] | null>(null);
  const [resumoAnoGeradoEm, setResumoAnoGeradoEm] = useState<string | null>(
    null
  );

  async function carregarQuadrasDoDono() {
    const uid = getAuth().currentUser?.uid;
    if (!uid) throw new Error("Usuário não autenticado.");

    const col = collection(db, "quadras");

    const q1 = query(col, where("ownerId", "==", uid));
    const q2 = query(col, where("ownerUid", "==", uid));

    const [s1, s2] = await Promise.all([getDocs(q1), getDocs(q2)]);

    const map = new Map<string, Quadra>();

    s1.forEach((d) => map.set(d.id, { id: d.id, ...(d.data() as any) }));
    s2.forEach((d) => map.set(d.id, { id: d.id, ...(d.data() as any) }));

    const lista = Array.from(map.values()).sort((a, b) =>
      String(a.nome ?? "").localeCompare(String(b.nome ?? ""))
    );

    setQuadras(lista);
    if (!quadraId && lista.length > 0) setQuadraId(lista[0].id);
  }

  async function carregarReservasDaQuadraPorMes(
    qid: string,
    year: number,
    month1to12: number
  ) {
    const inicio = startOfMonthDate(year, month1to12);
    const fim = startOfNextMonthDate(year, month1to12);

    const inicioTs = Timestamp.fromDate(inicio);
    const fimTs = Timestamp.fromDate(fim);

    const col = collection(db, "reservas");

    const uid = getAuth().currentUser?.uid;
    if (!uid) throw new Error("Usuário não autenticado.");

    const q = query(
      col,
      where("quadraId", "==", qid),
      where("donoUid", "==", uid),
      where("startAt", ">=", inicioTs),
      where("startAt", "<", fimTs),
      orderBy("startAt", "asc")
    );

    const snap = await getDocs(q);

    const lista: Reserva[] = [];
    snap.forEach((d) => lista.push({ id: d.id, ...(d.data() as any) }));

    setReservas(lista);
  }

  async function gerarResumoAno(qid: string, year: number) {
    const inicio = Timestamp.fromDate(startOfYearDate(year));
    const fim = Timestamp.fromDate(startOfNextYearDate(year));

    const col = collection(db, "reservas");

    const q = query(
      col,
      where("quadraId", "==", qid),
      where("startAt", ">=", inicio),
      where("startAt", "<", fim),
      orderBy("startAt", "asc")
    );

    const snap = await getDocs(q);

    const map = new Map<number, ResumoMensalAno>();
    for (let m = 1; m <= 12; m++) map.set(m, initResumoMensalAno(m));

    snap.forEach((docSnap) => {
      const r = docSnap.data() as any;

      const startAt: Timestamp | null = r?.startAt ?? null;
      if (!startAt) return;

      const dt = startAt.toDate();
      const m = dt.getMonth() + 1;

      const item = map.get(m) ?? initResumoMensalAno(m);

      item.reservas += 1;

      const status = r?.status;
      const pag = r?.pagamentoStatus;

      if (isPagoOuIsento(pag)) item.pagas += 1;
      else if (isPendente(pag)) item.pendentes += 1;

      const total = n(r?.valorTotalCentavos);
      const plat = n(r?.valorPlataformaCentavos);
      const dono = n(r?.valorDonoCentavos);
      const cli = n(r?.valorClienteCentavos);

      item.brutoCentavos += total;
      item.plataformaCentavos += plat;
      item.donoCentavos += dono;
      item.clienteCentavos += cli;

      if (!isCancelada(status)) {
        if (isPagoOuIsento(pag)) item.recebidoCentavos += total;
        if (isPendente(pag)) item.pendenteCentavos += total;
      }

      const rep = r?.statusRepasse;
      if (isRepasseRepassado(rep)) {
        item.repassadoDonoCentavos += dono;
      } else if (isRepassePendente(rep) && String(pag ?? "") === "pago") {
        item.aRepassarDonoCentavos += dono;
      }

      map.set(m, item);
    });

    return Array.from(map.values());
  }

  async function carregarTudo() {
    setLoading(true);
    setErro(null);

    try {
      await carregarQuadrasDoDono();
    } catch (e: any) {
      console.error(e);
      setErro(e?.message ?? "Erro ao carregar quadras.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregarTudo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!quadraId) return;

    setLoading(true);
    setErro(null);

    carregarReservasDaQuadraPorMes(quadraId, ano, mes)
      .catch((e) => {
        console.error(e);
        const hint = prettyIndexHint(e);
        setErro(hint ?? "Erro ao carregar reservas (filtro por mês).");
      })
      .finally(() => setLoading(false));

    setResumoAno(null);
    setErroAno(null);
    setResumoAnoGeradoEm(null);
  }, [quadraId, ano, mes]);

  const resumo = useMemo(() => {
    const r = {
      totalReservas: reservas.length,
      pagas: 0,
      pendentes: 0,
      canceladas: 0,
      noshow: 0,

      totalBrutoCentavos: 0,
      totalPlataformaCentavos: 0,
      totalDonoCentavos: 0,
      totalClienteCentavos: 0,

      recebidoCentavos: 0,
      pendenteCentavos: 0,

      repassadoDonoCentavos: 0,
      aRepassarDonoCentavos: 0,
    };

    for (const x of reservas) {
      const status = x.status;
      const pag = x.pagamentoStatus;

      if (isCancelada(status)) r.canceladas++;
      if (String(x.motivoPolitica ?? "").toLowerCase() === "noshow") r.noshow++;

      if (isPagoOuIsento(pag)) r.pagas++;
      else if (isPendente(pag)) r.pendentes++;

      const total = n(x.valorTotalCentavos);
      const plat = n(x.valorPlataformaCentavos);
      const dono = n(x.valorDonoCentavos);
      const cli = n(x.valorClienteCentavos);

      r.totalBrutoCentavos += total;
      r.totalPlataformaCentavos += plat;
      r.totalDonoCentavos += dono;
      r.totalClienteCentavos += cli;

      if (!isCancelada(status)) {
        if (isPagoOuIsento(pag)) r.recebidoCentavos += total;
        if (isPendente(pag)) r.pendenteCentavos += total;
      }

      if (isRepasseRepassado(x.statusRepasse)) {
        r.repassadoDonoCentavos += dono;
      } else if (
        isRepassePendente(x.statusRepasse) &&
        String(pag ?? "") === "pago"
      ) {
        r.aRepassarDonoCentavos += dono;
      }
    }

    return r;
  }, [reservas]);

  const totalsAno = useMemo(() => {
    if (!resumoAno) return null;

    return resumoAno.reduce(
      (acc, m) => {
        acc.reservas += m.reservas;
        acc.pagas += m.pagas;
        acc.pendentes += m.pendentes;
        acc.brutoCentavos += m.brutoCentavos;
        acc.plataformaCentavos += m.plataformaCentavos;
        acc.donoCentavos += m.donoCentavos;
        acc.clienteCentavos += m.clienteCentavos;
        acc.recebidoCentavos += m.recebidoCentavos;
        acc.pendenteCentavos += m.pendenteCentavos;
        acc.repassadoDonoCentavos += m.repassadoDonoCentavos;
        acc.aRepassarDonoCentavos += m.aRepassarDonoCentavos;

        return acc;
      },
      {
        reservas: 0,
        pagas: 0,
        pendentes: 0,
        brutoCentavos: 0,
        plataformaCentavos: 0,
        donoCentavos: 0,
        clienteCentavos: 0,
        recebidoCentavos: 0,
        pendenteCentavos: 0,
        repassadoDonoCentavos: 0,
        aRepassarDonoCentavos: 0,
      }
    );
  }, [resumoAno]);

  const nomeQuadraAtual =
    quadras.find((q) => q.id === quadraId)?.nome ??
    (quadraId ? `Quadra ${quadraId}` : "—");

  const periodoLabel = `${monthLabel(mes)}/${ano}`;
  const periodoISO = `${ano}-${pad2(mes)}`;

  async function onClickResumoAno() {
    if (!quadraId) return;
    setLoadingAno(true);
    setErroAno(null);

    try {
      const r = await gerarResumoAno(quadraId, ano);
      setResumoAno(r);
      setResumoAnoGeradoEm(new Date().toLocaleString("pt-BR"));
    } catch (e: any) {
      console.error(e);
      const hint = prettyIndexHint(e);
      setErroAno(hint ?? "Erro ao gerar resumo anual.");
      setResumoAno(null);
      setResumoAnoGeradoEm(null);
    } finally {
      setLoadingAno(false);
    }
  }

  return (
    <>
      <Header />

      <div style={styles.page}>
        <div style={styles.container}>
          <Link to="/dono" style={styles.backLink}>
            <span>←</span>
            <span>Voltar ao painel</span>
          </Link>

          <section style={styles.hero}>
            <div style={styles.heroGlow} />
            <div style={styles.heroGlow2} />

            <div style={{ position: "relative" }}>
              <div style={styles.heroBadge}>FINANCEIRO DO DONO</div>

              <h1 style={styles.heroTitle}>Controle financeiro da quadra</h1>

              <p style={styles.heroText}>
                Acompanhe o desempenho mensal, visualize recebido, pendente,
                repasses, comissão da plataforma e consulte o resumo anual da
                operação da sua quadra.
              </p>

              <div style={styles.heroBottomRow}>
                <div style={styles.statPill}>
                  <span>Quadra</span>
                  <strong>{nomeQuadraAtual}</strong>
                </div>
                <div style={styles.statPill}>
                  <span>Período</span>
                  <strong>{periodoLabel}</strong>
                </div>
                <div style={styles.statPill}>
                  <span>Reservas</span>
                  <strong>{resumo.totalReservas}</strong>
                </div>
                <div style={styles.statPill}>
                  <span>Recebido</span>
                  <strong>{formatBRLFromCentavos(resumo.recebidoCentavos)}</strong>
                </div>
              </div>
            </div>
          </section>

          <div style={styles.sectionGrid}>
            <section style={styles.card}>
              <div style={styles.cardBody}>
                <h2 style={styles.sectionTitle}>Filtros e período</h2>
                <p style={styles.helper}>
                  Escolha a quadra e o período para consultar os números do mês
                  ou gerar um consolidado anual.
                </p>

                <div style={styles.toolbar}>
                  <div style={styles.field}>
                    <label style={styles.label}>Quadra</label>
                    <select
                      value={quadraId}
                      onChange={(e) => setQuadraId(e.target.value)}
                      style={styles.input}
                    >
                      {quadras.map((q) => (
                        <option key={q.id} value={q.id}>
                          {q.nome ?? q.id}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={styles.field}>
                    <label style={styles.label}>Mês</label>
                    <select
                      value={mes}
                      onChange={(e) => setMes(Number(e.target.value))}
                      style={styles.input}
                    >
                      {Array.from({ length: 12 }).map((_, i) => {
                        const m = i + 1;
                        return (
                          <option key={m} value={m}>
                            {monthLabel(m)}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div style={styles.field}>
                    <label style={styles.label}>Ano</label>
                    <select
                      value={ano}
                      onChange={(e) => setAno(Number(e.target.value))}
                      style={styles.input}
                    >
                      {Array.from({ length: 5 }).map((_, idx) => {
                        const y = now.getFullYear() - 2 + idx;
                        return (
                          <option key={y} value={y}>
                            {y}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <button
                    onClick={() =>
                      quadraId && carregarReservasDaQuadraPorMes(quadraId, ano, mes)
                    }
                    disabled={loading || !quadraId}
                    style={styles.greenBtn}
                  >
                    {loading ? "Carregando..." : "Atualizar"}
                  </button>

                  <button
                    onClick={onClickResumoAno}
                    disabled={loadingAno || !quadraId}
                    style={styles.darkGhostBtn}
                  >
                    {loadingAno ? "Gerando..." : "📅 Ver resumo do ano"}
                  </button>
                </div>

                <div style={styles.infoNotice}>
                  Período selecionado: <strong>{periodoLabel}</strong> ({periodoISO})
                </div>

                {erro && <div style={styles.alertError}>{erro}</div>}
              </div>
            </section>

            <aside style={styles.card}>
              <div style={styles.cardBody}>
                <h2 style={styles.sectionTitle}>Indicadores rápidos</h2>
                <p style={styles.helper}>
                  Visão compacta do estado financeiro e operacional do mês.
                </p>

                <div style={styles.statsMiniGrid}>
                  <div style={styles.miniCard}>
                    <p style={styles.miniLabel}>Pagas</p>
                    <p style={{ ...styles.miniValue, color: "#16a34a" }}>
                      {resumo.pagas}
                    </p>
                  </div>

                  <div style={styles.miniCard}>
                    <p style={styles.miniLabel}>Pendentes</p>
                    <p style={{ ...styles.miniValue, color: "#b45309" }}>
                      {resumo.pendentes}
                    </p>
                  </div>

                  <div style={styles.miniCard}>
                    <p style={styles.miniLabel}>Canceladas</p>
                    <p style={{ ...styles.miniValue, color: "#e11d48" }}>
                      {resumo.canceladas}
                    </p>
                  </div>

                  <div style={styles.miniCard}>
                    <p style={styles.miniLabel}>No-show</p>
                    <p style={{ ...styles.miniValue, color: "#b91c1c" }}>
                      {resumo.noshow}
                    </p>
                  </div>
                </div>
              </div>
            </aside>
          </div>

          <section style={styles.statsGrid}>
            <article style={styles.statCard}>
              <p style={styles.statLabel}>Recebido</p>
              <p style={{ ...styles.statValue, color: "#16a34a" }}>
                {formatBRLFromCentavos(resumo.recebidoCentavos)}
              </p>
              <p style={styles.statHint}>Reservas pagas ou isentas no mês.</p>
            </article>

            <article style={styles.statCard}>
              <p style={styles.statLabel}>Pendente</p>
              <p style={{ ...styles.statValue, color: "#b45309" }}>
                {formatBRLFromCentavos(resumo.pendenteCentavos)}
              </p>
              <p style={styles.statHint}>Valores ainda não liquidados.</p>
            </article>

            <article style={styles.statCard}>
              <p style={styles.statLabel}>Plataforma</p>
              <p style={{ ...styles.statValue, color: "#0f172a" }}>
                {formatBRLFromCentavos(resumo.totalPlataformaCentavos)}
              </p>
              <p style={styles.statHint}>Comissão total da plataforma.</p>
            </article>

            <article style={styles.statCard}>
              <p style={styles.statLabel}>Dono líquido</p>
              <p style={{ ...styles.statValue, color: "#1d4ed8" }}>
                {formatBRLFromCentavos(resumo.totalDonoCentavos)}
              </p>
              <p style={styles.statHint}>Parte líquida destinada ao dono.</p>
            </article>

            <article style={styles.statCard}>
              <p style={styles.statLabel}>Repassado ao dono</p>
              <p style={{ ...styles.statValue, color: "#0f766e" }}>
                {formatBRLFromCentavos(resumo.repassadoDonoCentavos)}
              </p>
              <p style={styles.statHint}>Valores já repassados neste período.</p>
            </article>

            <article style={styles.statCard}>
              <p style={styles.statLabel}>A repassar</p>
              <p style={{ ...styles.statValue, color: "#b45309" }}>
                {formatBRLFromCentavos(resumo.aRepassarDonoCentavos)}
              </p>
              <p style={styles.statHint}>Reservas pagas com repasse pendente.</p>
            </article>

            <article style={styles.statCard}>
              <p style={styles.statLabel}>Cliente</p>
              <p style={{ ...styles.statValue, color: "#475569" }}>
                {formatBRLFromCentavos(resumo.totalClienteCentavos)}
              </p>
              <p style={styles.statHint}>Reembolsos e partes do cliente.</p>
            </article>

            <article style={styles.statCard}>
              <p style={styles.statLabel}>Total bruto</p>
              <p style={{ ...styles.statValue, color: "#0f172a" }}>
                {formatBRLFromCentavos(resumo.totalBrutoCentavos)}
              </p>
              <p style={styles.statHint}>Somatório bruto das reservas do mês.</p>
            </article>
          </section>

          <section style={styles.sectionBlock}>
            <div style={styles.card}>
              <div style={styles.cardBody}>
                <h2 style={styles.sectionTitle}>
                  Resumo anual {resumoAno ? `— ${ano}` : ""}
                </h2>
                <p style={styles.helper}>
                  Gere um consolidado por mês para acompanhar sazonalidade,
                  receita e repasses ao longo do ano.
                </p>

                {erroAno && <div style={styles.alertError}>{erroAno}</div>}

                {!resumoAno && !erroAno && (
                  <div style={styles.infoNotice}>
                    Clique em <strong>“📅 Ver resumo do ano”</strong> para gerar a
                    visão consolidada do ano selecionado.
                  </div>
                )}

                {resumoAno && (
                  <>
                    {resumoAnoGeradoEm && (
                      <div style={styles.infoNotice}>
                        Resumo anual gerado em: <strong>{resumoAnoGeradoEm}</strong>
                      </div>
                    )}

                    {totalsAno && (
                      <div style={styles.statsMiniGrid}>
                        <div style={styles.miniCard}>
                          <p style={styles.miniLabel}>Total bruto</p>
                          <p style={styles.miniValue}>
                            {formatBRLFromCentavos(totalsAno.brutoCentavos)}
                          </p>
                        </div>

                        <div style={styles.miniCard}>
                          <p style={styles.miniLabel}>Total plataforma</p>
                          <p style={styles.miniValue}>
                            {formatBRLFromCentavos(totalsAno.plataformaCentavos)}
                          </p>
                        </div>

                        <div style={styles.miniCard}>
                          <p style={styles.miniLabel}>Total dono</p>
                          <p style={styles.miniValue}>
                            {formatBRLFromCentavos(totalsAno.donoCentavos)}
                          </p>
                        </div>

                        <div style={styles.miniCard}>
                          <p style={styles.miniLabel}>Total recebido</p>
                          <p style={{ ...styles.miniValue, color: "#16a34a" }}>
                            {formatBRLFromCentavos(totalsAno.recebidoCentavos)}
                          </p>
                        </div>

                        <div style={styles.miniCard}>
                          <p style={styles.miniLabel}>Total pendente</p>
                          <p style={{ ...styles.miniValue, color: "#b45309" }}>
                            {formatBRLFromCentavos(totalsAno.pendenteCentavos)}
                          </p>
                        </div>

                        <div style={styles.miniCard}>
                          <p style={styles.miniLabel}>Repassado</p>
                          <p style={{ ...styles.miniValue, color: "#0f766e" }}>
                            {formatBRLFromCentavos(
                              totalsAno.repassadoDonoCentavos
                            )}
                          </p>
                        </div>

                        <div style={styles.miniCard}>
                          <p style={styles.miniLabel}>A repassar</p>
                          <p style={{ ...styles.miniValue, color: "#b45309" }}>
                            {formatBRLFromCentavos(
                              totalsAno.aRepassarDonoCentavos
                            )}
                          </p>
                        </div>

                        <div style={styles.miniCard}>
                          <p style={styles.miniLabel}>Reservas</p>
                          <p style={styles.miniValue}>{totalsAno.reservas}</p>
                        </div>
                      </div>
                    )}

                    <div style={styles.tableWrap}>
                      <table style={styles.table}>
                        <thead>
                          <tr>
                            {[
                              "Mês",
                              "Reservas",
                              "Pagas",
                              "Pendentes",
                              "Bruto",
                              "Plataforma",
                              "Dono",
                              "Repasse (Dono)",
                              "A repassar",
                              "Recebido",
                              "Pendente (R$)",
                            ].map((h) => (
                              <th key={h} style={styles.th}>
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {resumoAno.map((m) => (
                            <tr key={m.mes}>
                              <td style={styles.td}>
                                <strong>{monthLabel(m.mes)}</strong>
                              </td>
                              <td style={styles.td}>{m.reservas}</td>
                              <td style={styles.td}>{m.pagas}</td>
                              <td style={styles.td}>{m.pendentes}</td>
                              <td style={styles.td}>
                                {formatBRLFromCentavos(m.brutoCentavos)}
                              </td>
                              <td style={styles.td}>
                                {formatBRLFromCentavos(m.plataformaCentavos)}
                              </td>
                              <td style={styles.td}>
                                {formatBRLFromCentavos(m.donoCentavos)}
                              </td>
                              <td style={styles.td}>
                                {formatBRLFromCentavos(m.repassadoDonoCentavos)}
                              </td>
                              <td style={styles.td}>
                                {formatBRLFromCentavos(m.aRepassarDonoCentavos)}
                              </td>
                              <td style={styles.td}>
                                {formatBRLFromCentavos(m.recebidoCentavos)}
                              </td>
                              <td style={styles.td}>
                                {formatBRLFromCentavos(m.pendenteCentavos)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            </div>
          </section>

          <section style={styles.sectionBlock}>
            <div style={styles.card}>
              <div style={styles.cardBody}>
                <h2 style={styles.sectionTitle}>Reservas do mês</h2>
                <p style={styles.helper}>
                  Amostra das reservas mais recentes do período selecionado, com
                  status financeiro e distribuição dos valores.
                </p>

                <div style={styles.reservasList}>
                  {reservas.slice(-30).reverse().map((r) => {
                    const s = statusChipStyle(r.status);
                    const p = pagamentoChipStyle(r.pagamentoStatus);
                    const rep = repasseChipStyle(r.statusRepasse);

                    return (
                      <article key={r.id} style={styles.reservaCard}>
                        <div style={styles.reservaTop}>
                          <div>
                            <h3 style={styles.reservaTitle}>{r.data ?? "—"}</h3>
                            <p style={styles.reservaSub}>
                              Reserva financeira vinculada à quadra selecionada.
                            </p>
                          </div>

                          <div style={styles.chipsRow}>
                            <span
                              style={{
                                ...styles.chip,
                                background: s.background,
                                color: s.color,
                                border: `1px solid ${s.border}`,
                              }}
                            >
                              {s.text}
                            </span>

                            <span
                              style={{
                                ...styles.chip,
                                background: p.background,
                                color: p.color,
                                border: `1px solid ${p.border}`,
                              }}
                            >
                              Pagamento: {p.text}
                            </span>

                            <span
                              style={{
                                ...styles.chip,
                                background: rep.background,
                                color: rep.color,
                                border: `1px solid ${rep.border}`,
                              }}
                            >
                              Repasse: {rep.text}
                            </span>

                            <span style={styles.chip}>
                              Motivo: {r.motivoPolitica ?? "—"}
                            </span>
                          </div>
                        </div>

                        <div style={styles.moneyRow}>
                          <div style={styles.moneyBox}>
                            <p style={styles.moneyLabel}>Total</p>
                            <p style={styles.moneyValue}>
                              {formatBRLFromCentavos(n(r.valorTotalCentavos))}
                            </p>
                          </div>

                          <div style={styles.moneyBox}>
                            <p style={styles.moneyLabel}>Dono</p>
                            <p style={styles.moneyValue}>
                              {formatBRLFromCentavos(n(r.valorDonoCentavos))}
                            </p>
                          </div>

                          <div style={styles.moneyBox}>
                            <p style={styles.moneyLabel}>Plataforma</p>
                            <p style={styles.moneyValue}>
                              {formatBRLFromCentavos(
                                n(r.valorPlataformaCentavos)
                              )}
                            </p>
                          </div>

                          <div style={styles.moneyBox}>
                            <p style={styles.moneyLabel}>Cliente</p>
                            <p style={styles.moneyValue}>
                              {formatBRLFromCentavos(n(r.valorClienteCentavos))}
                            </p>
                          </div>
                        </div>

                        <div style={styles.footerId}>{r.id}</div>
                      </article>
                    );
                  })}

                  {reservas.length === 0 && (
                    <div style={styles.emptyBox}>
                      Nenhuma reserva encontrada para esta quadra neste mês.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}