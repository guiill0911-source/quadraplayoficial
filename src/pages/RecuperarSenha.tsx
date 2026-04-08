import { useState } from "react";
import { Link } from "react-router-dom";
import { enviarRecuperacaoSenha } from "../services/authService";

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
    maxWidth: 1080,
    display: "grid",
    gridTemplateColumns: window.innerWidth < 768 ? "1fr" : "1.02fr 0.98fr",
    gap: 24,
    alignItems: "stretch",
  } as const,

  hero: {
    position: "relative" as const,
    overflow: "hidden",
    borderRadius: 30,
    padding: "34px 30px",
    minHeight: 540,
    background:
      "linear-gradient(135deg, #0f172a 0%, #1d4ed8 55%, #38bdf8 100%)",
    color: "#fff",
    boxShadow: "0 22px 60px rgba(15, 23, 42, 0.18)",
    display: "flex",
    flexDirection: "column" as const,
    justifyContent: "space-between",
  },

  heroGlow: {
    position: "absolute" as const,
    right: -60,
    top: -50,
    width: 230,
    height: 230,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.12)",
    filter: "blur(10px)",
  },

  heroGlow2: {
    position: "absolute" as const,
    left: -50,
    bottom: -80,
    width: 250,
    height: 250,
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

  brandLogo: {
    width: 48,
    height: 48,
    borderRadius: 14,
    display: "grid",
    placeItems: "center",
    background: "rgba(255,255,255,0.16)",
    border: "1px solid rgba(255,255,255,0.18)",
    fontWeight: 900,
    fontSize: 16,
  } as const,

  brandName: {
    margin: 0,
    fontSize: 18,
    fontWeight: 900,
    letterSpacing: -0.3,
  } as const,

  heroTitle: {
    margin: 0,
    fontSize: "clamp(34px, 4vw, 50px)",
    lineHeight: 1.04,
    fontWeight: 900,
    letterSpacing: -1,
    maxWidth: 520,
  } as const,

  heroText: {
    margin: "14px 0 0",
    maxWidth: 520,
    fontSize: 16,
    lineHeight: 1.7,
    color: "rgba(255,255,255,0.92)",
  } as const,

  heroStats: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 12,
    marginTop: 28,
  } as const,

  heroStatCard: {
    borderRadius: 18,
    padding: 14,
    background: "rgba(255,255,255,0.12)",
    border: "1px solid rgba(255,255,255,0.18)",
  } as const,

  heroStatLabel: {
    margin: 0,
    fontSize: 12,
    color: "rgba(255,255,255,0.78)",
    fontWeight: 700,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  } as const,

  heroStatValue: {
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
    padding: "30px 26px",
  } as const,

  cardTop: {
    marginBottom: 20,
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
    margin: "10px 0 0",
    color: "#64748b",
    fontSize: 15,
    lineHeight: 1.6,
  } as const,

  field: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
    marginTop: 14,
  } as const,

  label: {
    fontSize: 13,
    fontWeight: 800,
    color: "#334155",
  } as const,

  input: {
    width: "100%",
    borderRadius: 16,
    border: "1px solid #cbd5e1",
    background: "#fff",
    padding: "14px 16px",
    fontSize: 15,
    outline: "none",
    color: "#0f172a",
  } as const,

  helperBox: {
  marginTop: 14,
  border: "1px solid #e0e7ff",
  background: "#f8fafc",
  color: "#334155",
  borderRadius: 14,
  padding: 10,
  fontSize: 13,
  lineHeight: 1.5,
  fontWeight: 600,
} as const,

  error: {
    marginTop: 14,
    border: "1px solid #fecaca",
    background: "#fff1f2",
    color: "#b91c1c",
    borderRadius: 16,
    padding: 12,
    fontSize: 14,
    fontWeight: 700,
  } as const,

  success: {
    marginTop: 14,
    border: "1px solid #bbf7d0",
    background: "#f0fdf4",
    color: "#166534",
    borderRadius: 16,
    padding: 12,
    fontSize: 14,
    fontWeight: 700,
    lineHeight: 1.5,
  } as const,

  submitBtn: {
    marginTop: 18,
    width: "100%",
    padding: "14px 16px",
    borderRadius: 16,
    border: "none",
    background: "linear-gradient(135deg, #111827 0%, #0f172a 100%)",
    color: "#fff",
    fontWeight: 900,
    fontSize: 15,
    cursor: "pointer",
    boxShadow: "0 12px 24px rgba(15, 23, 42, 0.18)",
  } as const,

  submitBtnDisabled: {
    marginTop: 18,
    width: "100%",
    padding: "14px 16px",
    borderRadius: 16,
    border: "none",
    background: "#e5e7eb",
    color: "#475569",
    fontWeight: 900,
    fontSize: 15,
    cursor: "not-allowed",
  } as const,

  linksBox: {
    marginTop: 18,
    display: "grid",
    gap: 10,
  } as const,

  linkRow: {
    margin: 0,
    color: "#475569",
    fontSize: 14,
    lineHeight: 1.5,
  } as const,

  strongLink: {
    color: "#1d4ed8",
    fontWeight: 800,
    textDecoration: "none",
  } as const,
};

