import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Header from "../../components/Header";
import { buscarQuadrasDoDono } from "../../services/quadras";
import { useAuth } from "../../services/authContext";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../services/firebase";
import { downloadTextFile, toCSV } from "../../utils/csv";

type Quadra = {
  id: string;
  nome: string;
  cidade: string;
  endereco?: string;
  ativo?: boolean;
};

type Reserva = {
  id: string;
  quadraId: string;
  esporte?: string;
  data: string;
  horaInicio?: string;
  horaFim?: string;
  valor?: number;
  status?: string;
  naoCompareceu?: boolean;
  cliente?: { nome?: string; telefone?: string | null };
};

function formatBRL(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function isAtiva(status: any) {
  return status === "agendada" || status === "confirmada";
}

function toISODate(d: Date) {
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function getMonthRangeISO(year: number, monthIndex0: number) {
  const first = new Date(year, monthIndex0, 1);
  const last = new Date(year, monthIndex0 + 1, 0);
  return { startISO: toISODate(first), endISO: toISODate(last) };
}

function getPrevMonth(year: number, monthIndex0: number) {
  const d = new Date(year, monthIndex0, 1);
  d.setMonth(d.getMonth() - 1);
  return { year: d.getFullYear(), monthIndex0: d.getMonth() };
}

function pctChange(current: number, prev: number) {
  if (prev === 0) return null;
  return ((current - prev) / prev) * 100;
}

function formatPct(p: number | null) {
  if (p === null) return "—";
  const abs = Math.abs(p);
  const sign = p > 0 ? "+" : p < 0 ? "-" : "";
  return `${sign}${abs.toFixed(0)}%`;
}

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

function calcDash(reservas: Reserva[]) {
  const ativas = reservas.filter((r) => isAtiva(r.status)).length;
  const canceladas = reservas.filter((r) => r.status === "cancelada").length;
  const noShows = reservas.filter((r) => r.naoCompareceu === true).length;

  const finalizadasSemNoShow = reservas.filter(
    (r) => r.status === "finalizada" && r.naoCompareceu !== true
  ).length;

  const receitaRealizada = reservas
    .filter((r) => r.status === "finalizada" && r.naoCompareceu !== true)
    .reduce((acc, r) => acc + Number(r.valor ?? 0), 0);

  const receitaPerdida = reservas
    .filter((r) => r.status === "cancelada" || r.naoCompareceu === true)
    .reduce((acc, r) => acc + Number(r.valor ?? 0), 0);

  return {
    totalReservas: reservas.length,
    ativas,
    canceladas,
    finalizadasSemNoShow,
    noShows,
    receitaRealizada,
    receitaPerdida,
  };
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "linear-gradient(180deg, #0f172a 0px, #111827 190px, #f8fafc 190px, #f8fafc 100%)",
  },
  container: {
    maxWidth: 1180,
    margin: "0 auto",
    padding: "18px 16px 40px",
  },
  hero: {
    background: "linear-gradient(135deg, #2563eb, #3b82f6)",
    color: "#fff",
    borderRadius: 26,
    padding: "28px 24px",
    boxShadow: "0 20px 50px rgba(15,23,42,0.22)",
    marginTop: 12,
  },
  heroBadge: {
    display: "inline-flex",
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.10)",
    fontWeight: 800,
    fontSize: 13,
    marginBottom: 12,
  },
  heroTitle: {
    margin: 0,
    fontSize: 38,
    lineHeight: 1.08,
    fontWeight: 900,
  },
  heroText: {
    marginTop: 12,
    marginBottom: 0,
    color: "#cbd5e1",
    fontSize: 15,
    lineHeight: 1.65,
    maxWidth: 760,
  },
  heroActions: {
    marginTop: 18,
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  heroPrimaryBtn: {
    minHeight: 46,
    padding: "0 16px",
    borderRadius: 14,
    border: "none",
    background: "linear-gradient(135deg, #22c55e, #16a34a)",
    color: "#fff",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 12px 24px rgba(34,197,94,0.22)",
  },
  heroSecondaryBtn: {
    minHeight: 46,
    padding: "0 16px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.08)",
    color: "#fff",
    fontWeight: 800,
    cursor: "pointer",
  },
  card: {
    marginTop: 18,
    background: "#fff",
    borderRadius: 22,
    padding: 18,
    border: "1px solid #e5e7eb",
    boxShadow: "0 10px 28px rgba(15,23,42,0.06)",
  },
  sectionTitle: {
    margin: 0,
    fontSize: 24,
    color: "#0f172a",
    fontWeight: 900,
  },
  sectionText: {
    margin: "8px 0 0",
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.6,
  },
  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    flexWrap: "wrap",
    alignItems: "flex-start",
  },
  controlsWrap: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
  },
  select: {
    minHeight: 42,
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    background: "#fff",
    padding: "0 12px",
    color: "#0f172a",
    fontWeight: 700,
  },
  neutralBtn: {
    minHeight: 42,
    padding: "0 14px",
    borderRadius: 12,
    border: "1px solid #cbd5e1",
    background: "#fff",
    color: "#0f172a",
    fontWeight: 700,
    cursor: "pointer",
  },
  metricGrid: {
    marginTop: 14,
    display: "grid",
    gap: 12,
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  },
  metricCard: {
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    padding: 16,
    background: "linear-gradient(180deg, #ffffff, #f8fafc)",
    boxShadow: "0 8px 18px rgba(15,23,42,0.04)",
  },
  metricLabel: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  metricValue: {
    marginTop: 8,
    fontSize: 28,
    fontWeight: 900,
    color: "#0f172a",
    lineHeight: 1.1,
  },
  metricSub: {
    marginTop: 8,
    fontSize: 13,
    color: "#64748b",
    fontWeight: 700,
  },
  compareBox: {
    marginTop: 12,
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    borderRadius: 18,
    padding: 14,
  },
  compareTitle: {
    fontWeight: 900,
    color: "#0f172a",
    marginBottom: 6,
  },
  quadraList: {
    display: "grid",
    gap: 10,
  },
  quadraMetricCard: {
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    padding: 14,
    background: "#fff",
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    flexWrap: "wrap",
    alignItems: "center",
  },
  quadraName: {
    fontWeight: 900,
    color: "#0f172a",
    fontSize: 17,
  },
  quadraMeta: {
    marginTop: 4,
    fontSize: 13,
    color: "#64748b",
    lineHeight: 1.6,
  },
  green: {
    color: "#15803d",
    fontWeight: 800,
  },
  red: {
    color: "#b91c1c",
    fontWeight: 800,
  },
  darkRed: {
    color: "#b00020",
    fontWeight: 800,
  },
  revenueBox: {
    textAlign: "right",
  },
  revenueLabel: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: 700,
  },
  revenueValue: {
    marginTop: 4,
    fontSize: 24,
    fontWeight: 900,
    color: "#0f172a",
  },
  actionsRow: {
    marginTop: 8,
    display: "flex",
    gap: 8,
    justifyContent: "flex-end",
    flexWrap: "wrap",
  },
  smallBtn: {
    minHeight: 36,
    padding: "0 12px",
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    background: "#fff",
    color: "#0f172a",
    fontWeight: 700,
    cursor: "pointer",
    fontSize: 12,
  },
  smallBlueBtn: {
    minHeight: 36,
    padding: "0 12px",
    borderRadius: 10,
    border: "none",
    background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
    color: "#fff",
    fontWeight: 800,
    cursor: "pointer",
    fontSize: 12,
  },
  smallGreenBtn: {
    minHeight: 36,
    padding: "0 12px",
    borderRadius: 10,
    border: "none",
    background: "linear-gradient(135deg, #10b981, #059669)",
    color: "#fff",
    fontWeight: 800,
    cursor: "pointer",
    fontSize: 12,
  },
  totalBox: {
    marginTop: 14,
    padding: "12px 14px",
    borderRadius: 16,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    color: "#334155",
    fontWeight: 700,
  },
  quadrasGrid: {
    display: "grid",
    gap: 14,
    marginTop: 14,
  },
  quadraCard: {
    border: "1px solid #e2e8f0",
    borderRadius: 20,
    padding: 16,
    background: "#fff",
    boxShadow: "0 8px 18px rgba(15,23,42,0.04)",
  },
  quadraTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    flexWrap: "wrap",
    alignItems: "flex-start",
  },
  quadraTitle: {
    margin: "0 0 6px",
    fontSize: 24,
    fontWeight: 900,
    color: "#0f172a",
  },
  quadraCity: {
    color: "#334155",
    fontWeight: 700,
    fontSize: 15,
  },
  quadraAddress: {
    color: "#64748b",
    marginTop: 6,
    fontSize: 14,
  },
  inactiveTag: {
    marginTop: 8,
    display: "inline-flex",
    padding: "6px 10px",
    borderRadius: 999,
    background: "#fff1f2",
    color: "#b91c1c",
    border: "1px solid #fecaca",
    fontWeight: 800,
    fontSize: 12,
  },
  quadraActions: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    flexWrap: "wrap",
  },
  emptyState: {
    border: "1px dashed #cbd5e1",
    borderRadius: 18,
    padding: 18,
    background: "#fff",
    color: "#475569",
  },
};

