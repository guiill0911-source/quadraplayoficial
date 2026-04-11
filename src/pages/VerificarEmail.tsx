import { Link, useNavigate } from "react-router-dom";
import { reenviarEmailVerificacao } from "../services/authService";
import { useState } from "react";

const styles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(180deg, #03122e 0%, #053ff9 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px 16px",
  } as const,

  card: {
    width: "100%",
    maxWidth: 560,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 30,
    boxShadow: "0 18px 42px rgba(15, 23, 42, 0.08)",
    overflow: "hidden",
  } as const,

  body: {
    padding: "34px 28px",
  } as const,

  badge: {
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
    marginBottom: 16,
  } as const,

  title: {
    margin: 0,
    fontSize: 34,
    lineHeight: 1.05,
    fontWeight: 900,
    color: "#0f172a",
    letterSpacing: -0.8,
  } as const,

  text: {
    margin: "14px 0 0",
    color: "#475569",
    fontSize: 15,
    lineHeight: 1.7,
  } as const,

  infoBox: {
    marginTop: 20,
    border: "1px solid #dbeafe",
    background: "#eff6ff",
    color: "#1e3a8a",
    borderRadius: 18,
    padding: 16,
    fontSize: 14,
    lineHeight: 1.65,
    fontWeight: 700,
  } as const,
  

  successBox: {
    marginTop: 16,
    border: "1px solid #d1fae5",
    background: "#ecfdf5",
    color: "#065f46",
    borderRadius: 18,
    padding: 16,
    fontSize: 14,
    lineHeight: 1.65,
    fontWeight: 700,
  } as const,

  actions: {
    display: "grid",
    gap: 10,
    marginTop: 22,
  } as const,

  primaryBtn: {
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

  secondaryBtn: {
    width: "100%",
    padding: "14px 16px",
    borderRadius: 16,
    border: "1px solid #cbd5e1",
    background: "#fff",
    color: "#0f172a",
    fontWeight: 900,
    fontSize: 15,
    cursor: "pointer",
  } as const,

  footer: {
    marginTop: 18,
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.6,
  } as const,

  strongLink: {
    color: "#1d4ed8",
    fontWeight: 800,
    textDecoration: "none",
  } as const,
};

export default function VerificarEmail() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);
const [msg, setMsg] = useState<string | null>(null);
const [erro, setErro] = useState<string | null>(null);

async function handleReenviar() {
  setLoading(true);
  setMsg(null);
  setErro(null);

  try {
    await reenviarEmailVerificacao();
    setMsg("E-mail reenviado com sucesso. Verifique sua caixa de entrada.");
  } catch (e: any) {
    setErro("Erro ao reenviar e-mail. Tente novamente.");
  } finally {
    setLoading(false);
  }
}

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.body}>
          <div style={styles.badge}>EMAIL DE VERIFICAÇÃO ENVIADO</div>

          <h1 style={styles.title}>Confirme seu e-mail para ativar sua conta.</h1>

          <p style={styles.text}>
            Enviamos um link de verificação para o seu e-mail. Abra sua caixa de
            entrada, localize a mensagem do <strong>Quadra Play</strong> e clique no
            link para confirmar sua conta.
          </p>

          <div style={styles.successBox}>
            Sua conta foi criada com sucesso. O próximo passo agora é verificar seu
            e-mail antes de seguir no app.
          </div>

          <div style={styles.infoBox}>
            Dicas rápidas:
            <br />
            • confira também a pasta de spam ou promoções
            <br />
            • depois de verificar, volte ao app e faça login normalmente
            <br />
            • se o link expirar, depois nós adicionamos o botão de reenviar
          </div>

          {msg && (
  <div style={styles.successBox}>
    {msg}
  </div>
)}

{erro && (
  <div style={{
    marginTop: 16,
    border: "1px solid #fecaca",
    background: "#fef2f2",
    color: "#991b1b",
    borderRadius: 18,
    padding: 16,
    fontSize: 14,
    fontWeight: 700,
  }}>
    {erro}
  </div>
)}

<button
  type="button"
  onClick={handleReenviar}
  style={{
    ...styles.secondaryBtn,
    border: "1px solid #8ae809",
    color: "#065f46",
  }}
  disabled={loading}
>
  {loading ? "Reenviando..." : "Reenviar e-mail"}
</button>

          <div style={styles.actions}>
            <button
              type="button"
              onClick={() => nav("/login")}
              style={styles.primaryBtn}
            >
              Ir para login
            </button>

            <button
              type="button"
              onClick={() => nav("/cadastro")}
              style={styles.secondaryBtn}
            >
              Voltar para cadastro
            </button>
          </div>

          <p style={styles.footer}>
            Já verificou seu e-mail? Então entre normalmente em{" "}
            <Link to="/login" style={styles.strongLink}>
              Login
            </Link>.
          </p>
        </div>
      </div>
    </div>
  );
}