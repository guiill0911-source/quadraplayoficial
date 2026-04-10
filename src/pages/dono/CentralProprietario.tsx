import { Link } from "react-router-dom";
import Header from "../../components/Header";
import { doc, getDoc } from "firebase/firestore";
import { db, auth, app } from "../../services/firebase";
import { useEffect, useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";

type MpConnectionStatus = "not_connected" | "pending" | "connected" | "error";

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "linear-gradient(180deg, #03122e 0px, #053ff9 180px, #f8fafc 180px, #f8fafc 100%)",
  },

  container: {
    maxWidth: 1180,
    margin: "0 auto",
    padding: "18px 16px 40px",
  },

  hero: {
    background: "linear-gradient(135deg, #053ff9, #2563eb)",
    color: "#fff",
    borderRadius: 24,
    padding: "26px 24px",
    boxShadow: "0 18px 45px rgba(15,23,42,0.20)",
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
    fontSize: 36,
    lineHeight: 1.08,
    fontWeight: 900,
  },

  heroText: {
    marginTop: 12,
    marginBottom: 0,
    color: "rgba(255,255,255,0.85)",
    fontSize: 15,
    lineHeight: 1.6,
    maxWidth: 760,
  },

  statusRow: {
    marginTop: 16,
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 12,
  },

  statusCard: {
    padding: 14,
    borderRadius: 16,
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    color: "#03122e",
    minHeight: 88,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    boxShadow: "0 10px 25px rgba(3,18,46,0.06)",
  },

  statusTitle: {
    margin: 0,
    fontSize: 14,
    fontWeight: 900,
    color: "#03122e",
  },

  statusMain: {
    marginTop: 6,
    fontSize: 15,
    fontWeight: 800,
    color: "#03122e",
  },

  statusHint: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 1.5,
    color: "#64748b",
  },

  statusBadgeRed: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    width: "fit-content",
    marginTop: 8,
    padding: "7px 10px",
    borderRadius: 999,
    background: "#fee2e2",
    color: "#b91c1c",
    fontWeight: 900,
    fontSize: 12,
  },

  statusBadgeYellow: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    width: "fit-content",
    marginTop: 8,
    padding: "7px 10px",
    borderRadius: 999,
    background: "#fef3c7",
    color: "#b45309",
    fontWeight: 900,
    fontSize: 12,
  },

  statusBadgeGreen: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    width: "fit-content",
    marginTop: 8,
    padding: "7px 10px",
    borderRadius: 999,
    background: "#dcfce7",
    color: "#166534",
    fontWeight: 900,
    fontSize: 12,
  },

  actionButtonDark: {
    marginTop: 10,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 40,
    padding: "0 14px",
    borderRadius: 12,
    background: "#8ae809",
color: "#03122e",
    fontWeight: 900,
    fontSize: 13,
    textDecoration: "none",
    border: "none",
    cursor: "pointer",
    width: "fit-content",
  },

  actionButtonGreen: {
    marginTop: 10,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 40,
    padding: "0 14px",
    borderRadius: 12,
    background: "#8ae809",
    color: "#03122e",   
    fontWeight: 900,
    fontSize: 13,
    textDecoration: "none",
    border: "none",
    cursor: "pointer",
    width: "fit-content",
  },

  section: {
    marginTop: 18,
    background: "#ffffff",
    borderRadius: 22,
    padding: 18,
    border: "1px solid #e5e7eb",
    boxShadow: "0 10px 28px rgba(15,23,42,0.06)",
  },

  sectionTitle: {
    margin: 0,
    fontSize: 24,
    color: "#03122e",
    fontWeight: 900,
  },

  sectionText: {
    margin: "8px 0 0",
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.6,
  },

  grid: {
    marginTop: 18,
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 16,
  },

  cardLink: {
    textDecoration: "none",
    color: "inherit",
  },

  card: {
    background: "#fff",
    borderRadius: 22,
    border: "1px solid #e5e7eb",
    boxShadow: "0 12px 32px rgba(15,23,42,0.08)",
    overflow: "hidden",
    minHeight: 230,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  },

  cardTopBlue: {
    padding: 20,
    background: "linear-gradient(135deg, #053ff9, #2563eb)",
    color: "#fff",
  },

  cardTopGreen: {
    padding: 20,
    background: "#8ae809",
color: "#fff",
  },

  cardTopDark: {
    padding: 20,
    background: "#03122e",
    color: "#fff",
  },

  cardEmoji: {
    fontSize: 32,
    lineHeight: 1,
    display: "block",
    marginBottom: 12,
  },

  cardTitle: {
    margin: 0,
    fontSize: 26,
    lineHeight: 1.1,
    fontWeight: 900,
  },

  cardSubtitle: {
    marginTop: 10,
    marginBottom: 0,
    fontSize: 14,
    lineHeight: 1.6,
    color: "rgba(255,255,255,0.92)",
  },

  cardBottom: {
    padding: 18,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },

  cardMeta: {
    color: "#64748b",
    fontSize: 13,
    fontWeight: 700,
  },

  ctaBlue: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 42,
    padding: "0 16px",
    borderRadius: 14,
    background: "#053ff9",
    color: "#fff",
    fontWeight: 900,
    boxShadow: "0 10px 20px rgba(37,99,235,0.18)",
  },

  ctaGreen: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 42,
    padding: "0 16px",
    borderRadius: 14,
    background: "#8ae809",
    color: "#fff",
    fontWeight: 900,
    boxShadow: "0 10px 20px rgba(16,185,129,0.18)",
  },

  ctaDark: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 42,
    padding: "0 16px",
    borderRadius: 14,
    background: "#03122e",
    color: "#fff",
    fontWeight: 900,
    boxShadow: "0 10px 20px rgba(15,23,42,0.18)",
  },
};

