import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import Header from "../components/Header";
import { db } from "../services/firebase";

type ReservaPix = {
  id: string;
  quadraId: string;
  quadraNome?: string;
  esporte?: string;
  data?: string;
  horaInicio?: string;
  horaFim?: string;
  valor?: number;
  status?: string;
  pagamentoStatus?: string;
  mpStatus?: string;
  pixCopiaECola?: string;
  pixQrBase64?: string;
  canceladaMotivo?: string;
  expiraPagamentoEm?: any;
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

function formatBRL(n: number) {
  return Number(n ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatarTempo(segundos: number) {
  const min = Math.floor(segundos / 60);
  const sec = segundos % 60;
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

const styles = {
  page: {
    minHeight: "100vh",
    background:
      "linear-gradient(180deg, #f8fafc 0%, #dbeafe 24%, #eef4ff 52%, #f8fafc 100%)",
    paddingBottom: 40,
  } as CSSProperties,

  container: {
    width: "100%",
    maxWidth: 1120,
    margin: "0 auto",
    padding: "22px 16px 40px",
  } as CSSProperties,

  backLink: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    color: "#1d4ed8",
    textDecoration: "none",
    fontWeight: 800,
    marginBottom: 14,
  } as CSSProperties,

  hero: {
    position: "relative" as const,
    overflow: "hidden",
    borderRadius: 30,
    padding: "28px 24px",
    background:
      "linear-gradient(135deg, #0f172a 0%, #1d4ed8 55%, #38bdf8 100%)",
    color: "#fff",
    boxShadow: "0 24px 70px rgba(15, 23, 42, 0.18)",
  } as CSSProperties,

  heroGlow1: {
    position: "absolute" as const,
    top: -80,
    right: -60,
    width: 220,
    height: 220,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.12)",
    filter: "blur(8px)",
  } as CSSProperties,

  heroGlow2: {
    position: "absolute" as const,
    bottom: -90,
    left: -60,
    width: 240,
    height: 240,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.10)",
    filter: "blur(10px)",
  } as CSSProperties,

  heroContent: {
    position: "relative" as const,
    zIndex: 1,
  } as CSSProperties,

  heroBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 14px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.14)",
    border: "1px solid rgba(255,255,255,0.18)",
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: 0.4,
    marginBottom: 14,
  } as CSSProperties,

  heroTitle: {
    margin: 0,
    fontSize: "clamp(30px, 4vw, 44px)",
    lineHeight: 1.02,
    fontWeight: 900,
    letterSpacing: -0.7,
    maxWidth: 700,
  } as CSSProperties,

  heroText: {
    margin: "12px 0 0",
    maxWidth: 760,
    fontSize: 15,
    lineHeight: 1.65,
    color: "rgba(255,255,255,0.92)",
  } as CSSProperties,

  heroPills: {
    marginTop: 20,
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  } as CSSProperties,

  heroPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 14px",
    borderRadius: 16,
    background: "rgba(255,255,255,0.14)",
    border: "1px solid rgba(255,255,255,0.18)",
    fontSize: 13,
    fontWeight: 800,
  } as CSSProperties,

  grid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.05fr) minmax(340px, 0.95fr)",
    gap: 18,
    marginTop: 18,
  } as CSSProperties,

  card: {
    background: "#fff",
    borderRadius: 26,
    border: "1px solid #e2e8f0",
    boxShadow: "0 16px 40px rgba(15, 23, 42, 0.07)",
    overflow: "hidden",
  } as CSSProperties,

  cardBody: {
    padding: 20,
  } as CSSProperties,

  sectionTitle: {
    margin: 0,
    fontSize: 23,
    fontWeight: 900,
    color: "#0f172a",
    letterSpacing: -0.3,
  } as CSSProperties,

  sectionText: {
    margin: "8px 0 0",
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.6,
  } as CSSProperties,

  statusPendingBox: {
    marginTop: 16,
    borderRadius: 20,
    padding: 16,
    border: "1px solid #bfdbfe",
    background: "linear-gradient(180deg, #eff6ff, #ffffff)",
  } as CSSProperties,

  statusSuccessBox: {
    marginTop: 16,
    borderRadius: 20,
    padding: 18,
    border: "1px solid #86efac",
    background: "linear-gradient(180deg, #ecfdf5, #ffffff)",
  } as CSSProperties,

  statusExpiredBox: {
    marginTop: 16,
    borderRadius: 20,
    padding: 18,
    border: "1px solid #fecaca",
    background: "linear-gradient(180deg, #fff1f2, #ffffff)",
  } as CSSProperties,

  statusTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 900,
    color: "#0f172a",
  } as CSSProperties,

  statusText: {
    margin: "8px 0 0",
    color: "#475569",
    lineHeight: 1.6,
    fontSize: 14,
  } as CSSProperties,

  qrPanel: {
    marginTop: 16,
    borderRadius: 22,
    border: "1px solid #dbeafe",
    background: "linear-gradient(180deg, #eff6ff, #ffffff)",
    padding: 18,
  } as CSSProperties,

  qrWrap: {
    marginTop: 14,
    display: "flex",
    justifyContent: "center",
    padding: 18,
    borderRadius: 18,
    background: "#fff",
    border: "1px solid #e2e8f0",
  } as CSSProperties,

  textarea: {
    width: "100%",
    minHeight: 124,
    borderRadius: 16,
    border: "1px solid #cbd5e1",
    background: "#fff",
    padding: "14px 14px",
    outline: "none",
    resize: "none" as const,
    boxSizing: "border-box",
    marginTop: 12,
    fontSize: 14,
    color: "#0f172a",
  } as CSSProperties,

  actionsRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 14,
  } as CSSProperties,

  primaryBtn: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 48,
    padding: "0 18px",
    borderRadius: 16,
    border: "none",
    background: "linear-gradient(135deg, #1d4ed8, #2563eb)",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 12px 24px rgba(37, 99, 235, 0.22)",
    textDecoration: "none",
  } as CSSProperties,

  greenBtn: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 48,
    padding: "0 18px",
    borderRadius: 16,
    border: "none",
    background: "linear-gradient(135deg, #16a34a, #22c55e)",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 12px 24px rgba(34, 197, 94, 0.22)",
    textDecoration: "none",
  } as CSSProperties,

  secondaryBtn: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 48,
    padding: "0 18px",
    borderRadius: 16,
    border: "1px solid #cbd5e1",
    background: "#fff",
    color: "#0f172a",
    fontWeight: 800,
    cursor: "pointer",
    textDecoration: "none",
  } as CSSProperties,

  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
    marginTop: 16,
  } as CSSProperties,

  summaryItem: {
    borderRadius: 18,
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    padding: 14,
  } as CSSProperties,

  summaryLabel: {
    margin: 0,
    fontSize: 12,
    color: "#64748b",
    fontWeight: 900,
    textTransform: "uppercase" as const,
    letterSpacing: 0.4,
  } as CSSProperties,

  summaryValue: {
    margin: "8px 0 0",
    color: "#0f172a",
    fontSize: 16,
    fontWeight: 900,
    lineHeight: 1.45,
  } as CSSProperties,

  rightSticky: {
    display: "grid",
    gap: 18,
    alignSelf: "start",
    position: "sticky",
    top: 16,
  } as CSSProperties,

  loadingBox: {
    padding: 22,
    borderRadius: 20,
    background: "#fff",
    border: "1px solid #e2e8f0",
    color: "#475569",
    fontWeight: 800,
  } as CSSProperties,

  noteBox: {
    marginTop: 14,
    padding: 14,
    borderRadius: 16,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    color: "#475569",
    fontSize: 14,
    lineHeight: 1.6,
  } as CSSProperties,
};

