import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../services/authContext";
import { logout } from "../services/authService";

const styles = {
  page: {
    minHeight: "100vh",
    background:
      "linear-gradient(180deg, #f8fafc 0%, #eef4ff 45%, #f8fafc 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px 16px",
  } as const,

  shell: {
    width: "100%",
    maxWidth: 1100,
    display: "grid",
    gridTemplateColumns: "1.08fr 0.92fr",
    gap: 24,
    alignItems: "stretch",
  } as const,

  hero: {
    position: "relative" as const,
    overflow: "hidden",
    borderRadius: 30,
    padding: "34px 30px",
    minHeight: 620,
    background:
      "linear-gradient(135deg, #0f172a 0%, #1d4ed8 55%, #38bdf8 100%)",
    color: "#fff",
    boxShadow: "0 22px 60px rgba(15, 23, 42, 0.18)",
    display: "flex",
    flexDirection: "column" as const,
    justifyContent: "space-between",
  },

  glow1: {
    position: "absolute" as const,
    right: -60,
    top: -40,
    width: 220,
    height: 220,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.12)",
    filter: "blur(10px)",
  },

  glow2: {
    position: "absolute" as const,
    left: -60,
    bottom: -80,
    width: 260,
    height: 260,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.10)",
    filter: "blur(12px)",
  },

  heroContent: {
    position: "relative" as const,
    zIndex: 1,
  },

  badge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.15)",
    border: "1px solid rgba(255,255,255,0.18)",
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 0.3,
    marginBottom: 16,
  } as const,

  brand: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    marginBottom: 18,
  } as const,

  logo: {
    width: 52,
    height: 52,
    borderRadius: 16,
    display: "grid",
    placeItems: "center",
    background: "rgba(255,255,255,0.16)",
    border: "1px solid rgba(255,255,255,0.18)",
    fontWeight: 900,
    fontSize: 17,
  } as const,

  brandName: {
    margin: 0,
    fontSize: 20,
    fontWeight: 900,
    letterSpacing: -0.3,
  } as const,

  title: {
    margin: 0,
    fontSize: "clamp(36px, 4vw, 56px)",
    lineHeight: 1.02,
    fontWeight: 900,
    letterSpacing: -1,
    maxWidth: 560,
  } as const,

  text: {
    margin: "16px 0 0",
    maxWidth: 560,
    fontSize: 16,
    lineHeight: 1.7,
    color: "rgba(255,255,255,0.92)",
  } as const,

  stats: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 12,
    marginTop: 28,
  } as const,

  statCard: {
    borderRadius: 18,
    padding: 14,
    background: "rgba(255,255,255,0.12)",
    border: "1px solid rgba(255,255,255,0.18)",
  } as const,

  statLabel: {
    margin: 0,
    fontSize: 12,
    color: "rgba(255,255,255,0.78)",
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  } as const,

  statValue: {
    margin: "8px 0 0",
    fontSize: 18,
    fontWeight: 900,
    color: "#fff",
  } as const,

  heroFooter: {
    position: "relative" as const,
    zIndex: 1,
    marginTop: 24,
    borderTop: "1px solid rgba(255,255,255,0.15)",
    paddingTop: 18,
    color: "rgba(255,255,255,0.88)",
    lineHeight: 1.6,
    fontSize: 14,
  } as const,

  cardWrap: {
    display: "flex",
    alignItems: "center",
  } as const,

  card: {
    width: "100%",
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 30,
    boxShadow: "0 18px 42px rgba(15, 23, 42, 0.08)",
    overflow: "hidden",
  } as const,

  cardBody: {
    padding: "32px 26px",
  } as const,

  pill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    borderRadius: 999,
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    color: "#1d4ed8",
    fontSize: 12,
    fontWeight: 900,
    marginBottom: 14,
  } as const,

  cardTitle: {
    margin: 0,
    fontSize: 34,
    lineHeight: 1.05,
    fontWeight: 900,
    color: "#0f172a",
    letterSpacing: -0.8,
  } as const,

  cardText: {
    margin: "12px 0 0",
    color: "#64748b",
    fontSize: 15,
    lineHeight: 1.65,
  } as const,

  infoBox: {
    marginTop: 18,
    border: "1px solid #dbeafe",
    background: "#eff6ff",
    color: "#1e3a8a",
    borderRadius: 18,
    padding: 14,
    fontSize: 14,
    lineHeight: 1.6,
    fontWeight: 700,
  } as const,

  infoBoxLogged: {
    marginTop: 18,
    border: "1px solid #bbf7d0",
    background: "#ecfdf5",
    color: "#166534",
    borderRadius: 18,
    padding: 14,
    fontSize: 14,
    lineHeight: 1.6,
    fontWeight: 700,
  } as const,

  list: {
    margin: "18px 0 0",
    padding: 0,
    listStyle: "none",
    display: "grid",
    gap: 10,
  } as const,

  listItem: {
    borderRadius: 16,
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    padding: "13px 14px",
    color: "#0f172a",
    fontSize: 14,
    fontWeight: 700,
    lineHeight: 1.5,
  } as const,

  actions: {
    marginTop: 20,
    display: "grid",
    gap: 10,
  } as const,

  primaryBtn: {
    width: "100%",
    minHeight: 50,
    borderRadius: 16,
    border: "none",
    background: "linear-gradient(135deg, #111827 0%, #0f172a 100%)",
    color: "#fff",
    fontWeight: 900,
    fontSize: 15,
    cursor: "pointer",
    boxShadow: "0 12px 24px rgba(15, 23, 42, 0.18)",
    textDecoration: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  } as const,

  secondaryBtn: {
    width: "100%",
    minHeight: 50,
    borderRadius: 16,
    border: "1px solid #cbd5e1",
    background: "#fff",
    color: "#0f172a",
    fontWeight: 900,
    fontSize: 15,
    cursor: "pointer",
    textDecoration: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  } as const,

  footNote: {
    margin: "16px 0 0",
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.6,
    textAlign: "center" as const,
  },
};

