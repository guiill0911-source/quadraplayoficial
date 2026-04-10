import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import Header from "../../components/Header";
import ConfirmModal from "../../components/ConfirmModal";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";
import { db } from "../../services/firebase";
import {
  cancelarReserva,
  cancelarReservaEBloquearHorario,
  finalizarReservaComoDono,
  finalizarReservasVencidasEmLote,
  setNaoCompareceuComoDono,
  marcarReservaComoPagaComoDono,
  desmarcarPagamentoComoDono,
} from "../../services/reservas";
import { analisarHorariosQuadra } from "../../services/analytics";

type Reserva = {
  id: string;
  quadraId: string;
  esporte: string;
  data: string;
  horaInicio: string;
  horaFim: string;
  valor: number;
  status?: string;

  pagamentoTipo?: "presencial" | "online";
  pagamentoStatus?: "pendente" | "pago" | "isento";
  pagoEm?: any;
  valorPago?: number | null;
  registradoPorUid?: string | null;

  naoCompareceu?: boolean;
  avaliadaEm?: any;

  cliente?: {
    nome?: string;
    telefone?: string | null;
  };
};

const cardStyle = {
  padding: 12,
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  background: "#f8fafc"
};

const ESPORTES_LABELS: Record<string, string> = {
  futsal: "Futsal",
  society_5: "Society 5",
  society_7: "Society 7",
  volei: "Vôlei",
  futevolei: "Futevôlei",
  futmesa: "Futmesa",
  beach_tenis: "Beach Tênis",
};

