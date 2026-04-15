import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Link, useNavigate } from "react-router-dom";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import Header from "../../components/Header";
import { auth, db, functions } from "../../services/firebase";

type PagamentoSaldoDoc = {
  id: string;
  status?: string;
  pagamentoStatus?: string;
  mpStatus?: string;
  valorCentavos?: number;
  valorPago?: number;
  pixCopiaECola?: string;
  pixQrBase64?: string;
  expiraEm?: any;
  expiraPagamentoEm?: any;
  pixCriadoEm?: any;
  pagoEm?: any;
  canceladaMotivo?: string;
  motivoCancelamento?: string;
  createdAt?: any;
  updatedAt?: any;
};

type FinanceiroDonoDoc = {
  saldoCentavos?: number;
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

function toDateSafe(value: any): Date | null {
  if (!value) return null;

  if (typeof value?.toDate === "function") {
    const d = value.toDate();
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

const styles = {
  page: {
    minHeight: "100vh",
    background:
      "linear-gradient(180deg, #03122e 0px, #053ff9 180px, #f8fafc 180px, #f8fafc 100%)",
    paddingBottom: 40,
  } as CSSProperties,

  container: {
    width: "100%",
    maxWidth: 1120,
    margin: "0 auto",
    padding: "22px 16px 40px",
    boxSizing: "border-box",
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
    background: "linear-gradient(135deg, #053ff9, #2563eb)",
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
    maxWidth: 760,
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
    color: "#03122e",
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

  statusCanceledBox: {
    marginTop: 16,
    borderRadius: 20,
    padding: 18,
    border: "1px solid #e2e8f0",
    background: "linear-gradient(180deg, #f8fafc, #ffffff)",
  } as CSSProperties,

  statusTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 900,
    color: "#03122e",
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
    background: "#053ff9",
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
    background: "#8ae809",
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
    color: "#03122e",
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
    color: "#03122e",
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

export default function PagamentoSaldo() {
  const navigate = useNavigate();

  const [uid, setUid] = useState("");
  const [loading, setLoading] = useState(true);
  const [gerandoPix, setGerandoPix] = useState(true);
  const [erro, setErro] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [tempoRestante, setTempoRestante] = useState(0);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 900);

  const [pagamento, setPagamento] = useState<PagamentoSaldoDoc | null>(null);
  const [saldoAtualCentavos, setSaldoAtualCentavos] = useState(0);

  const solicitacaoEmAndamentoRef = useRef(false);

  async function carregarFinanceiro(ownerUid: string) {
    if (!ownerUid) return;

    try {
      const snap = await getDoc(doc(db, "financeiro_donos", ownerUid));
      if (!snap.exists()) {
        setSaldoAtualCentavos(0);
        return;
      }

      const data = snap.data() as FinanceiroDonoDoc;
      setSaldoAtualCentavos(Number(data?.saldoCentavos ?? 0));
    } catch {
      // ignora
    }
  }

  function mapPagamentoDoc(docId: string, data: any): PagamentoSaldoDoc {
    return {
      id: docId,
      status: String(data?.status ?? ""),
      pagamentoStatus: String(data?.pagamentoStatus ?? ""),
      mpStatus: String(data?.mpStatus ?? ""),
      valorCentavos: Number(data?.valorCentavos ?? 0),
      valorPago: Number(data?.valorPago ?? 0),
      pixCopiaECola: String(data?.pixCopiaECola ?? ""),
      pixQrBase64: String(data?.pixQrBase64 ?? ""),
      expiraEm: data?.expiraEm ?? null,
      expiraPagamentoEm: data?.expiraPagamentoEm ?? null,
      pixCriadoEm: data?.pixCriadoEm ?? null,
      pagoEm: data?.pagoEm ?? null,
      canceladaMotivo: String(data?.canceladaMotivo ?? ""),
      motivoCancelamento: String(data?.motivoCancelamento ?? ""),
      createdAt: data?.createdAt ?? null,
      updatedAt: data?.updatedAt ?? null,
    };
  }

async function solicitarPixSaldo(forceNew = false) {
  if (!uid) return;
  if (solicitacaoEmAndamentoRef.current) return;

  solicitacaoEmAndamentoRef.current = true;
  setGerandoPix(true);

  try {
    const fn = httpsCallable(functions, "createPixSaldoDono");
    const resp: any = await fn({});

    const data = resp?.data ?? {};


    await atualizarAgora();
    setErro("");
  } catch (e: any) {
    const msg =
      String(e?.message || "").trim() ||
      "Não foi possível gerar o PIX do saldo pendente.";
    setErro(msg);
  } finally {
    setGerandoPix(false);
    solicitacaoEmAndamentoRef.current = false;
  }
}

async function atualizarAgora() {
  if (!uid) return;

  try {
    setErro("");

    const fn = httpsCallable(functions, "checkPixSaldoDonoStatus");
    await fn({});

    const [pagamentoSnap, financeiroSnap] = await Promise.all([
      getDoc(doc(db, "pagamentos_saldo", uid)),
      getDoc(doc(db, "financeiro_donos", uid)),
    ]);

    if (pagamentoSnap.exists()) {
      setPagamento(mapPagamentoDoc(pagamentoSnap.id, pagamentoSnap.data()));
    } else {
      setPagamento(null);
    }

    if (financeiroSnap.exists()) {
      const financeiroData = financeiroSnap.data() as FinanceiroDonoDoc;
      setSaldoAtualCentavos(Number(financeiroData?.saldoCentavos ?? 0));
    } else {
      setSaldoAtualCentavos(0);
    }
  } catch (e: any) {
    const msg =
      String(e?.message || "").trim() ||
      "Erro ao atualizar pagamento do saldo.";
    setErro(msg);
  }
}

  useEffect(() => {
    const onResize = () => {
      setIsMobile(window.innerWidth <= 900);
    };

    onResize();
    window.addEventListener("resize", onResize);

    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (user) => {
      const currentUid = String(user?.uid ?? "").trim();

      if (!currentUid) {
        setErro("Você precisa estar logado para pagar o saldo pendente.");
        setLoading(false);
        setGerandoPix(false);
        return;
      }

      setUid(currentUid);
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    if (!uid) return;

    let ativo = true;

    async function iniciar() {
      setLoading(true);
      await carregarFinanceiro(uid);
      await solicitarPixSaldo(false);
      if (ativo) setLoading(false);
    }

    void iniciar();

    return () => {
      ativo = false;
    };
  }, [uid]);

  useEffect(() => {
    if (!uid) return;

    const ref = doc(db, "pagamentos_saldo", uid);

    const unsub = onSnapshot(
  ref,
  async (snap) => {
    if (snap.exists()) {
      setPagamento(mapPagamentoDoc(snap.id, snap.data()));
    } else {
      setPagamento(null);
    }

    await carregarFinanceiro(uid);
    setErro("");
    setLoading(false);
  },
  () => {
    // ignora erro inicial enquanto o PIX ainda está sendo criado
    if (!pagamento) return;

    setErro("Erro ao acompanhar o pagamento do saldo.");
    setLoading(false);
  }
);

return () => unsub();
  }, [uid]);

  const valorCentavos = useMemo(() => {
    const valorDoc = Number(pagamento?.valorCentavos ?? 0);
    if (valorDoc > 0) return valorDoc;

    if (saldoAtualCentavos < 0) return Math.abs(saldoAtualCentavos);

    return 0;
  }, [pagamento, saldoAtualCentavos]);

  const statusNorm = String(pagamento?.status ?? "").trim().toLowerCase();
  const pagamentoStatusNorm = String(pagamento?.pagamentoStatus ?? "")
    .trim()
    .toLowerCase();
  const mpStatusNorm = String(pagamento?.mpStatus ?? "").trim().toLowerCase();
  const canceladaMotivoNorm = String(
    pagamento?.canceladaMotivo ?? pagamento?.motivoCancelamento ?? ""
  )
    .trim()
    .toLowerCase();

  const expiraEm = useMemo(() => {
    return toDateSafe(pagamento?.expiraEm ?? pagamento?.expiraPagamentoEm);
  }, [pagamento]);

  const pago = useMemo(() => {
    return (
      statusNorm === "pago" ||
      statusNorm === "paid" ||
      statusNorm === "approved" ||
      pagamentoStatusNorm === "pago" ||
      pagamentoStatusNorm === "approved" ||
      mpStatusNorm === "approved" ||
      mpStatusNorm === "accredited" ||
      saldoAtualCentavos === 0
    );
  }, [statusNorm, pagamentoStatusNorm, mpStatusNorm, saldoAtualCentavos]);

  const cancelado = useMemo(() => {
    return statusNorm === "cancelado" || statusNorm === "cancelada";
  }, [statusNorm]);

  const expiradoNoBackend = useMemo(() => {
    return (
      statusNorm === "expirado" ||
      pagamentoStatusNorm === "expirado" ||
      mpStatusNorm === "expired" ||
      canceladaMotivoNorm === "pix_expirado"
    );
  }, [statusNorm, pagamentoStatusNorm, mpStatusNorm, canceladaMotivoNorm]);

  const expiradoLocal = useMemo(() => {
    if (!expiraEm || pago || cancelado || expiradoNoBackend) return false;
    return expiraEm.getTime() <= Date.now();
  }, [expiraEm, pago, cancelado, expiradoNoBackend]);

  const expirado = expiradoNoBackend || expiradoLocal;

  const temDadosPix = useMemo(() => {
    return (
      !!String(pagamento?.pixCopiaECola ?? "").trim() ||
      !!String(pagamento?.pixQrBase64 ?? "").trim()
    );
  }, [pagamento]);

  const aguardandoPagamento = useMemo(() => {
    if (pago) return false;
    if (cancelado) return false;
    if (expirado) return false;
    return true;
  }, [pago, cancelado, expirado]);

  useEffect(() => {
    if (!expiraEm || pago || cancelado || expiradoNoBackend) {
      setTempoRestante(0);
      return;
    }

    const atualizar = () => {
      const diff = Math.floor((expiraEm.getTime() - Date.now()) / 1000);
      setTempoRestante(diff > 0 ? diff : 0);
    };

    atualizar();
    const interval = setInterval(atualizar, 1000);

    return () => clearInterval(interval);
  }, [expiraEm, pago, cancelado, expiradoNoBackend]);


  const podeCopiarPix = useMemo(() => {
    return (
      aguardandoPagamento &&
      temDadosPix &&
      !!String(pagamento?.pixCopiaECola ?? "").trim()
    );
  }, [aguardandoPagamento, temDadosPix, pagamento]);

  if (loading || gerandoPix) {
    return (
      <>
        <Header />
        <div style={styles.page}>
          <div style={styles.container}>
            <div style={styles.loadingBox}>Carregando pagamento do saldo...</div>
          </div>
        </div>
      </>
    );
  }

  if (erro && !pagamento && saldoAtualCentavos >= 0) {
    return (
      <>
        <Header />
        <div style={styles.page}>
          <div style={styles.container}>
            <div style={styles.card}>
              <div style={styles.cardBody}>
                <h2 style={styles.sectionTitle}>Nenhum saldo pendente encontrado</h2>
                <p style={styles.sectionText}>
                  Você não possui saldo pendente para pagamento no momento.
                </p>

                <div style={styles.actionsRow}>
                  <Link to="/dono/central" style={styles.primaryBtn}>
                    Voltar para central
                  </Link>
                  <Link to="/home" style={styles.secondaryBtn}>
                    Início
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (erro && !pagamento) {
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
                  {erro || "Pagamento do saldo não encontrado."}
                </p>

                <div style={styles.actionsRow}>
                  <button
                    type="button"
                    onClick={() => void solicitarPixSaldo(true)}
                    style={styles.primaryBtn}
                  >
                    Tentar novamente
                  </button>

                  <Link to="/dono/central" style={styles.secondaryBtn}>
                    Voltar para central
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
              <div style={styles.heroBadge}>PAGAMENTO DE SALDO VIA PIX</div>

              <h1 style={styles.heroTitle}>
                {pago
                  ? "Seu saldo pendente foi quitado com sucesso"
                  : expirado
                  ? "Este PIX expirou"
                  : cancelado
                  ? "Este pagamento foi cancelado"
                  : "Regularize seu saldo pendente com a plataforma"}
              </h1>

              <p style={styles.heroText}>
                {pago
                  ? "Pagamento confirmado com sucesso. Seu saldo pendente com a plataforma foi quitado."
                  : expirado
                  ? "O prazo para pagamento terminou. Gere um novo PIX para concluir a regularização do saldo."
                  : cancelado
                  ? "Esse pagamento não está mais disponível. Gere um novo PIX para regularizar o saldo pendente."
                  : "Assim que o PIX for aprovado, a quitação do saldo acontece automaticamente. Pode deixar essa tela aberta enquanto conclui o pagamento no banco."}
              </p>

              <div style={styles.heroPills}>
                <div style={styles.heroPill}>
                  💸 Saldo pendente: {formatBRL(valorCentavos / 100)}
                </div>

                <div style={styles.heroPill}>
                  📌 Status:{" "}
                  {pago
                    ? "Quitado"
                    : expirado
                    ? "PIX expirado"
                    : cancelado
                    ? "Cancelado"
                    : "Aguardando pagamento"}
                </div>
              </div>
            </div>
          </section>

          <div
            style={{
              ...styles.grid,
              gridTemplateColumns:
                pago || isMobile
                  ? "1fr"
                  : "minmax(0, 1.05fr) minmax(340px, 0.95fr)",
            }}
          >
            <div style={styles.card}>
              <div style={styles.cardBody}>
                <h2 style={styles.sectionTitle}>
                  {pago
                    ? "Saldo quitado"
                    : expirado
                    ? "Pagamento não concluído"
                    : cancelado
                    ? "Pagamento cancelado"
                    : "Aguardando pagamento"}
                </h2>

                <p style={styles.sectionText}>
                  {pago
                    ? "Seu débito com a plataforma já foi regularizado."
                    : expirado
                    ? "Esse PIX venceu antes da confirmação do pagamento."
                    : cancelado
                    ? "Esse pagamento foi cancelado e não pode mais ser usado."
                    : "Escaneie o QR Code ou use o código copia e cola abaixo para quitar o saldo pendente."}
                </p>

                {pago ? (
                  <div style={styles.statusSuccessBox}>
                    <h3 style={{ ...styles.statusTitle, color: "#166534" }}>
                      ✅ Pagamento aprovado
                    </h3>
                    <p style={styles.statusText}>
                      O saldo pendente foi quitado e sua situação financeira foi regularizada.
                    </p>

                    <div style={styles.actionsRow}>
                      <Link to="/dono/central" style={styles.greenBtn}>
                        Voltar para central
                      </Link>

                      <Link to="/home" style={styles.secondaryBtn}>
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
                      O prazo de pagamento terminou. Gere um novo PIX para concluir a quitação do saldo.
                    </p>

                    <div style={styles.actionsRow}>
                      <button
                        type="button"
                        onClick={() => void solicitarPixSaldo(true)}
                        style={styles.primaryBtn}
                      >
                        Gerar novo PIX
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
                ) : cancelado ? (
                  <div style={styles.statusCanceledBox}>
                    <h3 style={{ ...styles.statusTitle, color: "#334155" }}>
                      🚫 Pagamento cancelado
                    </h3>
                    <p style={styles.statusText}>
                      Esse pagamento foi cancelado. Gere um novo PIX para regularizar o saldo.
                    </p>

                    <div style={styles.actionsRow}>
                      <button
                        type="button"
                        onClick={() => void solicitarPixSaldo(true)}
                        style={styles.primaryBtn}
                      >
                        Gerar novo PIX
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
                ) : (
                  <>
                    <div style={styles.statusPendingBox}>
                      <h3 style={{ ...styles.statusTitle, color: "#1d4ed8" }}>
                        🕐 Pagamento pendente
                      </h3>

                      <p style={styles.statusText}>
                        Assim que o banco confirmar o PIX, essa tela muda automaticamente para sucesso.
                      </p>

                      <p
                        style={{
                          margin: "12px 0 0",
                          fontWeight: 900,
                          fontSize: 16,
                          color: expiraEm ? "#1d4ed8" : "#b45309",
                        }}
                      >
                        {expiraEm
                          ? tempoRestante > 0
                            ? `⏳ Expira em: ${formatarTempo(tempoRestante)}`
                            : "⛔ PIX expirado"
                          : "⌛ Gerando dados do PIX..."}
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

                      {pagamento?.pixQrBase64 ? (
                        <div style={styles.qrWrap}>
                          <img
                            src={`data:image/png;base64,${pagamento.pixQrBase64}`}
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
                          Os dados do QR Code ainda não chegaram. Clique em
                          <strong> Atualizar status</strong>.
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
                        value={String(pagamento?.pixCopiaECola ?? "")}
                        readOnly
                        style={styles.textarea}
                      />

                      <div style={styles.actionsRow}>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!podeCopiarPix) return;

                            try {
                              await navigator.clipboard.writeText(
                                String(pagamento?.pixCopiaECola ?? "")
                              );

                              setCopiado(true);

                              setTimeout(() => {
                                setCopiado(false);
                              }, 2000);
                            } catch {
                              setErro("Não consegui copiar. Copie manualmente.");
                            }
                          }}
                          style={{
                            ...styles.primaryBtn,
                            opacity: podeCopiarPix ? 1 : 0.6,
                            cursor: podeCopiarPix ? "pointer" : "not-allowed",
                          }}
                          disabled={!podeCopiarPix}
                        >
                          {copiado ? "Copiado ✅" : "Copiar código PIX"}
                        </button>

                        <button
  type="button"
  onClick={() => window.location.reload()}
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
                    <h2 style={styles.sectionTitle}>Resumo do pagamento</h2>
                    <p style={styles.sectionText}>
                      Confira os dados antes de concluir o pagamento.
                    </p>

                    <div
                      style={{
                        ...styles.summaryGrid,
                        gridTemplateColumns: isMobile
                          ? "1fr"
                          : "repeat(2, minmax(0, 1fr))",
                      }}
                    >
                      <div style={styles.summaryItem}>
                        <p style={styles.summaryLabel}>Tipo</p>
                        <p style={styles.summaryValue}>Saldo pendente</p>
                      </div>

                      <div style={styles.summaryItem}>
                        <p style={styles.summaryLabel}>Valor</p>
                        <p style={styles.summaryValue}>
                          {formatBRL(valorCentavos / 100)}
                        </p>
                      </div>

                      <div style={styles.summaryItem}>
                        <p style={styles.summaryLabel}>Status</p>
                        <p style={styles.summaryValue}>
                          {pago
                            ? "Quitado"
                            : expirado
                            ? "PIX expirado"
                            : cancelado
                            ? "Cancelado"
                            : "Aguardando pagamento"}
                        </p>
                      </div>

                      <div style={styles.summaryItem}>
                        <p style={styles.summaryLabel}>Cobrança</p>
                        <p style={styles.summaryValue}>PIX Mercado Pago</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div style={styles.card}>
                  <div style={styles.cardBody}>
                    <h2 style={styles.sectionTitle}>Importante</h2>
                    <p style={styles.sectionText}>
                      O app atualiza este pagamento automaticamente quando o PIX
                      for reconhecido.
                    </p>

                    <div style={styles.noteBox}>
                      Depois do pagamento, você verá aqui a mensagem de sucesso
                      com os botões:
                      <strong> Voltar para central</strong> e
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