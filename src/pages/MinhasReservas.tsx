import { useEffect, useMemo, useState } from "react";
import Header from "../components/Header";
import { useAuth } from "../services/authContext";
import { db } from "../services/firebase";
import { cancelarReserva } from "../services/reservas";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { Link } from "react-router-dom";

type Reserva = {
  id: string;
  quadraId: string;
  quadraNome?: string;
  esporte?: string;
  data: string;
  horaInicio: string;
  horaFim: string;
  valor?: number;
  status?: string;

  createdAt?: any;
  startAt?: any;

  clienteUid?: string;
};

type ContaStatus = {
  suspenso: boolean;
  suspensoAte: any | null;
  suspensoMotivo: string | null;
  multaPendenteCentavos: number;
  multaQuitadaEm: any | null;
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
    maxWidth: 1100,
    margin: "0 auto",
    padding: "20px 16px 32px",
    boxSizing: "border-box",
  } as const,

  hero: {
    position: "relative" as const,
    overflow: "hidden",
    borderRadius: 28,
    padding: "20px 16px",
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
    fontSize: "clamp(22px, 3.5vw, 28px)",
    lineHeight: 1.05,
    fontWeight: 900,
    letterSpacing: -0.6,
    maxWidth: 760,
  } as const,

  heroText: {
    margin: "12px 0 0",
    maxWidth: 760,
    fontSize: 13,
    lineHeight: 1.4,
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
    padding: "6px 10px",
    borderRadius: 16,
    background: "rgba(255,255,255,0.14)",
    border: "1px solid rgba(255,255,255,0.18)",
    fontSize: 11,
    fontWeight: 700,
  } as const,

  block: {
    marginTop: 18,
  } as const,

  card: {
  background: "rgba(255,255,255,0.8)",
  backdropFilter: "blur(6px)",
    border: "1px solid #e2e8f0",
    borderRadius: 24,
    boxShadow: "0 14px 34px rgba(15, 23, 42, 0.06)",
  } as const,

  cardBody: {
    padding: 18,
  } as const,

  sectionTitle: {
    margin: 0,
    fontSize: 20,
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

  alertDanger: {
    border: "1px solid #fecaca",
    background: "#fff1f2",
    color: "#991b1b",
    borderRadius: 18,
    padding: 16,
  } as const,

  alertDangerTitle: {
    margin: 0,
    fontSize: 17,
    fontWeight: 900,
    color: "#991b1b",
  } as const,

  alertDangerText: {
    margin: "8px 0 0",
    lineHeight: 1.55,
    fontSize: 14,
  } as const,

  greenBtn: {
    border: "none",
    borderRadius: 14,
    background: "linear-gradient(135deg, #8ae809 0%, #6fd307 100%)",
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

  dangerBtn: {
    border: "none",
    borderRadius: 14,
    background: "linear-gradient(135deg, #b91c1c 0%, #dc2626 100%)",
    color: "#fff",
    padding: "12px 16px",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 10px 24px rgba(220, 38, 38, 0.22)",
  } as const,

  infoGrid: {
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
    fontSize: 18,
    fontWeight: 900,
    lineHeight: 1.05,
    color: "#0f172a",
    letterSpacing: -0.5,
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

  list: {
    display: "grid",
    gap: 14,
    marginTop: 14,
  } as const,

  reservaCard: {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 24,
    padding: 18,
    boxShadow: "0 12px 28px rgba(15, 23, 42, 0.05)",
  } as const,

  reservaCardHighlight: {
    background: "linear-gradient(180deg, #f0fdf4 0%, #ffffff 100%)",
    border: "2px solid #22c55e",
    borderRadius: 24,
    padding: 18,
    boxShadow: "0 14px 30px rgba(34, 197, 94, 0.10)",
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
    color: "#0f172a",
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

  infoBoxes: {
    marginTop: 14,
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 12,
  } as const,

  infoBox: {
    borderRadius: 18,
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
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

  actions: {
    marginTop: 16,
    display: "flex",
    gap: 10,
    flexWrap: "wrap" as const,
  } as const,

  modalBackdrop: {
    position: "fixed" as const,
    inset: 0,
    background: "rgba(15,23,42,0.55)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    padding: 16,
  },

  modalCard: {
    width: "min(560px, 100%)",
    background: "#fff",
    borderRadius: 24,
    border: "1px solid #e2e8f0",
    boxShadow: "0 20px 60px rgba(15, 23, 42, 0.25)",
    overflow: "hidden",
  } as const,

  modalHeader: {
    padding: "20px 20px 14px",
    borderBottom: "1px solid #e2e8f0",
  } as const,

  modalTitle: {
    margin: 0,
    fontSize: 22,
    fontWeight: 900,
    color: "#0f172a",
  } as const,

  modalText: {
    margin: "8px 0 0",
    color: "#64748b",
    lineHeight: 1.55,
    fontSize: 14,
  } as const,

  modalBody: {
    padding: 20,
  } as const,

  qrWrap: {
    display: "flex",
    justifyContent: "center",
    marginBottom: 14,
  } as const,

  textarea: {
    width: "100%",
    height: 120,
    padding: 12,
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    background: "#fff",
    resize: "none" as const,
    fontSize: 14,
    color: "#0f172a",
  } as const,

  noteBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    background: "#f8fafc",
    color: "#475569",
    fontSize: 14,
    lineHeight: 1.5,
    border: "1px solid #e2e8f0",
  } as const,

  modalActions: {
    display: "flex",
    gap: 10,
    justifyContent: "flex-end",
    marginTop: 14,
    flexWrap: "wrap" as const,
  } as const,
};

function formatBRL(n: number) {
  return Number(n ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function parseLocalDate(dataYYYYMMDD: string, hhmm: string) {
  const [y, m, d] = dataYYYYMMDD.split("-").map(Number);
  const [h, min] = hhmm.split(":").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, h ?? 0, min ?? 0, 0, 0);
}

function toMs(ts: any): number | null {
  if (ts && typeof ts.toMillis === "function") return ts.toMillis();
  return null;
}

function startAtMs(r: any): number | null {
  return (
    toMs(r?.startAt) ??
    (r?.data && r?.horaInicio ? parseLocalDate(r.data, r.horaInicio).getTime() : null)
  );
}

function formatDateTimeBRFromTs(ts: any): string | null {
  if (!ts || typeof ts?.toDate !== "function") return null;
  const d = ts.toDate() as Date;
  return d.toLocaleString("pt-BR");
}

function isReservaUltimaHora(r: any) {
  const s = startAtMs(r);
  const createdAtMs = toMs(r?.createdAt);

  if (!s || !createdAtMs) return false;

  const antecedencia = s - createdAtMs;
  return antecedencia <= 2 * 60 * 60 * 1000;
}

function isAtiva(status: any) {
  return status === "confirmada" || status === "agendada";
}

function isFinalizada(status: any) {
  return status === "finalizada";
}

function tituloStatus(status?: string) {
  if (status === "confirmada") return "Confirmada";
  if (status === "agendada") return "Agendada";
  if (status === "finalizada") return "Finalizada";
  if (status === "cancelada") return "Cancelada";
  return status ?? "—";
}

function getMensagemBloqueioProfissional(conta: ContaStatus) {
  const valorMulta = formatBRL((conta.multaPendenteCentavos ?? 0) / 100);
  const ateFormatado = formatDateTimeBRFromTs(conta.suspensoAte);

  if ((conta.multaPendenteCentavos ?? 0) > 0) {
    return {
      titulo: "Conta temporariamente bloqueada",
      descricao: `Sua conta foi bloqueada por excesso de no-shows nos últimos 90 dias. Para voltar a reservar, quite sua multa pendente de ${valorMulta}.`,
      detalhe: ateFormatado
        ? `Bloqueio registrado até ${ateFormatado}, com liberação automática após a quitação.`
        : `A liberação acontece automaticamente após o pagamento da multa.`,
    };
  }

  return {
    titulo: "Conta temporariamente bloqueada",
    descricao:
      "Sua conta está temporariamente indisponível para novas reservas. Atualize a página em alguns segundos ou entre em contato com o suporte, se necessário.",
    detalhe: ateFormatado ? `Bloqueio registrado até ${ateFormatado}.` : null,
  };
}

function statusVisual(status?: string) {
  const s = String(status ?? "").toLowerCase().trim();

  if (s === "cancelada") {
    return {
      text: "Cancelada",
      color: "#991b1b",
      bg: "#fef2f2",
      border: "#fecaca",
    };
  }

  if (s === "finalizada") {
    return {
      text: "Finalizada",
      color: "#0f766e",
      bg: "#ecfeff",
      border: "#a5f3fc",
    };
  }

  if (s === "confirmada" || s === "agendada") {
    return {
      text: tituloStatus(status),
      color: "#1d4ed8",
      bg: "#eff6ff",
      border: "#bfdbfe",
    };
  }

  return {
    text: status ?? "—",
    color: "#334155",
    bg: "#f8fafc",
    border: "#cbd5e1",
  };
}

export default function MinhasReservas() {
  const { user, loading } = useAuth();
  const tituloPagina =
  user?.role === "dono"
    ? "Reservas marcadas por mim"
    : "Minhas reservas";

  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [pixModalOpen, setPixModalOpen] = useState(false);
  const [pixData, setPixData] = useState<{
    copiaCola: string;
    qrBase64?: string;
    valorCentavos?: number;
  } | null>(null);

  const [cancelandoId, setCancelandoId] = useState<string>("");
  const [carregandoMulta, setCarregandoMulta] = useState(false);

  const [confirmData, setConfirmData] = useState<{
  mensagem: string;
  onConfirm: () => Promise<void>;
} | null>(null);

const [toast, setToast] = useState<{
  type: "success" | "error";
  message: string;
} | null>(null);

  const [contaStatus, setContaStatus] = useState<ContaStatus>({
    suspenso: false,
    suspensoAte: null,
    suspensoMotivo: null,
    multaPendenteCentavos: 0,
    multaQuitadaEm: null,
  });

  async function carregarContaStatus(uid: string) {
    const userRef = doc(db, "users", uid);
    const snap = await getDoc(userRef);
    const data = snap.exists() ? (snap.data() as any) : {};

    const suspensoAte = data?.suspensoAte ?? null;
    const multaPendenteCentavos = Number(data?.multaPendenteCentavos ?? 0);
    const suspensoMotivo = data?.suspensoMotivo ? String(data.suspensoMotivo) : null;

    const suspenso =
      !!suspensoAte &&
      typeof suspensoAte?.toMillis === "function" &&
      suspensoAte.toMillis() > Date.now();

    setContaStatus({
      suspenso,
      suspensoAte,
      suspensoMotivo,
      multaPendenteCentavos,
      multaQuitadaEm: data?.multaQuitadaEm ?? null,
    });
  }

  async function onPagarMulta() {
    try {
      if ((contaStatus.multaPendenteCentavos ?? 0) <= 0) {
        alert("Você não possui multa pendente no momento.");
        return;
      }

      setCarregandoMulta(true);

      const functions = getFunctions(undefined, "us-central1");
      const fn = httpsCallable(functions, "createPixMulta");
      const resp: any = await fn({});

      const copiaCola = resp?.data?.copiaCola;
      if (copiaCola) {
        setPixData({
          copiaCola,
          qrBase64: resp.data?.qrBase64,
          valorCentavos: Number(
            resp?.data?.valorCentavos ?? contaStatus.multaPendenteCentavos ?? 0
          ),
        });
        setPixModalOpen(true);
      } else {
        alert("Não foi possível gerar o PIX da multa agora.");
      }
    } catch (e: any) {
      console.error(e);
      alert(e?.message ?? "Erro ao gerar PIX da multa.");
    } finally {
      setCarregandoMulta(false);
    }
  }

  async function carregar() {
    if (!user?.uid) return;

    setCarregando(true);
    setErro(null);

    try {
      await carregarContaStatus(user.uid);

      const col = collection(db, "reservas");

      const q = query(
        col,
        where("clienteUid", "==", user.uid),
        orderBy("data", "desc")
      );

      const snap = await getDocs(q);

      const lista: Reserva[] = [];

      for (const d of snap.docs) {
        const data = d.data() as any;

        let quadraNome = data.quadraNome;

        if (!quadraNome && data.quadraId) {
          try {
            const quadraRef = doc(db, "quadras", data.quadraId);
            const quadraSnap = await getDoc(quadraRef);
            if (quadraSnap.exists()) {
              quadraNome = quadraSnap.data()?.nome;
            }
          } catch (e) {
            console.error("Erro ao buscar nome da quadra:", e);
          }
        }

        lista.push({
          id: d.id,
          ...data,
          quadraNome,
        });
      }

      setReservas(lista);
    } catch (e) {
      console.error(e);
      setErro("Erro ao carregar reservas. Veja o console.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    if (!user?.uid) return;
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  const agoraMs = Date.now();

  const reservasOrdenadas = useMemo(() => {
    const lista = reservas.slice();
    lista.sort((a, b) => {
      const ams = startAtMs(a) ?? 0;
      const bms = startAtMs(b) ?? 0;
      return bms - ams;
    });
    return lista;
  }, [reservas]);

  const reservasAbertasFuturas = useMemo(() => {
    return reservasOrdenadas
      .filter((r) => isAtiva(r.status))
      .filter((r) => {
        const s = startAtMs(r);
        return s ? s > agoraMs : false;
      })
      .sort((a, b) => (startAtMs(a)! - startAtMs(b)!));
  }, [reservasOrdenadas, agoraMs]);

  const proximaReserva = useMemo(() => {
    return reservasAbertasFuturas.length > 0 ? reservasAbertasFuturas[0] : null;
  }, [reservasAbertasFuturas]);

  const emAberto = useMemo(() => {
    return reservasAbertasFuturas.filter((r) => r.id !== proximaReserva?.id);
  }, [reservasAbertasFuturas, proximaReserva]);

  const finalizadas = useMemo(() => {
    const lista = reservasOrdenadas.filter((r) => {
      const s = startAtMs(r);
      const passou = s ? s <= agoraMs : false;
      return isFinalizada(r.status) || passou || r.status === "cancelada";
    });

    return lista.sort((a, b) => (startAtMs(b) ?? 0) - (startAtMs(a) ?? 0));
  }, [reservasOrdenadas, agoraMs]);

  function podeCancelar(r: Reserva) {
    if (!isAtiva(r.status)) return false;
    const s = startAtMs(r);
    if (!s) return false;
    return s > agoraMs;
  }

  async function onCancelar(r: Reserva) {
    if (!podeCancelar(r)) return;

    const ultimaHora = isReservaUltimaHora(r);

    const msg = ultimaHora
      ? `⚠️ Cancelamento de última hora\n\nCancelar este horário pode impactar sua reputação no app.\n\nTem certeza que deseja cancelar?\n\n${r.data} ${r.horaInicio}–${r.horaFim}`
      : `Cancelar reserva?\n\n${r.data} ${r.horaInicio}–${r.horaFim}`;

    setConfirmData({
  mensagem: msg,
  onConfirm: async () => {
    try {
      setCancelandoId(r.id);
      setErro(null);

      await cancelarReserva({ reservaId: r.id });

      setToast({
        type: "success",
        message: ultimaHora
          ? "Reserva cancelada. Sua reputação pode ter sido impactada."
          : "Reserva cancelada.",
      });

      await carregar();
    } catch (e: any) {
      console.error(e);
      setToast({
        type: "error",
        message: e?.message ?? "Erro ao cancelar.",
      });
    } finally {
      setCancelandoId("");
    }
  },
});

    return;
  }

  function CardReserva({
    r,
    destaque,
  }: {
    r: Reserva;
    destaque?: boolean;
  }) {
    const st = statusVisual(r.status);

    return (
      <article style={destaque ? styles.reservaCardHighlight : styles.reservaCard}>
        <div style={styles.reservaTop}>
          <div>
            {destaque ? (
              <div
                style={{
                  ...styles.chip,
                  background: "#dcfce7",
                  color: "#166534",
                  border: "1px solid #86efac",
                  marginBottom: 10,
                }}
              >
                PRÓXIMA RESERVA
              </div>
            ) : null}

            <h3 style={styles.reservaTitle}>
              {r.data} • {r.horaInicio}–{r.horaFim}
            </h3>

            <p style={styles.reservaSub}>
              {r.quadraNome ?? r.quadraId}
              {r.esporte ? ` • ${r.esporte}` : ""}
            </p>
          </div>

          <div style={styles.chipsRow}>
            <span
              style={{
                ...styles.chip,
                background: st.bg,
                color: st.color,
                border: `1px solid ${st.border}`,
              }}
            >
              {st.text}
            </span>

            {isReservaUltimaHora(r) && isAtiva(r.status) ? (
              <span
                style={{
                  ...styles.chip,
                  background: "#fff7ed",
                  color: "#c2410c",
                  border: "1px solid #fdba74",
                }}
              >
                Reserva de última hora
              </span>
            ) : null}
          </div>
        </div>

        <div style={styles.infoBoxes}>
          <div style={styles.infoBox}>
            <p style={styles.infoLabel}>Quadra</p>
            <p style={styles.infoValue}>{r.quadraNome ?? r.quadraId}</p>
          </div>

          <div style={styles.infoBox}>
            <p style={styles.infoLabel}>Esporte</p>
            <p style={styles.infoValue}>{r.esporte ?? "—"}</p>
          </div>

          <div style={styles.infoBox}>
            <p style={styles.infoLabel}>Valor</p>
            <p style={styles.infoValue}>{formatBRL(Number(r.valor ?? 0))}</p>
          </div>
        </div>

        <div style={styles.actions}>
          {podeCancelar(r) && (
            <button
              onClick={() => onCancelar(r)}
              disabled={cancelandoId === r.id}
              style={styles.dangerBtn}
            >
              {cancelandoId === r.id ? "Cancelando..." : "Cancelar reserva"}
            </button>
          )}

          {String(r.status ?? "").toLowerCase() === "finalizada" ? (
            <Link
              to={`/atleta/avaliar?reservaId=${encodeURIComponent(
                r.id
              )}&quadraId=${encodeURIComponent(r.quadraId)}`}
              style={{ textDecoration: "none" }}
            >
              <button style={styles.neutralBtn}>Avaliar reserva</button>
            </Link>
          ) : null}
        </div>
      </article>
    );
  }

  function Secao({
    titulo,
    descricao,
    children,
  }: {
    titulo: string;
    descricao: string;
    children: any;
  }) {
    return (
      <section style={styles.block}>
        <div style={styles.card}>
          <div style={styles.cardBody}>
            <h2 style={styles.sectionTitle}>{titulo}</h2>
            <p style={styles.helper}>{descricao}</p>
            <div style={styles.list}>{children}</div>
          </div>
        </div>
      </section>
    );
  }

  if (loading) return <p>Carregando usuário...</p>;
  if (!user) return <p>Você precisa estar logado.</p>;

  const bloqueioInfo =
    contaStatus.suspenso || contaStatus.multaPendenteCentavos > 0
      ? getMensagemBloqueioProfissional(contaStatus)
      : null;

  const totalAbertas = reservasAbertasFuturas.length;
  const totalHistorico = finalizadas.length;
  const totalCanceladas = reservasOrdenadas.filter(
    (r) => String(r.status ?? "").toLowerCase() === "cancelada"
  ).length;
  const totalMulta = contaStatus.multaPendenteCentavos / 100;

  return (
    <>
      <Header />

      {pixModalOpen && pixData && (
        <div
          style={styles.modalBackdrop}
          onClick={() => setPixModalOpen(false)}
        >
          <div
            style={styles.modalCard}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>Desbloquear conta via PIX</h3>
              <p style={styles.modalText}>
                Quite sua multa para liberar novamente a criação de reservas no app.
              </p>
            </div>

            <div style={styles.modalBody}>
              <div style={{ marginBottom: 12, color: "#334155", lineHeight: 1.55 }}>
                Valor da multa:{" "}
                <strong>{formatBRL((Number(pixData.valorCentavos ?? 0)) / 100)}</strong>
              </div>

              {pixData.qrBase64 ? (
                <div style={styles.qrWrap}>
                  <img
                    alt="QR Code PIX"
                    style={{
                      width: 260,
                      height: 260,
                      border: "1px solid #e2e8f0",
                      borderRadius: 16,
                    }}
                    src={`data:image/png;base64,${pixData.qrBase64}`}
                  />
                </div>
              ) : (
                <div
                  style={{
                    marginBottom: 12,
                    color: "#b91c1c",
                    fontWeight: 700,
                  }}
                >
                  QR não retornou. Use o código copia e cola abaixo.
                </div>
              )}

              <div style={{ fontWeight: 800, marginBottom: 8, color: "#0f172a" }}>
                Copia e cola
              </div>

              <textarea
                readOnly
                value={pixData.copiaCola}
                style={styles.textarea}
              />

              <div style={styles.noteBox}>
                Após o pagamento, aguarde alguns segundos e clique em{" "}
                <strong>Atualizar</strong> para conferir a liberação da conta.
              </div>

              <div style={styles.modalActions}>
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(pixData.copiaCola);
                      alert("Copiado!");
                    } catch {
                      alert("Não consegui copiar. Copie manualmente.");
                    }
                  }}
                  style={styles.neutralBtn}
                >
                  Copiar
                </button>

                <button
                  onClick={() => setPixModalOpen(false)}
                  style={styles.greenBtn}
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={styles.page}>
        <div style={styles.container}>
         <section
  style={{
    ...styles.hero,
    margin: "0 auto",
    maxWidth: 520,
  }}
>
            <div style={styles.heroGlow} />
            <div style={styles.heroGlow2} />

            <div style={{ position: "relative" }}>
              <div style={styles.heroBadge}>ÁREA DO ATLETA</div>

              <h1 style={styles.heroTitle}>{tituloPagina}</h1>

              <p style={styles.heroText}>
                Acompanhe sua próxima partida, gerencie reservas em aberto, consulte
                seu histórico e resolva pendências da conta em um só lugar.
              </p>

              <div style={styles.heroBottomRow}>
                <div style={styles.statPill}>
                  <span>Em aberto</span>
                  <strong>{totalAbertas}</strong>
                </div>

                <div style={styles.statPill}>
                  <span>Histórico</span>
                  <strong>{totalHistorico}</strong>
                </div>

                <div style={styles.statPill}>
                  <span>Canceladas</span>
                  <strong>{totalCanceladas}</strong>
                </div>

                <div style={styles.statPill}>
                  <span>Multa pendente</span>
                  <strong>{formatBRL(totalMulta)}</strong>
                </div>
              </div>
            </div>
          </section>

          {bloqueioInfo && (
            <section style={styles.block}>
              <div style={styles.card}>
                <div style={styles.cardBody}>
                  <div style={styles.alertDanger}>
                    <h2 style={styles.alertDangerTitle}>{bloqueioInfo.titulo}</h2>
                    <p style={styles.alertDangerText}>{bloqueioInfo.descricao}</p>
                    {bloqueioInfo.detalhe ? (
                      <p style={{ ...styles.alertDangerText, marginTop: 6 }}>
                        {bloqueioInfo.detalhe}
                      </p>
                    ) : null}

                    {(contaStatus.multaPendenteCentavos ?? 0) > 0 && (
                      <div style={{ marginTop: 14 }}>
                        <button
                          onClick={onPagarMulta}
                          disabled={carregandoMulta}
                          style={styles.dangerBtn}
                        >
                          {carregandoMulta
                            ? "Gerando PIX..."
                            : `Desbloquear conta — pagar ${formatBRL(
                                contaStatus.multaPendenteCentavos / 100
                              )}`}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}

          <section style={styles.block}>
            <div style={styles.infoGrid}>
              <article
  style={{
    ...styles.statCard,
    background: "#f0fdf4",
    border: "1px solid #86efac",
  }}
>
                <p style={styles.statLabel}>Próxima reserva</p>
                <p style={{ ...styles.statValue, color: "#16a34a" }}>
                  {proximaReserva ? "Agendada" : "Nenhuma"}
                </p>
              </article>

              <article style={styles.statCard}>
                <p style={styles.statLabel}>Reservas em aberto</p>
                <p style={styles.statValue}>{emAberto.length}</p>
              </article>

              <article style={styles.statCard}>
                <p style={styles.statLabel}>Histórico</p>
                <p style={styles.statValue}>{finalizadas.length}</p>
              </article>

              <article style={styles.statCard}>
                <p style={styles.statLabel}>Conta</p>
                <p
                  style={{
                    ...styles.statValue,
                    color:
                      contaStatus.suspenso || contaStatus.multaPendenteCentavos > 0
                        ? "#b91c1c"
                        : "#0f766e",
                  }}
                >
                  {contaStatus.suspenso || contaStatus.multaPendenteCentavos > 0
                    ? "Bloqueada"
                    : "Ok"}
                </p>
              </article>
            </div>
          </section>

          {erro && (
            <section style={styles.block}>
              <div style={styles.card}>
                <div style={styles.cardBody}>
                  <div
                    style={{
                      border: "1px solid #fecaca",
                      background: "#fff1f2",
                      color: "#b91c1c",
                      borderRadius: 16,
                      padding: 14,
                      fontWeight: 700,
                    }}
                  >
                    {erro}
                  </div>
                </div>
              </div>
            </section>
          )}

          {carregando && (
            <section style={styles.block}>
              <div style={styles.card}>
                <div style={styles.cardBody}>
                  <div style={styles.emptyBox}>Carregando suas reservas…</div>
                </div>
              </div>
            </section>
          )}

          {!carregando && reservasOrdenadas.length === 0 && (
            <section style={styles.block}>
              <div style={styles.card}>
                <div style={styles.cardBody}>
                  <div style={styles.emptyBox}>Nenhuma reserva encontrada.</div>
                </div>
              </div>
            </section>
          )}

          {!carregando && reservasOrdenadas.length > 0 && (
            <>
              <Secao
                titulo="Próxima reserva"
                descricao="Sua próxima partida confirmada ou agendada aparece em destaque."
              >
                {proximaReserva ? (
                  <CardReserva r={proximaReserva} destaque />
                ) : (
                  <div style={styles.emptyBox}>Nenhuma reserva futura.</div>
                )}
              </Secao>

              <Secao
                titulo="Reservas em aberto"
                descricao="Aqui ficam as demais reservas futuras que ainda podem ser acompanhadas."
              >
                {emAberto.length === 0 ? (
                  <div style={styles.emptyBox}>Nenhuma reserva em aberto.</div>
                ) : (
                  emAberto.map((r) => <CardReserva key={r.id} r={r} />)
                )}
              </Secao>

              <Secao
                titulo="Histórico de reservas"
                descricao="Consulte reservas finalizadas, vencidas ou canceladas."
              >
                {finalizadas.length === 0 ? (
                  <div style={styles.emptyBox}>Nenhuma reserva no histórico.</div>
                ) : (
                  finalizadas.map((r) => <CardReserva key={r.id} r={r} />)
                )}
              </Secao>
            </>
          )}

          <section style={styles.block}>
            <div style={styles.card}>
              <div style={styles.cardBody}>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button onClick={carregar} disabled={carregando} style={styles.greenBtn}>
                    {carregando ? "Atualizando..." : "Atualizar"}
                  </button>

                  <Link to="/home" style={{ textDecoration: "none" }}>
                    <button style={styles.neutralBtn}>Ir para Home</button>
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}