export default function EmBreve() {
  const { user } = useAuth();
  const navigate = useNavigate();

  async function handleSair() {
    try {
      await logout();
      navigate("/");
    } catch (e) {
      console.error("Erro ao sair:", e);
      alert("Não foi possível sair agora.");
    }
  }

  const estaLogado = !!user;

  return (
    <div style={styles.page}>
      <div style={styles.shell}>
        <section style={styles.hero}>
          <div style={styles.glow1} />
          <div style={styles.glow2} />

          <div style={styles.heroContent}>
            <div style={styles.badge}>LANÇAMENTO EM BREVE</div>

            <div style={styles.brand}>
              <div style={styles.logo}>QP</div>
              <div>
                <p style={styles.brandName}>Quadra Play</p>
              </div>
            </div>

            <h1 style={styles.title}>
              O app das quadras está chegando com tudo.
            </h1>

            <p style={styles.text}>
              Estamos preparando as primeiras quadras e finalizando os últimos
              detalhes para entregar uma experiência profissional desde o
              primeiro acesso.
            </p>

            <div style={styles.stats}>
              <div style={styles.statCard}>
                <p style={styles.statLabel}>Foco</p>
                <p style={styles.statValue}>Qualidade real</p>
              </div>

              <div style={styles.statCard}>
                <p style={styles.statLabel}>Objetivo</p>
                <p style={styles.statValue}>Quadras ativas</p>
              </div>

              <div style={styles.statCard}>
                <p style={styles.statLabel}>Etapa</p>
                <p style={styles.statValue}>Pré-lançamento</p>
              </div>
            </div>
          </div>

          <div style={styles.heroFooter}>
            Em breve novas quadras, reservas e uma experiência muito mais forte
            para atletas e donos dentro do Quadra Play.
          </div>
        </section>

        <section style={styles.cardWrap}>
          <div style={styles.card}>
            <div style={styles.cardBody}>
              <div style={styles.pill}>
                {estaLogado ? "CONTA JÁ ATIVA" : "ACESSO ANTECIPADO"}
              </div>

              <h2 style={styles.cardTitle}>
                {estaLogado
                  ? "Sua conta já está ativa."
                  : "Estamos abrindo as portas."}
              </h2>

              <p style={styles.cardText}>
                {estaLogado
                  ? "Você já faz parte do Quadra Play. Agora estamos finalizando os últimos detalhes para liberar a experiência completa dentro do app."
                  : "Você já pode entrar no ecossistema do Quadra Play e acompanhar a chegada das primeiras quadras disponíveis."}
              </p>

              <div style={estaLogado ? styles.infoBoxLogged : styles.infoBox}>
                {estaLogado
                  ? "Seu acesso já está criado com sucesso. Em breve as quadras e reservas serão liberadas para uso completo."
                  : "O app está em fase de pré-lançamento. As reservas e novas quadras serão liberadas em breve."}
              </div>

              <ul style={styles.list}>
                <li style={styles.listItem}>
                  ✅ Layout profissional e base do app já pronta
                </li>
                <li style={styles.listItem}>
                  ✅ Cadastro e acesso já disponíveis
                </li>
                <li style={styles.listItem}>
                  🚀 Em breve: novas quadras e operação completa
                </li>
              </ul>

              <div style={styles.actions}>
                {estaLogado ? (
                  <>
                    <Link to="/perfil" style={styles.primaryBtn}>
                      Ver meu perfil
                    </Link>

                    <button
                      type="button"
                      onClick={handleSair}
                      style={styles.secondaryBtn}
                    >
                      Sair
                    </button>
                  </>
                ) : (
                  <>
                    <Link to="/cadastro" style={styles.primaryBtn}>
                      Criar conta
                    </Link>

                    <Link to="/login" style={styles.secondaryBtn}>
                      Entrar
                    </Link>
                  </>
                )}
              </div>

              <p style={styles.footNote}>
                Assim que as primeiras quadras forem liberadas, a experiência
                completa será aberta dentro do app.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}