export default function PagamentoPix() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const reservaId = String(searchParams.get("reservaId") ?? "").trim();
  const quadraIdUrl = String(searchParams.get("quadraId") ?? "").trim();

  const [loading, setLoading] = useState(true);
  const [reserva, setReserva] = useState<ReservaPix | null>(null);
  const [quadraNomeExtra, setQuadraNomeExtra] = useState("");
  const [erro, setErro] = useState("");
  const [tempoRestante, setTempoRestante] = useState(0);

  async function carregarQuadraNome(quadraId: string) {
    if (!quadraId) return;
    try {
      const snap = await getDoc(doc(db, "quadras", quadraId));
      if (snap.exists()) {
        const data = snap.data() as any;
        setQuadraNomeExtra(String(data?.nome ?? ""));
      }
    } catch {
      // ignora
    }
  }

  async function atualizarAgora() {
    if (!reservaId) return;

    try {
      const snap = await getDoc(doc(db, "reservas", reservaId));
      if (!snap.exists()) {
        setErro("Reserva não encontrada.");
        return;
      }

      const data = snap.data() as any;
      setReserva({
        id: snap.id,
        quadraId: String(data?.quadraId ?? ""),
        quadraNome: String(data?.quadraNome ?? ""),
        esporte: String(data?.esporte ?? ""),
        data: String(data?.data ?? ""),
        horaInicio: String(data?.horaInicio ?? ""),
        horaFim: String(data?.horaFim ?? ""),
        valor: Number(data?.valor ?? 0),
        status: String(data?.status ?? ""),
        pagamentoStatus: String(data?.pagamentoStatus ?? ""),
        mpStatus: String(data?.mpStatus ?? ""),
        pixCopiaECola: String(data?.pixCopiaECola ?? ""),
        pixQrBase64: String(data?.pixQrBase64 ?? ""),
        canceladaMotivo: String(data?.canceladaMotivo ?? ""),
        expiraPagamentoEm: data?.expiraPagamentoEm ?? null,
      });

      if (String(data?.quadraId ?? "").trim()) {
        await carregarQuadraNome(String(data.quadraId));
      }
    } catch {
      setErro("Erro ao atualizar pagamento.");
    }
  }

  useEffect(() => {
    if (!reservaId) {
      setErro("Pagamento PIX sem reservaId.");
      setLoading(false);
      return;
    }

    const ref = doc(db, "reservas", reservaId);

    const unsub = onSnapshot(
      ref,
      async (snap) => {
        if (!snap.exists()) {
          setErro("Reserva não encontrada.");
          setLoading(false);
          return;
        }

        const data = snap.data() as any;

        setReserva({
          id: snap.id,
          quadraId: String(data?.quadraId ?? ""),
          quadraNome: String(data?.quadraNome ?? ""),
          esporte: String(data?.esporte ?? ""),
          data: String(data?.data ?? ""),
          horaInicio: String(data?.horaInicio ?? ""),
          horaFim: String(data?.horaFim ?? ""),
          valor: Number(data?.valor ?? 0),
          status: String(data?.status ?? ""),
          pagamentoStatus: String(data?.pagamentoStatus ?? ""),
          mpStatus: String(data?.mpStatus ?? ""),
          pixCopiaECola: String(data?.pixCopiaECola ?? ""),
          pixQrBase64: String(data?.pixQrBase64 ?? ""),
          canceladaMotivo: String(data?.canceladaMotivo ?? ""),
          expiraPagamentoEm: data?.expiraPagamentoEm ?? null,
        });

        const qid = String(data?.quadraId ?? "");
        if (qid) {
          await carregarQuadraNome(qid);
        }

        setErro("");
        setLoading(false);
      },
      () => {
        setErro("Erro ao acompanhar o pagamento PIX.");
        setLoading(false);
      }
    );

    return () => unsub();
  }, [reservaId]);

  const quadraId = String(reserva?.quadraId ?? quadraIdUrl ?? "").trim();
  const quadraNome =
    String(reserva?.quadraNome ?? "").trim() || quadraNomeExtra || "Quadra";
  const esporteLabel =
    ESPORTES_LABELS[String(reserva?.esporte ?? "")] ??
    String(reserva?.esporte ?? "—");

  const pago = useMemo(() => {
    const pagamentoStatus = String(
      reserva?.pagamentoStatus ?? ""
    ).toLowerCase();
    const mpStatus = String(reserva?.mpStatus ?? "").toLowerCase();
    return (
      pagamentoStatus === "pago" ||
      mpStatus === "approved" ||
      mpStatus === "accredited"
    );
  }, [reserva]);

  const expirado = useMemo(() => {
    if (!reserva) return false;
    return (
      String(reserva.status ?? "").toLowerCase() === "cancelada" &&
      String(reserva.canceladaMotivo ?? "").toLowerCase() === "pix_expirado"
    );
  }, [reserva]);

  const expiraEm = useMemo(() => {
    const val = reserva?.expiraPagamentoEm;
    if (!val) return null;

    if (typeof val.toDate === "function") return val.toDate();
    return new Date(val);
  }, [reserva]);

  useEffect(() => {
    if (!expiraEm || pago || expirado) {
      setTempoRestante(0);
      return;
    }

    const atualizar = () => {
      const agora = new Date();
      const diff = Math.floor((expiraEm.getTime() - agora.getTime()) / 1000);
      setTempoRestante(diff > 0 ? diff : 0);
    };

    atualizar();
    const interval = setInterval(atualizar, 1000);

    return () => clearInterval(interval);
  }, [expiraEm, pago, expirado]);

  if (loading) {
    return (
      <>
        <Header />
        <div style={styles.page}>
          <div style={styles.container}>
            <div style={styles.loadingBox}>Carregando pagamento PIX...</div>
          </div>
        </div>
      </>
    );
  }

  if (erro || !reserva) {
    return (
      <>
        <Header />
        <div style={styles.page}>
          <div style={styles.container}>
            <div style={styles.card}>
              <div style={styles.cardBody}>
                <h2 style={styles.sectionTitle}>
                  Não conseguimos abrir esse pagamento
                </h2>
                <p style={styles.sectionText}>
                  {erro || "Pagamento PIX não encontrado."}
                </p>

                <div style={styles.actionsRow}>
                  <Link to="/" style={styles.primaryBtn}>
                    Ir para início
                  </Link>

                  <Link to="/minhas-reservas" style={styles.secondaryBtn}>
                    Minhas reservas
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />

      <div style={styles.page}>
        <div style={styles.container}>
          <button
            type="button"
            onClick={() => navigate(-1)}
            style={{
              ...styles.backLink,
              background: "transparent",
              border: "none",
              padding: 0,
              cursor: "pointer",
            }}
          >
            ← Voltar
          </button>

          <section style={styles.hero}>
            <div style={styles.heroGlow1} />
            <div style={styles.heroGlow2} />

            <div style={styles.heroContent}>
              <div style={styles.heroBadge}>PAGAMENTO VIA PIX</div>

              <h1 style={styles.heroTitle}>
                {pago
                  ? "Sua reserva foi realizada com sucesso"
                  : expirado
                  ? "Este PIX expirou"
                  : "Finalize o pagamento para garantir seu horário"}
              </h1>

              <p style={styles.heroText}>
                {pago
                  ? "Pagamento confirmado e horário garantido. Agora você já pode acompanhar tudo nas suas reservas."
                  : expirado
                  ? "O prazo de pagamento terminou e a reserva foi cancelada automaticamente. Você pode voltar para a quadra e escolher outro horário."
                  : "Assim que o PIX for aprovado, a confirmação acontece automaticamente. Pode deixar essa tela aberta enquanto conclui o pagamento no banco."}
              </p>

              <div style={styles.heroPills}>
                <div style={styles.heroPill}>🏟️ {quadraNome}</div>
                <div style={styles.heroPill}>
                  📅 {reserva.data || "—"} • {reserva.horaInicio || "—"}–
                  {reserva.horaFim || "—"}
                </div>
                <div style={styles.heroPill}>
                  💸 {formatBRL(Number(reserva.valor ?? 0))}
                </div>
              </div>
            </div>
          </section>

          <div
            style={{
              ...styles.grid,
              gridTemplateColumns: pago
                ? "1fr"
                : "minmax(0, 1.05fr) minmax(340px, 0.95fr)",
            }}
          >
            <div style={styles.card}>
              <div style={styles.cardBody}>
                <h2 style={styles.sectionTitle}>
                  {pago
                    ? "Reserva confirmada"
                    : expirado
                    ? "Pagamento não concluído"
                    : "Aguardando pagamento"}
                </h2>

                <p style={styles.sectionText}>
                  {pago
                    ? "Seu horário já está garantido no Quadra Play."
                    : expirado
                    ? "Esse horário foi liberado novamente porque o PIX não foi pago dentro do tempo."
                    : "Escaneie o QR Code ou use o código copia e cola abaixo."}
                </p>

                {pago ? (
                  <div style={styles.statusSuccessBox}>
                    <h3 style={{ ...styles.statusTitle, color: "#166534" }}>
                      ✅ Pagamento aprovado
                    </h3>
                    <p style={styles.statusText}>
                      Seu pagamento foi reconhecido e a sua reserva está
                      concluída.
                    </p>

                    <div style={styles.actionsRow}>
                      <Link to="/minhas-reservas" style={styles.greenBtn}>
                        Minhas reservas
                      </Link>

                      <Link
                        to={quadraId ? `/quadra/${quadraId}` : "/"}
                        style={styles.secondaryBtn}
                      >
                        Voltar para quadra
                      </Link>

                      <Link to="/" style={styles.secondaryBtn}>
                        Início
                      </Link>
                    </div>
                  </div>
                ) : expirado ? (
                  <div style={styles.statusExpiredBox}>
                    <h3 style={{ ...styles.statusTitle, color: "#991b1b" }}>
                      ⏰ PIX expirado
                    </h3>
                    <p style={styles.statusText}>
                      O pagamento não foi concluído a tempo, então a reserva foi
                      cancelada automaticamente.
                    </p>

                    <div style={styles.actionsRow}>
                      <Link
                        to={quadraId ? `/quadra/${quadraId}` : "/"}
                        style={styles.primaryBtn}
                      >
                        Escolher novo horário
                      </Link>

                      <Link to="/" style={styles.secondaryBtn}>
                        Início
                      </Link>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={styles.statusPendingBox}>
                      <h3 style={{ ...styles.statusTitle, color: "#1d4ed8" }}>
                        🕐 Pagamento pendente
                      </h3>

                      <p style={styles.statusText}>
                        Assim que o banco confirmar o PIX, essa tela muda
                        automaticamente para sucesso.
                      </p>

                      <p
                        style={{
                          margin: "12px 0 0",
                          fontWeight: 900,
                          fontSize: 16,
                          color: tempoRestante > 0 ? "#1d4ed8" : "#b91c1c",
                        }}
                      >
                        {tempoRestante > 0
                          ? `⏳ Expira em: ${formatarTempo(tempoRestante)}`
                          : "⛔ PIX expirado"}
                      </p>
                    </div>

                    <div style={styles.qrPanel}>
                      <h3
                        style={{
                          margin: 0,
                          color: "#0f172a",
                          fontSize: 18,
                          fontWeight: 900,
                        }}
                      >
                        QR Code Pix
                      </h3>

                      {reserva.pixQrBase64 ? (
                        <div style={styles.qrWrap}>
                          <img
                            src={`data:image/png;base64,${reserva.pixQrBase64}`}
                            alt="QR Code Pix"
                            style={{
                              width: 260,
                              height: 260,
                              display: "block",
                              borderRadius: 14,
                            }}
                          />
                        </div>
                      ) : (
                        <div style={styles.noteBox}>
                          QR Code não retornou. Use o código copia e cola
                          abaixo.
                        </div>
                      )}

                      <h3
                        style={{
                          margin: "14px 0 0",
                          color: "#0f172a",
                          fontSize: 18,
                          fontWeight: 900,
                        }}
                      >
                        Copia e cola
                      </h3>

                      <textarea
                        value={String(reserva.pixCopiaECola ?? "")}
                        readOnly
                        style={styles.textarea}
                      />

                      <div style={styles.actionsRow}>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(
                                String(reserva.pixCopiaECola ?? "")
                              );
                              window.alert("Código PIX copiado.");
                            } catch {
                              window.alert(
                                "Não consegui copiar. Copie manualmente."
                              );
                            }
                          }}
                          style={{
                            ...styles.primaryBtn,
                            opacity: tempoRestante <= 0 ? 0.6 : 1,
                            cursor:
                              tempoRestante <= 0 ? "not-allowed" : "pointer",
                          }}
                          disabled={tempoRestante <= 0}
                        >
                          Copiar código PIX
                        </button>

                        <button
                          type="button"
                          onClick={atualizarAgora}
                          style={styles.secondaryBtn}
                        >
                          Atualizar status
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {!pago ? (
              <aside style={styles.rightSticky}>
                <div style={styles.card}>
                  <div style={styles.cardBody}>
                    <h2 style={styles.sectionTitle}>Resumo da reserva</h2>
                    <p style={styles.sectionText}>
                      Confira os dados antes de concluir o pagamento.
                    </p>

                    <div style={styles.summaryGrid}>
                      <div style={styles.summaryItem}>
                        <p style={styles.summaryLabel}>Quadra</p>
                        <p style={styles.summaryValue}>{quadraNome}</p>
                      </div>

                      <div style={styles.summaryItem}>
                        <p style={styles.summaryLabel}>Esporte</p>
                        <p style={styles.summaryValue}>
                          {esporteLabel || "—"}
                        </p>
                      </div>

                      <div style={styles.summaryItem}>
                        <p style={styles.summaryLabel}>Data</p>
                        <p style={styles.summaryValue}>{reserva.data || "—"}</p>
                      </div>

                      <div style={styles.summaryItem}>
                        <p style={styles.summaryLabel}>Horário</p>
                        <p style={styles.summaryValue}>
                          {reserva.horaInicio || "—"}–{reserva.horaFim || "—"}
                        </p>
                      </div>

                      <div style={styles.summaryItem}>
                        <p style={styles.summaryLabel}>Valor</p>
                        <p style={styles.summaryValue}>
                          {formatBRL(Number(reserva.valor ?? 0))}
                        </p>
                      </div>

                      <div style={styles.summaryItem}>
                        <p style={styles.summaryLabel}>Status</p>
                        <p style={styles.summaryValue}>
                          {expirado
                            ? "PIX expirado"
                            : pago
                            ? "Pagamento confirmado"
                            : "Aguardando pagamento"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div style={styles.card}>
                  <div style={styles.cardBody}>
                    <h2 style={styles.sectionTitle}>Importante</h2>
                    <p style={styles.sectionText}>
                      O app atualiza essa reserva automaticamente quando o PIX
                      for reconhecido.
                    </p>

                    <div style={styles.noteBox}>
                      Depois do pagamento, você verá aqui a mensagem de sucesso
                      com os botões:
                      <strong> Minhas reservas</strong>,
                      <strong> Voltar para quadra</strong> e
                      <strong> Início</strong>.
                    </div>
                  </div>
                </div>
              </aside>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}