function getMpVisual(status: MpConnectionStatus) {
  switch (status) {
    case "connected":
      return {
        titulo: "Mercado Pago conectado",
        badge: <div style={styles.statusBadgeGreen}>🟢 Conta conectada</div>,
        texto:
          "Sua conta está pronta para receber pagamentos online quando o split automático for ativado.",
        botaoTexto: "Conta conectada",
        botaoStyle: styles.actionButtonGreen,
      };
    case "pending":
      return {
        titulo: "Conexão em análise",
        badge: <div style={styles.statusBadgeYellow}>🟡 Conexão pendente</div>,
        texto:
          "Sua conexão com o Mercado Pago foi iniciada, mas ainda não foi concluída.",
        botaoTexto: "Continuar conexão",
        botaoStyle: styles.actionButtonDark,
      };
    case "error":
      return {
        titulo: "Problema na conexão",
        badge: <div style={styles.statusBadgeRed}>🔴 Erro de conexão</div>,
        texto:
          "Encontramos um problema na conexão da sua conta. Será preciso reconectar.",
        botaoTexto: "Reconectar conta",
        botaoStyle: styles.actionButtonDark,
      };
    case "not_connected":
    default:
      return {
        titulo: "Recebimentos online",
        badge: <div style={styles.statusBadgeRed}>🔴 Não conectado</div>,
        texto:
          "Conecte sua conta Mercado Pago para liberar recebimentos online por Pix no futuro.",
        botaoTexto: "Conectar Mercado Pago",
        botaoStyle: styles.actionButtonDark,
      };
  }
}