export default function RecuperarSenha() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [msg, setMsg] = useState("");

  async function enviar() {
    setErro("");
    setMsg("");

    setLoading(true);
    try {
      await enviarRecuperacaoSenha(email);
      setMsg("Enviamos um link de recuperação para seu email (se ele existir no sistema).");
    } catch (e: any) {
      setErro(e?.message ?? "Erro ao enviar recuperação.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.shell}>
        {window.innerWidth >= 768 && (
  <section style={styles.hero}>
          <div style={styles.heroGlow} />
          <div style={styles.heroGlow2} />

          <div style={styles.heroContent}>
            <div style={styles.badge}>RECUPERAÇÃO DE ACESSO</div>

            <div style={styles.brand}>
              <div style={styles.brandLogo}>QP</div>
              <div>
                <p style={styles.brandName}>Quadra Play</p>
              </div>
            </div>

            <h1 style={styles.heroTitle}>Recupere seu acesso com segurança.</h1>

            <p style={styles.heroText}>
              Informe seu email para receber o link de recuperação e voltar a acessar
              sua conta no Quadra Play com rapidez e segurança.
            </p>

            <div style={styles.heroStats}>
              <div style={styles.heroStatCard}>
                <p style={styles.heroStatLabel}>Acesso</p>
                <p style={styles.heroStatValue}>Seguro</p>
              </div>

              <div style={styles.heroStatCard}>
                <p style={styles.heroStatLabel}>Processo</p>
                <p style={styles.heroStatValue}>Rápido</p>
              </div>

              <div style={styles.heroStatCard}>
                <p style={styles.heroStatLabel}>Retorno</p>
                <p style={styles.heroStatValue}>Sem complicação</p>
              </div>
            </div>
          </div>

          <div style={styles.heroFooter}>
            Continue usando o Quadra Play para gerenciar reservas, quadras e rotina
            financeira com mais organização.
          </div>
        </section>
)}

        <section style={styles.cardWrap}>
          <div style={styles.card}>
            <div style={styles.cardBody}>
              <div style={styles.cardTop}>
                <h2 style={styles.cardTitle}>Recuperar senha</h2>
                <p style={styles.cardText}>
                  Digite seu email para receber as instruções de recuperação.
                </p>
              </div>

              <div style={styles.field}>
                <label style={styles.label}>Email</label>
                <input
                  placeholder="seuemail@exemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={styles.input}
                />
              </div>

              <div style={styles.helperBox}>
                Se o email estiver cadastrado, você receberá um link para redefinir
                sua senha com segurança.
              </div>

              {erro ? <div style={styles.error}>{erro}</div> : null}
              {msg ? <div style={styles.success}>{msg}</div> : null}

              <button
                onClick={enviar}
                disabled={loading}
                style={loading ? styles.submitBtnDisabled : styles.submitBtn}
              >
                {loading ? "Enviando..." : "Enviar link"}
              </button>

              <div style={styles.linksBox}>
                <p style={styles.linkRow}>
                  <Link to="/login" style={styles.strongLink}>
                    ← Voltar para login
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}