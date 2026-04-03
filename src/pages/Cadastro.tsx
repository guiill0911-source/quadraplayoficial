import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { cadastrarComEmail, type UserRole } from "../services/authService";

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
    maxWidth: 1160,
    display: "grid",
    gridTemplateColumns: "1.02fr 0.98fr",
    gap: 24,
    alignItems: "stretch",
  } as const,

  hero: {
    position: "relative" as const,
    overflow: "hidden",
    borderRadius: 30,
    padding: "34px 30px",
    minHeight: 640,
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
    fontSize: "clamp(34px, 4vw, 52px)",
    lineHeight: 1.04,
    fontWeight: 900,
    letterSpacing: -1,
    maxWidth: 530,
  } as const,

  heroText: {
    margin: "14px 0 0",
    maxWidth: 530,
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

  stepPill: {
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

  grid2: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
  } as const,

  field: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
    marginTop: 14,
    minWidth: 0,
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
    minWidth: 0,
  } as const,

  select: {
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
    marginTop: 16,
    border: "1px solid #dbeafe",
    background: "#eff6ff",
    color: "#1e3a8a",
    borderRadius: 16,
    padding: 12,
    fontSize: 14,
    lineHeight: 1.55,
    fontWeight: 700,
  } as const,

  infoBox: {
    marginTop: 16,
    border: "1px solid #d1fae5",
    background: "#ecfdf5",
    color: "#065f46",
    borderRadius: 16,
    padding: 12,
    fontSize: 14,
    lineHeight: 1.55,
    fontWeight: 700,
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

  secondaryBtn: {
    marginTop: 10,
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

  passwordRulesBox: {
    marginTop: 10,
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    borderRadius: 16,
    padding: 12,
  } as const,

  passwordRulesTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 13,
    fontWeight: 800,
  } as const,

  passwordRuleList: {
    listStyle: "none",
    padding: 0,
    margin: "10px 0 0",
    display: "grid",
    gap: 6,
  } as const,

  passwordRuleItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 13,
    fontWeight: 700,
  } as const,

  passwordStrengthWrap: {
    marginTop: 12,
  } as const,

  passwordStrengthBarBg: {
    width: "100%",
    height: 8,
    borderRadius: 999,
    background: "#e2e8f0",
    overflow: "hidden",
  } as const,

  passwordStrengthLabel: {
    margin: "8px 0 0",
    fontSize: 12,
    fontWeight: 800,
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

export default function Cadastro() {
  const nav = useNavigate();

  const [etapa, setEtapa] = useState<1 | 2>(1);

  const [nome, setNome] = useState("");
  const [sobrenome, setSobrenome] = useState("");
  const [cpf, setCpf] = useState("");
  const [telefone, setTelefone] = useState("");
  const [role, setRole] = useState<UserRole>("atleta");

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);

  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  const temMinimo8 = senha.length >= 8;
  const temMaiuscula = /[A-Z]/.test(senha);
  const temMinuscula = /[a-z]/.test(senha);
  const temNumero = /\d/.test(senha);

  const pontosSenha = [temMinimo8, temMaiuscula, temMinuscula, temNumero].filter(Boolean).length;

  let nivelSenha = "Fraca";
  let corSenha = "#ef4444";
  let larguraBarra = "25%";

  if (pontosSenha === 0) {
    nivelSenha = "Fraca";
    corSenha = "#94a3b8";
    larguraBarra = "0%";
  } else if (pontosSenha <= 2) {
    nivelSenha = "Fraca";
    corSenha = "#ef4444";
    larguraBarra = "35%";
  } else if (pontosSenha === 3) {
    nivelSenha = "Média";
    corSenha = "#f59e0b";
    larguraBarra = "70%";
  } else if (pontosSenha === 4) {
    nivelSenha = "Forte";
    corSenha = "#22c55e";
    larguraBarra = "100%";
  }

  const senhaValida = temMinimo8 && temMaiuscula && temMinuscula && temNumero;

  function avancarEtapa() {
    setErro("");

    const nomeLimpo = nome.trim();
    const sobrenomeLimpo = sobrenome.trim();

    if (!nomeLimpo || !sobrenomeLimpo) {
      setErro("Preencha nome e sobrenome para continuar.");
      return;
    }

    setEtapa(2);
  }

  async function criar() {
    setErro("");

    const nomeLimpo = nome.trim();
    const sobrenomeLimpo = sobrenome.trim();
    const emailLimpo = email.trim();
    const cpfLimpo = cpf.trim();
    const telefoneNumeros = telefoneSomenteNumeros(telefone);

    if (!nomeLimpo || !sobrenomeLimpo || !telefoneNumeros || !emailLimpo || !senha) {
      setErro("Preencha celular, email e senha.");
      return;
    }

    if (telefoneNumeros.length < 10 || telefoneNumeros.length > 11) {
      setErro("Informe um celular válido com DDD.");
      return;
    }

    if (!senhaValida) {
      setErro("A senha deve ter no mínimo 8 caracteres, incluindo letra maiúscula, minúscula e número.");
      return;
    }

    setLoading(true);
    try {
      await cadastrarComEmail({
        nome: nomeLimpo,
        sobrenome: sobrenomeLimpo,
        cpf: cpfLimpo ? cpfLimpo : undefined,
        telefone: telefoneNumeros,
        role,
        email: emailLimpo,
        senha,
      });

      nav("/");
    } catch (e: any) {
      setErro(e?.message ?? "Erro ao cadastrar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.shell}>
        <section style={styles.hero}>
          <div style={styles.heroGlow} />
          <div style={styles.heroGlow2} />

          <div style={styles.heroContent}>
            <div style={styles.badge}>CRIAR CONTA</div>

            <div style={styles.brand}>
              <div style={styles.brandLogo}>QP</div>
              <div>
                <p style={styles.brandName}>Quadra Play</p>
              </div>
            </div>

            <h1 style={styles.heroTitle}>
              Entre para uma experiência de quadra mais profissional.
            </h1>

            <p style={styles.heroText}>
              Crie sua conta para reservar horários, administrar quadras, acompanhar
              pagamentos e construir uma rotina mais organizada dentro do app.
            </p>

            <div style={styles.heroStats}>
              <div style={styles.heroStatCard}>
                <p style={styles.heroStatLabel}>Atleta</p>
                <p style={styles.heroStatValue}>Reserva fácil</p>
              </div>

              <div style={styles.heroStatCard}>
                <p style={styles.heroStatLabel}>Dono</p>
                <p style={styles.heroStatValue}>Gestão completa</p>
              </div>

              <div style={styles.heroStatCard}>
                <p style={styles.heroStatLabel}>Acesso</p>
                <p style={styles.heroStatValue}>Mais segurança</p>
              </div>
            </div>
          </div>

          <div style={styles.heroFooter}>
            Comece agora no Quadra Play e centralize reservas, horários e financeiro
            em uma experiência muito mais moderna.
          </div>
        </section>

        <section style={styles.cardWrap}>
          <div style={styles.card}>
            <div style={styles.cardBody}>
              <div style={styles.cardTop}>
                <div style={styles.stepPill}>ETAPA {etapa} DE 2</div>

                <h2 style={styles.cardTitle}>
                  {etapa === 1 ? "Criar conta" : "Finalizar cadastro"}
                </h2>

                <p style={styles.cardText}>
                  {etapa === 1
                    ? "Primeiro, nos conte quem você é dentro do Quadra Play."
                    : "Agora complete seus dados para concluir sua conta."}
                </p>
              </div>

              {etapa === 1 ? (
                <>
                  <div style={styles.grid2}>
                    <div style={styles.field}>
                      <label style={styles.label}>Nome</label>
                      <input
                        placeholder="Seu nome"
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                        style={styles.input}
                      />
                    </div>

                    <div style={styles.field}>
                      <label style={styles.label}>Sobrenome</label>
                      <input
                        placeholder="Seu sobrenome"
                        value={sobrenome}
                        onChange={(e) => setSobrenome(e.target.value)}
                        style={styles.input}
                      />
                    </div>
                  </div>

                  <div style={styles.field}>
                    <label style={styles.label}>Perfil</label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as UserRole)}
                      style={styles.select}
                    >
                      <option value="atleta">Atleta</option>
                      <option value="dono">Dono</option>
                    </select>
                  </div>

                  <div style={styles.helperBox}>
                    Escolha <strong>Atleta</strong> para reservar quadras ou{" "}
                    <strong>Dono</strong> para cadastrar e gerenciar sua quadra no app.
                  </div>

                  {erro ? <div style={styles.error}>{erro}</div> : null}

                  <button onClick={avancarEtapa} style={styles.submitBtn}>
                    Avançar
                  </button>
                </>
              ) : (
                <>
                  <div style={styles.field}>
                    <label style={styles.label}>CPF</label>
                    <input
                      placeholder="CPF (opcional no MVP)"
                      value={cpf}
                      onChange={(e) => setCpf(e.target.value)}
                      style={styles.input}
                    />
                  </div>

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

                  <div style={styles.infoBox}>
                    Seu celular é obrigatório e será usado para verificação, segurança e
                    acesso alternativo à sua conta.
                  </div>

                  <div style={styles.grid2}>
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
                  </div>

                  <div style={styles.grid2}>
                    <div style={styles.field}>
                      <label style={styles.label}>Senha</label>
                      <input
                        placeholder="Crie uma senha"
                        type={mostrarSenha ? "text" : "password"}
                        value={senha}
                        onChange={(e) => setSenha(e.target.value)}
                        style={styles.input}
                      />

                      <button
                        type="button"
                        onClick={() => setMostrarSenha((v) => !v)}
                        style={{
                          marginTop: 8,
                          alignSelf: "flex-start",
                          border: "none",
                          background: "transparent",
                          color: "#1d4ed8",
                          fontWeight: 800,
                          fontSize: 13,
                          cursor: "pointer",
                          padding: 0,
                        }}
                      >
                        {mostrarSenha ? "Ocultar senha" : "Ver senha"}
                      </button>

                      <div style={styles.passwordRulesBox}>
                        <p style={styles.passwordRulesTitle}>
                          A senha deve ter, pelo menos:
                        </p>

                        <ul style={styles.passwordRuleList}>
                          <li
                            style={{
                              ...styles.passwordRuleItem,
                              color: temMinimo8 ? "#16a34a" : "#64748b",
                            }}
                          >
                            <span>{temMinimo8 ? "✓" : "○"}</span>
                            <span>Mínimo de 8 caracteres</span>
                          </li>

                          <li
                            style={{
                              ...styles.passwordRuleItem,
                              color: temMaiuscula ? "#16a34a" : "#64748b",
                            }}
                          >
                            <span>{temMaiuscula ? "✓" : "○"}</span>
                            <span>Pelo menos uma letra maiúscula</span>
                          </li>

                          <li
                            style={{
                              ...styles.passwordRuleItem,
                              color: temMinuscula ? "#16a34a" : "#64748b",
                            }}
                          >
                            <span>{temMinuscula ? "✓" : "○"}</span>
                            <span>Pelo menos uma letra minúscula</span>
                          </li>

                          <li
                            style={{
                              ...styles.passwordRuleItem,
                              color: temNumero ? "#16a34a" : "#64748b",
                            }}
                          >
                            <span>{temNumero ? "✓" : "○"}</span>
                            <span>Pelo menos um número</span>
                          </li>
                        </ul>

                        <div style={styles.passwordStrengthWrap}>
                          <div style={styles.passwordStrengthBarBg}>
                            <div
                              style={{
                                width: larguraBarra,
                                height: "100%",
                                background: corSenha,
                                borderRadius: 999,
                                transition: "all 0.25s ease",
                              }}
                            />
                          </div>

                          <p
                            style={{
                              ...styles.passwordStrengthLabel,
                              color: corSenha,
                            }}
                          >
                            Força da senha: {nivelSenha}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {erro ? <div style={styles.error}>{erro}</div> : null}

                  <button
                    onClick={criar}
                    disabled={loading}
                    style={loading ? styles.submitBtnDisabled : styles.submitBtn}
                  >
                    {loading ? "Criando..." : "Criar conta"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setErro("");
                      setEtapa(1);
                    }}
                    style={styles.secondaryBtn}
                  >
                    Voltar
                  </button>
                </>
              )}

              <div style={styles.linksBox}>
                <p style={styles.linkRow}>
                  Já tem conta?{" "}
                  <Link to="/login" style={styles.strongLink}>
                    Entrar
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