const styles = {
  page: {
    minHeight: "100vh",
    background:
  "linear-gradient(180deg, #03122e 0px, #053ff9 180px, #f8fafc 180px, #f8fafc 100%)",
    paddingBottom: 40,
  } as const,

  container: {
  width: "100%",
  maxWidth: 1180,
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
    color: "#ffffff",
    fontWeight: 700,
    marginBottom: 16,
  } as const,

  hero: {
    position: "relative" as const,
    overflow: "hidden",
    borderRadius: 28,
    padding: "28px 24px",
    background: "linear-gradient(135deg, #053ff9, #2563eb)",
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

  gridTop: {
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
    color: "#03122e",
    letterSpacing: -0.3,
  } as const,

  helper: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.5,
  } as const,

  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
  } as const,

  statCard: {
    borderRadius: 18,
    padding: 16,
    border: "1px solid #e2e8f0",
    background: "#ffffff",
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
    margin: "8px 0 0",
    fontSize: 30,
    fontWeight: 900,
    lineHeight: 1,
    color: "#03122e",
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
  minWidth: 220,
  flexShrink: 0,
} as const,

  label: {
    fontSize: 13,
    fontWeight: 800,
    color: "#334155",
  } as const,

  input: {
  width: 220,
  borderRadius: 14,
  border: "1px solid #cbd5e1",
  background: "#fff",
  padding: "12px 14px",
  fontSize: 14,
  outline: "none",
  color: "#0f172a",
  boxSizing: "border-box" as const,
} as const,

  greenBtn: {
    border: "none",
    borderRadius: 14,
    background: "#8ae809",
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

  alertOk: {
    marginTop: 16,
    border: "1px solid #bbf7d0",
    background: "#f0fdf4",
    color: "#166534",
    borderRadius: 16,
    padding: 14,
  } as const,

  list: {
    display: "grid",
    gap: 14,
    marginTop: 18,
  } as const,

  reservaCard: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 24,
    padding: 18,
    boxShadow: "0 12px 28px rgba(15, 23, 42, 0.05)",
  } as const,

  reservaTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap" as const,
    alignItems: "flex-start",
  } as const,

  reservaTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 900,
    color: "#03122e",
    letterSpacing: -0.2,
  } as const,

  reservaSub: {
    margin: "6px 0 0",
    color: "#475569",
    fontSize: 14,
    lineHeight: 1.5,
  } as const,

  chipsRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap" as const,
    alignItems: "center",
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

  infoGrid: {
  marginTop: 14,
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: 10,
} as const,

  infoBox: {
    borderRadius: 18,
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    padding: 14,
  } as const,

  infoLabel: {
    margin: 0,
    fontSize: 12,
    fontWeight: 800,
    color: "#64748b",
    textTransform: "uppercase" as const,
    letterSpacing: 0.4,
  } as const,

  infoValue: {
    margin: "8px 0 0",
    fontSize: 15,
    fontWeight: 800,
    color: "#0f172a",
    lineHeight: 1.45,
  } as const,

  actionGroup: {
  marginTop: 16,
  display: "flex",
  flexDirection: "column" as const,
  gap: 10,
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

function formatBRL(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function isAtiva(status: any) {
  return status === "agendada" || status === "confirmada";
}

function inRangeISO(dateISO: string, startISO: string, endISO: string) {
  if (!dateISO) return false;
  if (startISO && dateISO < startISO) return false;
  if (endISO && dateISO > endISO) return false;
  return true;
}

function labelPagamento(r: Reserva) {
  const st = String(r.pagamentoStatus ?? "pendente").toLowerCase().trim();
  if (st === "pago") {
    return {
      text: "PAGO",
      color: "#166534",
      bg: "#ecfdf3",
      border: "#bbf7d0",
    };
  }
  if (st === "isento") {
    return {
      text: "ISENTO",
      color: "#475569",
      bg: "#f8fafc",
      border: "#cbd5e1",
    };
  }
  return {
    text: "PENDENTE",
    color: "#b91c1c",
    bg: "#fef2f2",
    border: "#fecaca",
  };
}

function labelStatusReserva(r: Reserva) {
  const st = String(r.status ?? "").toLowerCase().trim();

  if (r.naoCompareceu) {
    return {
      text: "Não compareceu",
      color: "#991b1b",
      bg: "#fef2f2",
      border: "#fecaca",
    };
  }

  if (st === "cancelada") {
    return {
      text: "Cancelada",
      color: "#991b1b",
      bg: "#fff1f2",
      border: "#fecdd3",
    };
  }

  if (st === "finalizada") {
    return {
      text: "Finalizada",
      color: "#0f766e",
      bg: "#ecfeff",
      border: "#a5f3fc",
    };
  }

  if (st === "confirmada" || st === "agendada") {
    return {
      text: "Ativa",
      color: "#1d4ed8",
      bg: "#eff6ff",
      border: "#bfdbfe",
    };
  }

  return {
    text: r.status ?? "—",
    color: "#334155",
    bg: "#f8fafc",
    border: "#cbd5e1",
  };
}

export default function DonoReservasQuadra() {
  const { id } = useParams<{ id: string }>();
  const [sp] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [msg, setMsg] = useState<string>("");
  const [rankingHorarios, setRankingHorarios] = useState<
  { hora: string; totalReservas: number }[]
>([]);

  const [cancelandoId, setCancelandoId] = useState<string>("");
  const [bloqueandoId, setBloqueandoId] = useState<string>("");
  const [finalizandoId, setFinalizandoId] = useState<string>("");
  const [noShowId, setNoShowId] = useState<string>("");
  const [pagandoId, setPagandoId] = useState<string>("");
  const [aprovandoPixDevId, setAprovandoPixDevId] = useState<string>("");

  const [confirmData, setConfirmData] = useState<{
  mensagem: string;
  onConfirm: () => Promise<void>;
} | null>(null);

  const [dataFiltro, setDataFiltro] = useState("");

  const startParam = sp.get("start") ?? "";
  const endParam = sp.get("end") ?? "";
  const tipoParam = sp.get("tipo") ?? "";

  async function carregar() {
    if (!id) return;

    setLoading(true);
    setErro(null);
    setMsg("");

    try {
      const col = collection(db, "reservas");
      const q = query(col, where("quadraId", "==", id));
      const snap = await getDocs(q);

      const lista: Reserva[] = [];
      snap.forEach((d) => lista.push({ id: d.id, ...(d.data() as any) }));

      const resultado = await finalizarReservasVencidasEmLote(lista);

      if (resultado.finalizadas > 0) {
        const snap2 = await getDocs(q);
        const lista2: Reserva[] = [];
        snap2.forEach((d) => lista2.push({ id: d.id, ...(d.data() as any) }));
        setReservas(lista2);
      } else {
        setReservas(lista);
      }
    } catch (e) {
      console.error(e);
      setErro("Erro ao carregar reservas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

useEffect(() => {
  if (!id) return;

  const quadraId = id;

  async function loadAnalytics() {
    const data = await analisarHorariosQuadra(quadraId);
    setRankingHorarios(data);
  }

  loadAnalytics();
}, [id]);

console.log("RANKING:", rankingHorarios);

  const reservasFiltradas = useMemo(() => {
    let lista = reservas.slice();

    if (startParam || endParam) {
      lista = lista.filter((r) => inRangeISO(r.data, startParam, endParam));
    }

    if (dataFiltro) {
      lista = lista.filter((r) => r.data === dataFiltro);
    }

    if (tipoParam && tipoParam !== "todas") {
      if (tipoParam === "noshow") {
        lista = lista.filter((r) => r.naoCompareceu === true);
      } else if (tipoParam === "canceladas") {
        lista = lista.filter((r) => r.status === "cancelada");
      } else if (tipoParam === "perdidas") {
        lista = lista.filter(
          (r) => r.status === "cancelada" || r.naoCompareceu === true
        );
      }
    }

    lista.sort((a, b) =>
      `${a.data} ${a.horaInicio}`.localeCompare(`${b.data} ${b.horaInicio}`)
    );

    return lista;
  }, [reservas, dataFiltro, startParam, endParam, tipoParam]);

  async function onCancelar(r: Reserva) {
    if (!isAtiva(r.status)) return;

    setConfirmData({
  mensagem: `Cancelar reserva?\n\n${r.data} ${r.horaInicio}–${r.horaFim}`,
  onConfirm: async () => {
    try {
      setErro(null);
      setMsg("");
      setCancelandoId(r.id);

      await cancelarReserva({ reservaId: r.id, bypassClienteUidCheck: true });

      await carregar();
      setMsg("Reserva cancelada e horário liberado.");
    } catch (e: any) {
      console.error(e);
      setErro(e?.message ?? "Erro ao cancelar.");
    } finally {
      setCancelandoId("");
    }
  },
});

return;
  }

  async function onCancelarEBloquear(r: Reserva) {
    if (!isAtiva(r.status)) return;

    setConfirmData({
  mensagem: `Cancelar E BLOQUEAR horário?\n\n${r.data} ${r.horaInicio}–${r.horaFim}`,
  onConfirm: async () => {
    try {
      setErro(null);
      setMsg("");
      setBloqueandoId(r.id);

      await cancelarReservaEBloquearHorario({ reservaId: r.id });

      await carregar();
      setMsg("Reserva cancelada e horário bloqueado.");
    } catch (e: any) {
      console.error(e);
      setErro(e?.message ?? "Erro ao bloquear.");
    } finally {
      setBloqueandoId("");
    }
  },
});

return;
  }

  async function onFinalizarManual(r: Reserva) {
    if (!isAtiva(r.status)) return;

    setConfirmData({
  mensagem: `FINALIZAR manualmente?\n\n${r.data} ${r.horaInicio}–${r.horaFim}`,
  onConfirm: async () => {
    try {
      setErro(null);
      setMsg("");
      setFinalizandoId(r.id);

      await finalizarReservaComoDono({ reservaId: r.id, naoCompareceu: false });

      await carregar();
      setMsg("Reserva finalizada ✅");
    } catch (e: any) {
      console.error(e);
      setErro(e?.message ?? "Erro ao finalizar.");
    } finally {
      setFinalizandoId("");
    }
  },
});

return;
  }

  async function onToggleNoShow(r: Reserva, marcar: boolean) {
   setConfirmData({
  mensagem: `${marcar ? "MARCAR" : "DESFAZER"} NÃO COMPARECEU?\n\n${r.data} ${
    r.horaInicio
  }–${r.horaFim}\nCliente: ${r.cliente?.nome ?? "—"}`,
  onConfirm: async () => {
    try {
      setErro(null);
      setMsg("");
      setNoShowId(r.id);

      await setNaoCompareceuComoDono({ reservaId: r.id, naoCompareceu: marcar });

      await carregar();
      setMsg(marcar ? "Marcado como não compareceu ✅" : "No-show desfeito ✅");
    } catch (e: any) {
      console.error(e);
      setErro(e?.message ?? "Erro ao marcar no-show.");
    } finally {
      setNoShowId("");
    }
  },
});

return;
  }

  async function onMarcarPago(r: Reserva) {
    setConfirmData({
  mensagem: `Marcar como PAGO?\n\n${r.data} ${r.horaInicio}–${r.horaFim}\nCliente: ${
    r.cliente?.nome ?? "—"
  }\nValor: ${formatBRL(Number(r.valor ?? 0))}`,
  onConfirm: async () => {
    try {
      setErro(null);
      setMsg("");
      setPagandoId(r.id);

      await marcarReservaComoPagaComoDono({ reservaId: r.id });

      await carregar();
      setMsg("Pagamento marcado como PAGO ✅");
    } catch (e: any) {
      console.error(e);
      setErro(e?.message ?? "Erro ao marcar pagamento.");
    } finally {
      setPagandoId("");
    }
  },
});

return;
  }

  async function onDesmarcarPago(r: Reserva) {
    setConfirmData({
  mensagem: `Desmarcar pagamento (voltar para PENDENTE)?\n\n${r.data} ${r.horaInicio}–${r.horaFim}`,
  onConfirm: async () => {
    try {
      setErro(null);
      setMsg("");
      setPagandoId(r.id);

      await desmarcarPagamentoComoDono(r.id);

      await carregar();
      setMsg("Pagamento voltou para PENDENTE ✅");
    } catch (e: any) {
      console.error(e);
      setErro(e?.message ?? "Erro ao desmarcar pagamento.");
    } finally {
      setPagandoId("");
    }
  },
});

return;
  }

  async function onMarcarPagoDEV(r: Reserva) {
   setConfirmData({
  mensagem: `✅ DEV — Forçar PAGO?\n\n${r.data} ${r.horaInicio}–${r.horaFim}\nValor: ${formatBRL(
    Number(r.valor ?? 0)
  )}`,
  onConfirm: async () => {
    try {
      setErro(null);
      setMsg("");
      setPagandoId(r.id);

      const uid = getAuth().currentUser?.uid;
      if (!uid) throw new Error("Usuário não autenticado.");

      await updateDoc(doc(db, "reservas", r.id), {
        pagamentoStatus: "pago",
        pagoEm: serverTimestamp(),
        valorPago: Number(r.valor ?? 0),
        registradoPorUid: uid,
        mpStatus: "manual_dev",
        mpUltimaNotificacaoEm: serverTimestamp(),
      } as any);

      await carregar();
      setMsg("✅ DEV: pagamento marcado como PAGO.");
    } catch (e: any) {
      console.error(e);
      setErro(e?.message ?? "Erro no DEV: marcar como pago.");
    } finally {
      setPagandoId("");
    }
  },
});

return;
  }

  async function onDesmarcarPagoDEV(r: Reserva) {
setConfirmData({
  mensagem: `✅ DEV — Voltar para PENDENTE?\n\n${r.data} ${r.horaInicio}–${r.horaFim}`,
  onConfirm: async () => {
    try {
      setErro(null);
      setMsg("");
      setPagandoId(r.id);

      const uid = getAuth().currentUser?.uid;
      if (!uid) throw new Error("Usuário não autenticado.");

      await updateDoc(doc(db, "reservas", r.id), {
        pagamentoStatus: "pendente",
        pagoEm: null,
        valorPago: null,
        registradoPorUid: uid,
        mpStatus: "manual_dev_pendente",
        mpUltimaNotificacaoEm: serverTimestamp(),
      } as any);

      await carregar();
      setMsg("✅ DEV: pagamento voltou para PENDENTE.");
    } catch (e: any) {
      console.error(e);
      setErro(e?.message ?? "Erro no DEV: desmarcar pagamento.");
    } finally {
      setPagandoId("");
    }
  },
});

return;
  }

  async function onAprovarPixDEV(r: Reserva) {
   setConfirmData({
  mensagem:
    `✅ DEV — Simular APROVAÇÃO PIX (devApprovePix)?\n\nReserva: ${
      r.id
    }\n${r.data} ${r.horaInicio}–${r.horaFim}\nValor: ${formatBRL(
      Number(r.valor ?? 0)
    )}\n\nIsso vai marcar mpStatus=approved e pagamentoStatus=pago.`,
  onConfirm: async () => {
    try {
      setErro(null);
      setMsg("");
      setAprovandoPixDevId(r.id);

      const functions = getFunctions();
      const fn = httpsCallable(functions, "devApprovePix");

      await fn({ reservaId: r.id });

      await carregar();
      setMsg("✅ DEV: PIX aprovado (simulado) e pagamento marcado como PAGO.");
    } catch (e: any) {
      console.error(e);
      setErro(e?.message ?? e?.details ?? "Erro ao aprovar PIX (DEV).");
    } finally {
      setAprovandoPixDevId("");
    }
  },
});

return;
  }

  const cont = useMemo(() => {
    const ativas = reservasFiltradas.filter((r) => isAtiva(r.status)).length;
    const canceladas = reservasFiltradas.filter(
      (r) => r.status === "cancelada"
    ).length;
    const finalizadas = reservasFiltradas.filter(
      (r) => r.status === "finalizada" && !r.naoCompareceu
    ).length;
    const naoCompareceu = reservasFiltradas.filter(
      (r) => r.naoCompareceu === true
    ).length;

    return { ativas, canceladas, finalizadas, naoCompareceu };
  }, [reservasFiltradas]);

  const subtitle = useMemo(() => {
    const parts: string[] = [];
    if (startParam || endParam) {
      parts.push(`Período: ${startParam || "—"} → ${endParam || "—"}`);
    }
    if (tipoParam && tipoParam !== "todas") {
      parts.push(`Filtro: ${tipoParam}`);
    }
    if (dataFiltro) {
      parts.push(`Dia: ${dataFiltro}`);
    }
    return parts.join(" • ");
  }, [startParam, endParam, tipoParam, dataFiltro]);

  const isDev = import.meta.env.DEV;

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
              <div style={styles.heroBadge}>GESTÃO DE RESERVAS</div>

              <h1 style={styles.heroTitle}>Reservas da quadra</h1>

              <p style={styles.heroText}>
                Controle reservas, finalize partidas, marque pagamentos,
                gerencie no-show e mantenha a operação da sua quadra organizada
                em um só lugar.
              </p>

              <div style={styles.heroBottomRow}>
                <div style={styles.statPill}>
                  <span>Ativas</span>
                  <strong>{cont.ativas}</strong>
                </div>
                <div style={styles.statPill}>
                  <span>Canceladas</span>
                  <strong>{cont.canceladas}</strong>
                </div>
                <div style={styles.statPill}>
                  <span>Finalizadas</span>
                  <strong>{cont.finalizadas}</strong>
                </div>
                <div style={styles.statPill}>
                  <span>No-show</span>
                  <strong>{cont.naoCompareceu}</strong>
                </div>
              </div>
            </div>
          </section>

          <div style={styles.gridTop}>
            <section style={styles.card}>
              <div style={styles.cardBody}>
                <h2 style={styles.sectionTitle}>Filtros e atualização</h2>
                <p style={styles.helper}>
                  Filtre por dia, reaplique os dados e visualize rapidamente o
                  recorte atual da sua agenda.
                </p>

                <div style={{
  display: "flex",
  alignItems: "flex-end",
  gap: 12,
  flexWrap: "wrap"
}}>
  <div style={styles.field}>
    <label style={styles.label}>Filtrar por dia</label>
    <input
      type="date"
      value={dataFiltro}
      onChange={(e) => setDataFiltro(e.target.value)}
      style={styles.input}
    />
  </div>

  <button
    onClick={carregar}
    disabled={loading}
    style={styles.greenBtn}
  >
    {loading ? "Atualizando..." : "Atualizar agora"}
  </button>

  {dataFiltro && (
    <button
      onClick={() => setDataFiltro("")}
      style={styles.neutralBtn}
    >
      Limpar dia
    </button>
  )}
</div>

                {subtitle ? (
                  <div
                    style={{
                      marginTop: 14,
                      padding: 14,
                      borderRadius: 16,
                      background: "#ffffff",
                      border: "1px solid #e2e8f0",
                      color: "#475569",
                      fontWeight: 700,
                      lineHeight: 1.5,
                    }}
                  >
                    {subtitle}
                  </div>
                ) : null}

                {erro && <div style={styles.alertError}>{erro}</div>}
                {msg && !erro && <div style={styles.alertOk}>{msg}</div>}
              </div>
            </section>

            <aside style={styles.card}>
              <div style={styles.cardBody}>
                <h2 style={styles.sectionTitle}>Resumo rápido</h2>
                <p style={styles.helper}>
                  Visão compacta do estado atual das reservas filtradas.
                </p>

                <div style={{ marginTop: 16, ...styles.statsGrid }}>
                  <div style={styles.statCard}>
                    <p style={styles.statLabel}>Ativas</p>
                    <p style={{ ...styles.statValue, color: "#16a34a" }}>
                      {cont.ativas}
                    </p>
                  </div>



                  <div style={styles.statCard}>
                    <p style={styles.statLabel}>Canceladas</p>
                    <p style={{ ...styles.statValue, color: "#dc2626" }}>
                      {cont.canceladas}
                    </p>
                  </div>

                  <div style={styles.statCard}>
                    <p style={styles.statLabel}>Finalizadas</p>
                    <p style={{ ...styles.statValue, color: "#0f172a" }}>
                      {cont.finalizadas}
                    </p>
                  </div>

                  <div style={styles.statCard}>
                    <p style={styles.statLabel}>Não compareceu</p>
                    <p style={{ ...styles.statValue, color: "#b91c1c" }}>
                      {cont.naoCompareceu}
                    </p>
                  </div>
                </div>
              </div>
            </aside>
          </div>

          <div style={{
  marginTop: 20,
  padding: 16,
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  background: "#f8fafc"
}}>
  <h3 style={{ marginBottom: 10 }}>🔥 Horários mais vendidos</h3>

  {rankingHorarios.length === 0 && (
    <p style={{ color: "#64748b" }}>Sem dados ainda.</p>
  )}

 {(() => {
  const top = rankingHorarios.slice(0, 3);
  const medio = rankingHorarios.slice(3, 6);
  const baixo = rankingHorarios.slice(-3);

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
      gap: 16,
      marginTop: 10
    }}>

      <div style={cardStyle}>
        <h4>🔥 Alta ocupação</h4>
        {top.map(h => (
          <div key={h.hora}>
           {(() => {
  const total = rankingHorarios.reduce((acc, item) => acc + item.totalReservas, 0);
  const porcentagem = total > 0 ? Math.round((h.totalReservas / total) * 100) : 0;

  return `${h.hora} — ${h.totalReservas} (${porcentagem}%)`;
})()}
          </div>
        ))}
      </div>

      <div style={cardStyle}>
        <h4>⚖️ Média ocupação</h4>
        {medio.map(h => (
          <div key={h.hora}>
            {(() => {
  const total = rankingHorarios.reduce((acc, item) => acc + item.totalReservas, 0);
  const porcentagem = total > 0 ? Math.round((h.totalReservas / total) * 100) : 0;

  return `${h.hora} — ${h.totalReservas} (${porcentagem}%)`;
})()}
          </div>
        ))}
      </div>

      <div style={cardStyle}>
        <h4>❄️ Baixa ocupação</h4>
        {baixo.map(h => (
          <div key={h.hora}>
            {(() => {
  const total = rankingHorarios.reduce((acc, item) => acc + item.totalReservas, 0);
  const porcentagem = total > 0 ? Math.round((h.totalReservas / total) * 100) : 0;

  return `${h.hora} — ${h.totalReservas} (${porcentagem}%)`;
})()}
          </div>
        ))}
      </div>

    </div>
  );
})()}
</div>

          <section style={styles.list}>
            {reservasFiltradas.map((r) => {
              const ativa = isAtiva(r.status);

              const travado =
                cancelandoId === r.id ||
                bloqueandoId === r.id ||
                finalizandoId === r.id ||
                noShowId === r.id ||
                pagandoId === r.id ||
                aprovandoPixDevId === r.id;

              const podeMexerResultado = !r.avaliadaEm;
              const p = labelPagamento(r);
              const s = labelStatusReserva(r);

              const pago =
                String(r.pagamentoStatus ?? "pendente")
                  .toLowerCase()
                  .trim() === "pago";

              const pagamentoTipo = String(r.pagamentoTipo ?? "presencial");

              return (
                <article key={r.id} style={styles.reservaCard}>
                  <div style={styles.reservaTop}>
                    <div>
                      <h3 style={styles.reservaTitle}>
                        {r.data} • {r.horaInicio} → {r.horaFim}
                      </h3>
                      <p style={styles.reservaSub}>
                        {ESPORTES_LABELS[r.esporte] ?? r.esporte} •{" "}
                        {formatBRL(Number(r.valor ?? 0))}
                      </p>
                    </div>

                    <div style={styles.chipsRow}>
                      <span
                        style={{
                          ...styles.chip,
                          background: s.bg,
                          color: s.color,
                          border: `1px solid ${s.border}`,
                        }}
                      >
                        {s.text}
                      </span>

                      <span
                        style={{
                          ...styles.chip,
                          background: p.bg,
                          color: p.color,
                          border: `1px solid ${p.border}`,
                        }}
                        title="Status de pagamento"
                      >
                        Pagamento: {p.text}
                      </span>

                      {!podeMexerResultado && (
                        <span style={styles.chip}>Já avaliada</span>
                      )}
                    </div>
                  </div>

                  <div style={styles.infoGrid}>
                    <div style={styles.infoBox}>
                      <p style={styles.infoLabel}>Cliente</p>
                      <p style={styles.infoValue}>{r.cliente?.nome ?? "—"}</p>
                    </div>

                    <div style={styles.infoBox}>
                      <p style={styles.infoLabel}>Telefone</p>
                      <p style={styles.infoValue}>
                        {r.cliente?.telefone ?? "Não informado"}
                      </p>
                    </div>

                    <div style={styles.infoBox}>
                      <p style={styles.infoLabel}>Pagamento</p>
                      <p style={styles.infoValue}>
                        {pagamentoTipo === "online"
                          ? "Pelo aplicativo"
                          : "Presencial"}
                      </p>
                    </div>
                  </div>

                  <div style={styles.actionGroup}>
                    {r.status !== "cancelada" && (
                      <>
                        {pagamentoTipo === "online" ? (
                          <span
                            style={{
                              ...styles.chip,
                              background: "#eff6ff",
                              color: "#1d4ed8",
                              border: "1px solid #bfdbfe",
                            }}
                          >
                            Pagamento automático no app
                          </span>
                        ) : null}


                        {pagamentoTipo !== "online" && (
                          <>
                            {!pago ? (
                              <button
                                onClick={() => onMarcarPago(r)}
                                disabled={travado}
                                style={styles.greenBtn}
                              >
                                {pagandoId === r.id
                                  ? "Salvando..."
                                  : "Marcar como pago"}
                              </button>
                            ) : (
                              <button
                                onClick={() => onDesmarcarPago(r)}
                                disabled={travado}
                                style={styles.neutralBtn}
                              >
                                {pagandoId === r.id
                                  ? "Salvando..."
                                  : "Desmarcar pagamento"}
                              </button>
                            )}
                          </>
                        )}
                      </>
                    )}

                    {ativa && (
                      <>
                        <button
                          onClick={() => onCancelar(r)}
                          disabled={travado}
                          style={styles.neutralBtn}
                        >
                          {cancelandoId === r.id
                            ? "Cancelando..."
                            : "Cancelar e liberar"}
                        </button>

                        <button
                          onClick={() => onCancelarEBloquear(r)}
                          disabled={travado}
                          style={styles.darkGhostBtn}
                        >
                          {bloqueandoId === r.id
                            ? "Bloqueando..."
                            : "Cancelar e bloquear"}
                        </button>

                        <button
                          onClick={() => onFinalizarManual(r)}
                          disabled={travado || !podeMexerResultado}
                          style={styles.greenBtn}
                        >
                          {finalizandoId === r.id
                            ? "Salvando..."
                            : "Finalizar manual"}
                        </button>
                      </>
                    )}

                    {r.status === "finalizada" && podeMexerResultado && (
                      <>
                        {!r.naoCompareceu ? (
                          <button
                            onClick={() => onToggleNoShow(r, true)}
                            disabled={travado}
                            style={{
                              ...styles.neutralBtn,
                              border: "1px solid #ef4444",
                              color: "#b91c1c",
                            }}
                          >
                            {noShowId === r.id
                              ? "Salvando..."
                              : "Marcar não compareceu"}
                          </button>
                        ) : (
                          <button
                            onClick={() => onToggleNoShow(r, false)}
                            disabled={travado}
                            style={styles.neutralBtn}
                          >
                            {noShowId === r.id
                              ? "Salvando..."
                              : "Desfazer não compareceu"}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </article>
              );
            })}

            {!loading && reservasFiltradas.length === 0 && (
              <div style={styles.emptyBox}>Nenhuma reserva encontrada.</div>
            )}
          </section>
        </div>
      </div>
            <ConfirmModal
        open={!!confirmData}
        title="Confirmar ação"
        message={confirmData?.mensagem ?? ""}
        confirmText="Confirmar"
        cancelText="Voltar"
        onConfirm={async () => {
          if (!confirmData) return;
          await confirmData.onConfirm();
          setConfirmData(null);
        }}
        onCancel={() => setConfirmData(null)}
      />
    </>
  );
}