export default function DonoHome() {
  const { user, loading } = useAuth();
  const [quadras, setQuadras] = useState<Quadra[]>([]);
  const [carregando, setCarregando] = useState(true);

  const [carregandoDash, setCarregandoDash] = useState(false);
  const [erroDash, setErroDash] = useState<string | null>(null);

  const [reservasPeriodo, setReservasPeriodo] = useState<Reserva[]>([]);
  const [reservasPrev, setReservasPrev] = useState<Reserva[]>([]);

  const now = useMemo(() => new Date(), []);
  const [anoSel, setAnoSel] = useState(now.getFullYear());
  const [mesSel, setMesSel] = useState(now.getMonth());

  const { startISO, endISO } = useMemo(
    () => getMonthRangeISO(anoSel, mesSel),
    [anoSel, mesSel]
  );

  const { year: anoPrev, monthIndex0: mesPrev } = useMemo(
    () => getPrevMonth(anoSel, mesSel),
    [anoSel, mesSel]
  );

  const { startISO: startPrev, endISO: endPrev } = useMemo(
    () => getMonthRangeISO(anoPrev, mesPrev),
    [anoPrev, mesPrev]
  );

  const periodoLabel = useMemo(
    () => `${MESES[mesSel]} de ${anoSel}`,
    [mesSel, anoSel]
  );

  const periodoPrevLabel = useMemo(
    () => `${MESES[mesPrev]} de ${anoPrev}`,
    [mesPrev, anoPrev]
  );

  useEffect(() => {
    if (!user?.uid) {
      setCarregando(false);
      return;
    }

    const ownerId = user.uid;

    async function carregar() {
      try {
        setCarregando(true);
        const dados = await buscarQuadrasDoDono(ownerId);
        setQuadras(dados as Quadra[]);
      } catch (e) {
        console.error(e);
        alert("Erro ao buscar suas quadras. Veja o console.");
      } finally {
        setCarregando(false);
      }
    }

    carregar();
  }, [user?.uid]);

  async function fetchReservasPeriodo(
    ids: string[],
    start: string,
    end: string
  ): Promise<Reserva[]> {
    if (!ids.length) return [];

    const idsLotes: string[][] = [];
    for (let i = 0; i < ids.length; i += 30) idsLotes.push(ids.slice(i, i + 30));

    const all: Reserva[] = [];

    for (const lote of idsLotes) {
      const col = collection(db, "reservas");
      const q = query(
        col,
        where("quadraId", "in", lote),
        where("data", ">=", start),
        where("data", "<=", end)
      );

      const snap = await getDocs(q);
      snap.forEach((d) => all.push({ id: d.id, ...(d.data() as any) }));
    }

    return all;
  }

  async function carregarDashboard() {
    try {
      setErroDash(null);
      setCarregandoDash(true);

      const ids = quadras.map((q) => q.id).filter(Boolean);

      if (ids.length === 0) {
        setReservasPeriodo([]);
        setReservasPrev([]);
        return;
      }

      const [cur, prev] = await Promise.all([
        fetchReservasPeriodo(ids, startISO, endISO),
        fetchReservasPeriodo(ids, startPrev, endPrev),
      ]);

      setReservasPeriodo(cur);
      setReservasPrev(prev);
    } catch (e: any) {
      console.error(e);
      setErroDash(e?.message ?? "Erro ao carregar dashboard.");
    } finally {
      setCarregandoDash(false);
    }
  }

  useEffect(() => {
    if (!carregando) carregarDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    carregando,
    startISO,
    endISO,
    startPrev,
    endPrev,
    quadras.map((q) => q.id).join("|"),
  ]);

  const dash = useMemo(() => calcDash(reservasPeriodo), [reservasPeriodo]);
  const dashPrev = useMemo(() => calcDash(reservasPrev), [reservasPrev]);

  const comparativo = useMemo(() => {
    const diffReceita = dash.receitaRealizada - dashPrev.receitaRealizada;
    const pctReceita = pctChange(dash.receitaRealizada, dashPrev.receitaRealizada);

    const diffTotal = dash.totalReservas - dashPrev.totalReservas;
    const pctTotal = pctChange(dash.totalReservas, dashPrev.totalReservas);

    return { diffReceita, pctReceita, diffTotal, pctTotal };
  }, [dash, dashPrev]);

  const quadraNomePorId = useMemo(() => {
    const m: Record<string, string> = {};
    quadras.forEach((q) => (m[q.id] = q.nome));
    return m;
  }, [quadras]);

  const metricasPorQuadra = useMemo(() => {
    const map: Record<
      string,
      {
        quadraId: string;
        total: number;
        ativas: number;
        canceladas: number;
        finalizadas: number;
        noShows: number;
        receita: number;
        receitaPerdida: number;
      }
    > = {};

    for (const r of reservasPeriodo) {
      const id = String(r.quadraId ?? "");
      if (!id) continue;

      if (!map[id]) {
        map[id] = {
          quadraId: id,
          total: 0,
          ativas: 0,
          canceladas: 0,
          finalizadas: 0,
          noShows: 0,
          receita: 0,
          receitaPerdida: 0,
        };
      }

      map[id].total++;
      if (isAtiva(r.status)) map[id].ativas++;

      if (r.status === "cancelada") {
        map[id].canceladas++;
        map[id].receitaPerdida += Number(r.valor ?? 0);
      }
      if (r.naoCompareceu === true) {
        map[id].noShows++;
        map[id].receitaPerdida += Number(r.valor ?? 0);
      }

      if (r.status === "finalizada" && r.naoCompareceu !== true) {
        map[id].finalizadas++;
        map[id].receita += Number(r.valor ?? 0);
      }
    }

    return Object.values(map);
  }, [reservasPeriodo]);

  const dashPorQuadra = useMemo(() => {
    return metricasPorQuadra.slice().sort((a, b) => b.receita - a.receita);
  }, [metricasPorQuadra]);

  const anos = useMemo(() => {
    const y = new Date().getFullYear();
    return [y - 2, y - 1, y, y + 1];
  }, []);

  function baixarCsvDaQuadra(quadraId: string) {
    const nomeQuadra = quadraNomePorId[quadraId] ?? quadraId;

    const reservasDaQuadra = reservasPeriodo
      .filter((r) => String(r.quadraId) === String(quadraId))
      .slice()
      .sort((a, b) =>
        `${a.data} ${a.horaInicio ?? ""}`.localeCompare(`${b.data} ${b.horaInicio ?? ""}`)
      );

    const total = reservasDaQuadra.length;
    const ativas = reservasDaQuadra.filter((r) => isAtiva(r.status)).length;
    const canceladas = reservasDaQuadra.filter((r) => r.status === "cancelada").length;
    const noShows = reservasDaQuadra.filter((r) => r.naoCompareceu === true).length;
    const finalizadasOk = reservasDaQuadra.filter(
      (r) => r.status === "finalizada" && r.naoCompareceu !== true
    ).length;

    const receitaRealizada = reservasDaQuadra
      .filter((r) => r.status === "finalizada" && r.naoCompareceu !== true)
      .reduce((acc, r) => acc + Number(r.valor ?? 0), 0);

    const receitaPerdida = reservasDaQuadra
      .filter((r) => r.status === "cancelada" || r.naoCompareceu === true)
      .reduce((acc, r) => acc + Number(r.valor ?? 0), 0);

    const potencial = receitaRealizada + receitaPerdida;
    const perdaRate = potencial > 0 ? receitaPerdida / potencial : 0;

    const headers = [
      "Tipo",
      "Campo",
      "Valor",
      "Data",
      "Dia",
      "Início",
      "Fim",
      "Esporte",
      "Status",
      "No-show",
      "Valor (R$)",
      "Cliente",
      "Telefone",
      "ID Reserva",
    ];

    const dias = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"] as const;
    const diaSemana = (dataYYYYMMDD: string) => {
      const [y, m, d] = String(dataYYYYMMDD ?? "").split("-").map(Number);
      if (!y || !m || !d) return "";
      const dt = new Date(y, m - 1, d);
      return dias[dt.getDay()] ?? "";
    };

    const asText = (v: any) => (v == null ? "" : String(v));
    const t = (v: any) => (asText(v) ? `'${asText(v)}` : "");

    const resumoRows = [
      { Tipo: "RESUMO", Campo: "Quadra", Valor: nomeQuadra },
      { Tipo: "RESUMO", Campo: "Período", Valor: `${startISO} até ${endISO}` },
      { Tipo: "RESUMO", Campo: "Total de reservas", Valor: total },
      { Tipo: "RESUMO", Campo: "Ativas", Valor: ativas },
      { Tipo: "RESUMO", Campo: "Finalizadas (OK)", Valor: finalizadasOk },
      { Tipo: "RESUMO", Campo: "Canceladas", Valor: canceladas },
      { Tipo: "RESUMO", Campo: "No-show", Valor: noShows },
      { Tipo: "RESUMO", Campo: "Receita realizada", Valor: formatBRL(receitaRealizada) },
      {
        Tipo: "RESUMO",
        Campo: "Receita perdida (cancel/no-show)",
        Valor: `${formatBRL(receitaPerdida)} (${(perdaRate * 100).toFixed(0)}%)`,
      },
      { Tipo: "", Campo: "", Valor: "" },
    ].map((r) => ({
      ...r,
      Valor: r.Valor == null ? " " : String(r.Valor),
      Data: "",
      Dia: "",
      "Início": "",
      Fim: "",
      Esporte: "",
      Status: "",
      "No-show": "",
      "Valor (R$)": "",
      Cliente: "",
      Telefone: "",
      "ID Reserva": "",
    }));

    const cleanText = (v: any) =>
      String(v ?? "")
        .replace(/\u0000/g, "")
        .replace(/^\s*0+\s+/, "")
        .replace(/\s+/g, " ")
        .trim();

    const reservaRows = reservasDaQuadra.map((r) => ({
      Tipo: "RESERVA",
      Campo: "",
      Valor: "'",
      Data: t(r.data ?? ""),
      Dia: t(diaSemana(r.data ?? "")),
      "Início": t(r.horaInicio ?? ""),
      Fim: t(r.horaFim ?? ""),
      Esporte: t(r.esporte ?? ""),
      Status: t(r.status ?? ""),
      "No-show": r.naoCompareceu === true ? "SIM" : "NÃO",
      "Valor (R$)": formatBRL(Number(r.valor ?? 0)),
      Cliente: t(cleanText(r.cliente?.nome)),
      Telefone: t(cleanText(r.cliente?.telefone)),
      "ID Reserva": t(r.id ?? ""),
    }));

    const csv = toCSV([...resumoRows, ...reservaRows], headers, {
      delimiter: ";",
      bom: true,
    });

    const safeName = nomeQuadra
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40);

    const fileName = `RELATORIO_${safeName}_${startISO}_a_${endISO}.csv`;
    downloadTextFile(fileName, csv);
  }

  if (loading) return <p>Carregando usuário...</p>;

  return (
    <>
      <Header />

      <div style={styles.page}>
        <div style={styles.container}>
          <div style={styles.hero}>
            <div style={styles.heroBadge}>Painel do parceiro</div>
            <h1 style={styles.heroTitle}>Bem-vindo, parceiro</h1>
            <p style={styles.heroText}>
              Sua quadra agora faz parte do Quadra Play. Aqui você gerencia reservas,
              acompanha resultados, organiza horários e faz o seu negócio crescer
              dentro da plataforma com mais clareza e controle.
            </p>

            <div style={styles.heroActions}>
              <Link to="/nova-quadra" style={{ textDecoration: "none" }}>
                <button style={styles.heroPrimaryBtn}>➕ Cadastrar nova quadra</button>
              </Link>

              <Link to="/dono/central" style={{ textDecoration: "none" }}>
                <button style={styles.heroSecondaryBtn}>⚙ Abrir central do proprietário</button>
              </Link>
            </div>
          </div>

          <div style={styles.card}>
            <div style={styles.panelHeader}>
              <div>
                <h2 style={styles.sectionTitle}>Resumo do período</h2>
                <p style={styles.sectionText}>
                  Acompanhe o desempenho das suas quadras em <strong>{periodoLabel}</strong>.
                </p>
                <p style={{ ...styles.sectionText, marginTop: 4 }}>
                  Período: <strong>{startISO}</strong> até <strong>{endISO}</strong>{" "}
                  <span style={{ color: "#94a3b8" }}>
                    (comparando com <strong>{periodoPrevLabel}</strong>)
                  </span>
                </p>
              </div>

              <div style={styles.controlsWrap}>
                <select
                  value={mesSel}
                  onChange={(e) => setMesSel(Number(e.target.value))}
                  style={styles.select}
                >
                  {MESES.map((m, idx) => (
                    <option key={m} value={idx}>
                      {m}
                    </option>
                  ))}
                </select>

                <select
                  value={anoSel}
                  onChange={(e) => setAnoSel(Number(e.target.value))}
                  style={styles.select}
                >
                  {anos.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>

                <button
                  onClick={carregarDashboard}
                  disabled={carregandoDash || carregando}
                  style={styles.neutralBtn}
                >
                  {carregandoDash ? "Atualizando..." : "Atualizar painel"}
                </button>
              </div>
            </div>

            {erroDash && (
              <p style={{ color: "#b91c1c", marginTop: 12, whiteSpace: "pre-line", fontWeight: 700 }}>
                {erroDash}
              </p>
            )}

            <div style={styles.metricGrid}>
              <div style={styles.metricCard}>
                <div style={styles.metricLabel}>Receita realizada</div>
                <div style={styles.metricValue}>{formatBRL(dash.receitaRealizada)}</div>
                <div style={styles.metricSub}>
                  Comparação:{" "}
                  <span
                    style={{
                      color:
                        comparativo.diffReceita > 0
                          ? "#15803d"
                          : comparativo.diffReceita < 0
                          ? "#b91c1c"
                          : "#64748b",
                      fontWeight: 900,
                    }}
                  >
                    {formatPct(comparativo.pctReceita)}
                  </span>
                </div>
              </div>

              <div style={styles.metricCard}>
                <div style={styles.metricLabel}>Total de reservas</div>
                <div style={styles.metricValue}>{dash.totalReservas}</div>
                <div style={styles.metricSub}>
                  Comparação:{" "}
                  <span
                    style={{
                      color:
                        comparativo.diffTotal > 0
                          ? "#15803d"
                          : comparativo.diffTotal < 0
                          ? "#b91c1c"
                          : "#64748b",
                      fontWeight: 900,
                    }}
                  >
                    {formatPct(comparativo.pctTotal)}
                  </span>
                </div>
              </div>

              <div style={styles.metricCard}>
                <div style={styles.metricLabel}>Reservas ativas</div>
                <div style={styles.metricValue}>{dash.ativas}</div>
                <div style={styles.metricSub}>Agendadas ou confirmadas no período</div>
              </div>

              <div style={styles.metricCard}>
                <div style={styles.metricLabel}>Receita perdida</div>
                <div style={styles.metricValue}>{formatBRL(dash.receitaPerdida)}</div>
                <div style={styles.metricSub}>Cancelamentos e no-shows</div>
              </div>
            </div>

            <div style={styles.compareBox}>
              <div style={styles.compareTitle}>Comparativo vs mês anterior</div>
              <div style={{ color: "#64748b", fontSize: 14, lineHeight: 1.7 }}>
                Receita atual: <strong>{formatBRL(dash.receitaRealizada)}</strong>{" "}
                | Reservas atuais: <strong>{dash.totalReservas}</strong>{" "}
                | Mês anterior: <strong>{periodoPrevLabel}</strong>
              </div>
            </div>

            <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 14, marginTop: 16 }}>
              <div style={{ fontWeight: 900, color: "#0f172a", marginBottom: 10, fontSize: 18 }}>
                Desempenho por quadra
              </div>

              {carregandoDash && <p style={{ margin: 0, color: "#64748b" }}>Carregando painel…</p>}

              {!carregandoDash && dashPorQuadra.length === 0 && (
                <p style={{ margin: 0, color: "#64748b" }}>
                  Nenhuma reserva encontrada neste período.
                </p>
              )}

              {!carregandoDash && dashPorQuadra.length > 0 && (
                <div style={styles.quadraList}>
                  {dashPorQuadra.map((x) => (
                    <div key={x.quadraId} style={styles.quadraMetricCard}>
                      <div>
                        <div style={styles.quadraName}>
                          {quadraNomePorId[x.quadraId] ?? x.quadraId}
                        </div>

                        <div style={styles.quadraMeta}>
                          Total: <strong>{x.total}</strong> • Ativas:{" "}
                          <span style={styles.green}>{x.ativas}</span> • Canceladas:{" "}
                          <span style={styles.red}>{x.canceladas}</span> • No-show:{" "}
                          <span style={styles.darkRed}>{x.noShows}</span>
                        </div>
                      </div>

                      <div style={styles.revenueBox}>
                        <div style={styles.revenueLabel}>Receita (finalizadas OK)</div>
                        <div style={styles.revenueValue}>{formatBRL(x.receita)}</div>

                        <div style={styles.actionsRow}>
                          <Link to={`/dono/quadra/${x.quadraId}/reservas`}>
                            <button style={styles.smallBlueBtn}>Ver reservas</button>
                          </Link>

                          <button
                            onClick={() => baixarCsvDaQuadra(x.quadraId)}
                            style={styles.smallBtn}
                          >
                            Baixar CSV
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {carregando && (
            <div style={styles.card}>
              <p style={{ margin: 0, color: "#64748b", fontWeight: 700 }}>Carregando quadras...</p>
            </div>
          )}

          {!carregando && (
            <div style={styles.totalBox}>
              Total de quadras cadastradas: <strong>{quadras.length}</strong>
            </div>
          )}

          <div style={styles.quadrasGrid}>
            {quadras.map((q) => (
              <div key={q.id} style={styles.quadraCard}>
                <div style={styles.quadraTop}>
                  <div>
                    <h3 style={styles.quadraTitle}>{q.nome}</h3>
                    <div style={styles.quadraCity}>{q.cidade}</div>
                    {q.endereco && <div style={styles.quadraAddress}>{q.endereco}</div>}
                    {q.ativo === false && <div style={styles.inactiveTag}>Inativa</div>}
                  </div>

                  <div style={styles.quadraActions}>
                    <Link to={`/quadra/${q.id}`}>
                      <button style={styles.smallBtn}>Abrir</button>
                    </Link>

                    <Link to={`/dono/quadra/${q.id}/editar`}>
                      <button style={styles.smallBtn}>Editar</button>
                    </Link>

                    <Link to={`/dono/quadra/${q.id}/reservas`}>
                      <button style={styles.smallBlueBtn}>Ver reservas</button>
                    </Link>

                    <Link to={`/dono/quadra/${q.id}/horarios`}>
                      <button style={styles.smallGreenBtn}>Horários (mês)</button>
                    </Link>
                  </div>
                </div>
              </div>
            ))}

            {!carregando && quadras.length === 0 && (
              <div style={styles.emptyState}>
                <p style={{ margin: 0 }}>
                  Nenhuma quadra encontrada. Use <strong>➕ Cadastrar nova quadra</strong>{" "}
                  para começar a operar no Quadra Play.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}