import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import logoQuadraPlay from "../assets/logo.png";
import {
  confirmarCodigoCelular,
  criarRecaptcha,
  enviarCodigoCelular,
  getMeuPerfil,
  loginComEmail,
  logout,
} from "../services/authService";

type ModoLogin = "email" | "celular";

const styles = {
page: {
  minHeight: "100vh",
  background:
  "linear-gradient(180deg, #03122e 0%, #053ff9 100%)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px 16px",
  boxSizing: "border-box" as const,
} as const,

  shell: {
    width: "100%",
    maxWidth: 1100,
    display: "grid",
    gridTemplateColumns: "1.05fr 0.95fr",
    gap: 24,
    alignItems: "stretch",
  } as const,

  hero: {
    position: "relative" as const,
    overflow: "hidden",
    borderRadius: 30,
    padding: "34px 30px",
    minHeight: 560,
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
    fontSize: "clamp(24px, 5vw, 30px)",
    lineHeight: 1.02,
    fontWeight: 900,
    letterSpacing: -1,
    maxWidth: 520,
  } as const,

  heroText: {
    margin: "14px 0 0",
    maxWidth: 520,
    fontSize: 14,
lineHeight: 1.5,
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
    fontSize: 16,
    fontWeight: 900,
    color: "#fff",
  } as const,

  heroFooter: {
    position: "relative" as const,
    zIndex: 1,
    marginTop: 12,
    borderTop: "1px solid rgba(255,255,255,0.15)",
    paddingTop: 10,
    color: "rgba(255,255,255,0.88)",
    lineHeight: 1.6,
    fontSize: 12,
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

  modeWrap: {
  marginTop: 10,
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 8,
  padding: 4,
  borderRadius: 16,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
} as const,

modeBtn: {
  border: "none",
  borderRadius: 12,
  padding: "10px 12px",
  background: "transparent",
  color: "#334155",
  fontWeight: 900,
  fontSize: 14,
  cursor: "pointer",
} as const,

  modeBtnActive: {
  border: "1px solid #dbeafe",
  borderRadius: 12,
  padding: "10px 12px",
  background: "#eff6ff",
  color: "#1d4ed8",
  fontWeight: 900,
  fontSize: 14,
  cursor: "pointer",
  boxShadow: "0 8px 18px rgba(37, 99, 235, 0.08)",
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
    boxSizing: "border-box" as const,
    borderRadius: 16,
    border: "1px solid #cbd5e1",
    background: "#fff",
    padding: "14px 16px",
    fontSize: 15,
    outline: "none",
    color: "#0f172a",
  } as const,

  helper: {
    marginTop: 14,
    border: "1px solid #dbeafe",
    background: "#eff6ff",
    color: "#1e3a8a",
    borderRadius: 16,
    padding: 12,
    fontSize: 14,
    fontWeight: 700,
    lineHeight: 1.55,
  } as const,

  success: {
    marginTop: 14,
    border: "1px solid #d1fae5",
    background: "#ecfdf5",
    color: "#065f46",
    borderRadius: 16,
    padding: 12,
    fontSize: 14,
    fontWeight: 700,
    lineHeight: 1.55,
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

  recaptchaWrap: {
    marginTop: 14,
    border: "1px dashed #cbd5e1",
    background: "#f8fafc",
    borderRadius: 16,
    padding: 12,
  } as const,

  codeRow: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 12,
    marginTop: 12,
  } as const,

  secondaryBtn: {
    marginTop: 12,
    width: "100%",
    padding: "13px 16px",
    borderRadius: 16,
    border: "1px solid #cbd5e1",
    background: "#fff",
    color: "#0f172a",
    fontWeight: 900,
    fontSize: 15,
    cursor: "pointer",
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
  marginTop: 16,
  display: "grid",
  gap: 8,
} as const,

  linkRow: {
  margin: 0,
  color: "#475569",
  fontSize: 13,
  lineHeight: 1.45,
} as const,

  strongLink: {
    color: "#1d4ed8",
    fontWeight: 800,
    textDecoration: "none",
  } as const,

  splashOverlay: {
  position: "fixed" as const,
  inset: 0,
  zIndex: 9999,
  background: "#e5e7eb",
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "center",
  padding: "16px 12px",
  overflowY: "auto" as const,
  transition: "opacity 0.55s ease, visibility 0.55s ease",
} as const,

  splashCard: {
    width: "100%",
    maxWidth: 620,
    borderRadius: 30,
    overflow: "hidden",
    background: "linear-gradient(135deg, #1e3a8a 0%, #2563eb 58%, #38bdf8 100%)",
    color: "#fff",
    boxShadow: "0 22px 60px rgba(15, 23, 42, 0.18)",
    position: "relative" as const,
    padding: "34px 30px",
    minHeight: 560,
    display: "flex",
    flexDirection: "column" as const,
    justifyContent: "space-between",
  } as const,

  splashCardGlow: {
    position: "absolute" as const,
    right: -60,
    top: -50,
    width: 230,
    height: 230,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.12)",
    filter: "blur(10px)",
  } as const,

  splashCardGlow2: {
    position: "absolute" as const,
    left: -50,
    bottom: -80,
    width: 250,
    height: 250,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.10)",
    filter: "blur(12px)",
  } as const,
};