export default function CentralProprietario() {
  const [saldo, setSaldo] = useState(0);
  const [mpStatus, setMpStatus] =
    useState<MpConnectionStatus>("not_connected");
  const [carregandoMp, setCarregandoMp] = useState(true);
  const [conectandoMp, setConectandoMp] = useState(false);

  useEffect(() => {
    async function carregar() {
      try {
        const uid = auth.currentUser?.uid;

        if (!uid) {
          setCarregandoMp(false);
          return;
        }

        const financeiroRef = doc(db, "financeiro_donos", uid);
        const financeiroSnap = await getDoc(financeiroRef);

        if (financeiroSnap.exists()) {
          const data = financeiroSnap.data() as any;
          setSaldo(Number(data?.saldoCentavos ?? 0));
        }

        const userRef = doc(db, "users", uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const userData = userSnap.data() as any;
          const status = userData?.mpConnectionStatus;

          if (
            status === "not_connected" ||
            status === "pending" ||
            status === "connected" ||
            status === "error"
          ) {
            setMpStatus(status);
          } else {
            setMpStatus("not_connected");
          }
        } else {
          setMpStatus("not_connected");
        }
      } catch (error) {
        console.error("Erro ao carregar central do proprietário:", error);
        setMpStatus("error");
      } finally {
        setCarregandoMp(false);
      }
    }

    carregar();
  }, []);

  const mpVisual = getMpVisual(mpStatus);

  return (
    <>
      <Header />

      <div style={styles.page}>
        <div style={styles.container}>
          <div style={styles.hero}>
            <div style={styles.heroBadge}>Área do proprietário</div>

            <h1 style={styles.heroTitle}>Central do Proprietário</h1>

            <div style={styles.statusRow}>
              <div
                style={{
                  ...styles.statusCard,
                  border:
                    saldo < 0
  ? "1px solid #ef4444"
  : saldo > 0
  ? "1px solid #8ae809"
  : "1px solid #e5e7eb"
                }}
              >
                <h3 style={styles.statusTitle}>Saldo com a plataforma</h3>

                {saldo < 0 ? (
                  <>
                    <div style={styles.statusMain}>
                      💰 Saldo: R$ {(saldo / 100).toFixed(2)}
                    </div>
                    <div style={{ ...styles.statusHint, color: "#dc2626" }}>
                      Você possui valores pendentes com a plataforma.
                    </div>

                    <button
                      style={styles.actionButtonGreen}
                      onClick={() => {
                        window.location.href = "/dono/pagamento-saldo";
                      }}
                    >
                      Pagar com PIX
                    </button>
                  </>
                ) : saldo > 0 ? (
                  <>
                    <div style={styles.statusMain}>
                      💰 Saldo: R$ {(saldo / 100).toFixed(2)}
                    </div>
                    <div style={{ ...styles.statusHint, color: "#166534" }}>
                      Você tem saldo positivo disponível.
                    </div>
                  </>
                ) : (
                  <>
                    <div style={styles.statusMain}>
                      💰 Nenhum saldo pendente no momento
                    </div>
                    <div style={styles.statusHint}>
                      Seu financeiro com a plataforma está em dia.
                    </div>
                  </>
                )}
              </div>

              <div style={styles.statusCard}>
                <h3 style={styles.statusTitle}>
                  {carregandoMp
                    ? "Carregando conexão Mercado Pago"
                    : mpVisual.titulo}
                </h3>

                {carregandoMp ? (
                  <>
                    <div style={styles.statusMain}>⌛ Verificando status...</div>
                    <div style={styles.statusHint}>
                      Aguarde enquanto conferimos a conexão da sua conta.
                    </div>
                  </>
                ) : (
                  <>
                    {mpVisual.badge}
                    <div style={styles.statusHint}>{mpVisual.texto}</div>

                    <button
                      style={mpVisual.botaoStyle}
                      disabled={conectandoMp}
                      onClick={async () => {
  try {
    setConectandoMp(true);

    const functions = getFunctions(app);
    const call = httpsCallable(functions, "criarLinkConectarMercadoPago");

    const res: any = await call();

    const url = res?.data?.url;

    if (!url) {
      throw new Error("URL de conexão não retornada.");
    }

    window.location.href = url;
  } catch (err) {
    console.error(err);
    alert("Erro ao iniciar conexão com Mercado Pago.");
  } finally {
    setConectandoMp(false);
  }
}}
                    >
                      {conectandoMp ? "Conectando..." : mpVisual.botaoTexto}
                    </button>
                  </>
                )}
              </div>
            </div>

            <p style={styles.heroText}>
              Gerencie suas quadras, cadastre novos espaços e acompanhe o
              financeiro do seu negócio em um só lugar.
            </p>
          </div>

          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Acessos rápidos</h2>
            <p style={styles.sectionText}>
              Escolha uma área para administrar seu painel de forma rápida e
              organizada.
            </p>

            <div style={styles.grid}>
              <Link to="/dono" style={styles.cardLink}>
                <div style={styles.card}>
                  <div style={styles.cardTopBlue}>
                    <span style={styles.cardEmoji}>🏟️</span>
                    <h3 style={styles.cardTitle}>Minhas Quadras</h3>
                    <p style={styles.cardSubtitle}>
                      Veja todas as suas quadras, acompanhe reservas, horários e
                      gestão diária.
                    </p>
                  </div>

                  <div style={styles.cardBottom}>
                    <div style={styles.cardMeta}>Painel principal de gestão</div>
                    <div style={styles.ctaBlue}>Abrir painel</div>
                  </div>
                </div>
              </Link>

              <Link to="/nova-quadra" style={styles.cardLink}>
                <div style={styles.card}>
                  <div style={styles.cardTopGreen}>
                    <span style={styles.cardEmoji}>➕</span>
                    <h3 style={styles.cardTitle}>Nova Quadra</h3>
                    <p style={styles.cardSubtitle}>
                      Cadastre uma nova quadra no aplicativo e amplie sua
                      operação.
                    </p>
                  </div>

                  <div style={styles.cardBottom}>
                    <div style={styles.cardMeta}>Adicionar novo espaço</div>
                    <div style={styles.ctaGreen}>Cadastrar agora</div>
                  </div>
                </div>
              </Link>

              <Link to="/dono/financeiro" style={styles.cardLink}>
                <div style={styles.card}>
                  <div style={styles.cardTopDark}>
                    <span style={styles.cardEmoji}>📊</span>
                    <h3 style={styles.cardTitle}>Financeiro</h3>
                    <p style={styles.cardSubtitle}>
                      Acompanhe receitas, movimentos e a saúde financeira das
                      suas quadras.
                    </p>
                  </div>

                  <div style={styles.cardBottom}>
                    <div style={styles.cardMeta}>
                      Resultados e visão financeira
                    </div>
                    <div style={styles.ctaDark}>Ver financeiro</div>
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}