function formatarTelefoneBR(valor: string) {
  const numeros = valor.replace(/\D/g, "").slice(0, 11);

  if (numeros.length <= 2) return numeros;
  if (numeros.length <= 7) return `(${numeros.slice(0, 2)}) ${numeros.slice(2)}`;
  return `(${numeros.slice(0, 2)}) ${numeros.slice(2, 7)}-${numeros.slice(7)}`;
}

function telefoneSomenteNumeros(valor: string) {
  return valor.replace(/\D/g, "");
}

export default function Login() {
  const [mostrarSplash, setMostrarSplash] = useState(false);
  const [sumindoSplash, setSumindoSplash] = useState(false);
  const nav = useNavigate();

  const [modo, setModo] = useState<ModoLogin>("email");

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");

  const [telefone, setTelefone] = useState("");
  const [codigo, setCodigo] = useState("");
  const [codigoEnviado, setCodigoEnviado] = useState(false);

  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [msg, setMsg] = useState("");

useEffect(() => {
  const isMobile = window.innerWidth <= 768;
  const jaViu = sessionStorage.getItem("qp_login_splash_visto");

  if (!isMobile || jaViu) return;

  setMostrarSplash(true);
  setSumindoSplash(false);
  sessionStorage.setItem("qp_login_splash_visto", "true");

  const timeoutFade = window.setTimeout(() => {
    setSumindoSplash(true);
  }, 2000);

  const timeoutHide = window.setTimeout(() => {
    setMostrarSplash(false);
    setSumindoSplash(false);
  }, 2600);

  return () => {
    window.clearTimeout(timeoutFade);
    window.clearTimeout(timeoutHide);
  };
}, []);

useEffect(() => {
  const onResize = () => {
    if (window.innerWidth > 768) {
      setMostrarSplash(false);
      setSumindoSplash(false);
    }
  };

  window.addEventListener("resize", onResize);
  return () => window.removeEventListener("resize", onResize);
}, []);

  async function entrarComEmail() {
    setErro("");
    setMsg("");

    if (!email.trim() || !senha) {
      setErro("Preencha email e senha.");
      return;
    }

    setLoading(true);
    try {
      await loginComEmail(email.trim(), senha);
      nav("/home");
    } catch (e: any) {
      setErro(e?.message ?? "Erro ao entrar.");
    } finally {
      setLoading(false);
    }
  }

  async function enviarCodigo() {
    setErro("");
    setMsg("");

    const tel = telefoneSomenteNumeros(telefone);

    if (!tel) {
      setErro("Informe seu celular com DDD.");
      return;
    }

    if (tel.length < 10 || tel.length > 11) {
      setErro("Informe um celular válido com DDD.");
      return;
    }

    setLoading(true);

    try {
      const verifier = criarRecaptcha("recaptcha-container");
      const resultado = await enviarCodigoCelular(telefone, verifier);
      console.log("SMS ENVIADO", resultado);

      setCodigoEnviado(true);
      setMsg("Código enviado por SMS. Digite abaixo para entrar.");
    } catch (e: any) {
      console.error("ERRO SMS:", e);
      setErro(e?.message ?? "Não foi possível enviar o código por SMS.");
    } finally {
      setLoading(false);
    }
  }

  async function confirmarCodigo() {
    setErro("");
    setMsg("");

    if (!codigo.trim()) {
      setErro("Digite o código recebido por SMS.");
      return;
    }

    setLoading(true);
    try {
      const user = await confirmarCodigoCelular(codigo.trim());

      const perfil = await getMeuPerfil(user.uid);

      if (!perfil) {
        await logout();
        setErro("Esse celular ainda não está vinculado a uma conta. Cadastre-se primeiro.");
        return;
      }

      nav("/home");
    } catch (e: any) {
      setErro(e?.message ?? "Código inválido ou expirado.");
    } finally {
      setLoading(false);
    }
  }

  function trocarModo(novoModo: "email" | "celular") {
    setModo(novoModo);
    setErro("");
    setMsg("");
    setLoading(false);

    if (novoModo === "email") {
      setCodigo("");
      setCodigoEnviado(false);
    }
  }

  return (
    <>



      <div
  style={{
    ...styles.page,
    alignItems: "center",
    padding:
      typeof window !== "undefined" && window.innerWidth <= 768
        ? "10px 12px 20px"
        : styles.page.padding,
  }}
>

  <div
  style={{
    textAlign: "center",
    marginBottom: 20,
  }}
>
  <img
    src={logoQuadraPlay}
    alt="Quadra Play"
    style={{
      width: 110,
      marginBottom: 6,
    }}
  />
  <div
    style={{
      color: "#fff",
      fontWeight: 900,
      letterSpacing: 1,
    }}
  >
    QUADRA PLAY
  </div>
</div>

<div
  style={{
    ...styles.card,
    borderRadius:
      typeof window !== "undefined" && window.innerWidth <= 768 ? 24 : styles.card.borderRadius,
    maxWidth:
  typeof window !== "undefined" && window.innerWidth <= 768 ? 360 : "100%",
    margin:
      typeof window !== "undefined" && window.innerWidth <= 768 ? "0 auto" : 0,
  }}
>

          <section
  style={{
    ...styles.cardWrap,
    justifyContent:
      typeof window !== "undefined" && window.innerWidth <= 768
        ? "center"
        : undefined,
    alignItems:
      typeof window !== "undefined" && window.innerWidth <= 768
        ? "flex-start"
        : styles.cardWrap.alignItems,
  }}
>
            <div
              style={{
                ...styles.card,
                borderRadius:
                  typeof window !== "undefined" && window.innerWidth <= 768 ? 24 : styles.card.borderRadius,
              }}
            >
              <div
                style={{
                  ...styles.cardBody,
                  padding:
                    typeof window !== "undefined" && window.innerWidth <= 768
                      ? "20px 16px 18px"
                      : styles.cardBody.padding,
                }}
              >
                <div style={styles.cardTop}>

                  <h2
                    style={{
                      ...styles.cardTitle,
                      fontSize:
                        typeof window !== "undefined" && window.innerWidth <= 768 ? 26 : styles.cardTitle.fontSize,
                    }}
                  >
                    Entrar
                  </h2>
                
                </div>

                <div style={styles.modeWrap}>
                  <button
                    type="button"
                    onClick={() => trocarModo("email")}
                    style={modo === "email" ? styles.modeBtnActive : styles.modeBtn}
                  >
                    Entrar com e-mail
                  </button>

                  <button
                    type="button"
                    onClick={() => trocarModo("celular")}
                    style={modo === "celular" ? styles.modeBtnActive : styles.modeBtn}
                  >
                    Entrar com celular
                  </button>
                </div>

                {modo === "email" ? (
                  <>
                    <div style={styles.field}>
                      <label style={styles.label}>Email</label>
                      <input
                        placeholder="seuemail@exemplo.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        style={styles.input}
                        inputMode="email"
                      />
                    </div>

                    <div style={styles.field}>
                      <label style={styles.label}>Senha</label>
                      <input
                        placeholder="Digite sua senha"
                        type="password"
                        value={senha}
                        onChange={(e) => setSenha(e.target.value)}
                        style={styles.input}
                      />
                    </div>

                    {erro ? <div style={styles.error}>{erro}</div> : null}
                    {msg ? <div style={styles.success}>{msg}</div> : null}

                    <button
                      onClick={entrarComEmail}
                      disabled={loading}
                      style={loading ? styles.submitBtnDisabled : styles.submitBtn}
                    >
                      {loading ? "Entrando..." : "Entrar com e-mail"}
                    </button>
                  </>
                ) : (
                  <>
                    <div style={styles.field}>
                      <label style={styles.label}>Celular</label>
                      <input
                        placeholder="(51) 99999-9999"
                        value={telefone}
                        onChange={(e) => setTelefone(formatarTelefoneBR(e.target.value))}
                        style={styles.input}
                        inputMode="tel"
                      />
                    </div>

                    <div style={styles.helper}>
                      Digite seu celular com DDD. Vamos enviar um código por SMS para você entrar sem depender do e-mail.
                    </div>

                    <div style={styles.recaptchaWrap}>
                      <div id="recaptcha-container" />
                    </div>

                    {!codigoEnviado ? (
                      <button
                        onClick={enviarCodigo}
                        disabled={loading}
                        style={loading ? styles.submitBtnDisabled : styles.submitBtn}
                      >
                        {loading ? "Enviando código..." : "Enviar código por SMS"}
                      </button>
                    ) : (
                      <>
                        <div style={styles.codeRow}>
                          <div style={styles.field}>
                            <label style={styles.label}>Código SMS</label>
                            <input
                              placeholder="Digite o código recebido"
                              value={codigo}
                              onChange={(e) => setCodigo(e.target.value)}
                              style={styles.input}
                              inputMode="numeric"
                            />
                          </div>
                        </div>

                        <button
                          onClick={confirmarCodigo}
                          disabled={loading}
                          style={loading ? styles.submitBtnDisabled : styles.submitBtn}
                        >
                          {loading ? "Confirmando..." : "Confirmar código e entrar"}
                        </button>

                        <button
                          type="button"
                          onClick={enviarCodigo}
                          disabled={loading}
                          style={styles.secondaryBtn}
                        >
                          Reenviar código
                        </button>
                      </>
                    )}

                    {erro ? <div style={styles.error}>{erro}</div> : null}
                    {msg ? <div style={styles.success}>{msg}</div> : null}
                  </>
                )}

                <div style={styles.linksBox}>
                  <p style={styles.linkRow}>
                    Não tem conta?{" "}
                    <Link to="/cadastro" style={styles.strongLink}>
                      Criar agora
                    </Link>
                  </p>

                  <p style={styles.linkRow}>
                    Esqueceu a senha?{" "}
                    <Link to="/recuperar-senha" style={styles.strongLink}>
                      Recuperar
                    </Link>
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}