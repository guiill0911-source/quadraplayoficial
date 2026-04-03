import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "../services/firebase";
import { TERMOS_VERSAO_ATUAL } from "../config/termos";
import Header from "../components/Header";

const styles = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(circle at top left, rgba(34,197,94,0.12), transparent 28%), radial-gradient(circle at top right, rgba(59,130,246,0.12), transparent 24%), linear-gradient(180deg, #f8fafc 0%, #eef6ff 100%)",
    paddingBottom: 40,
  } as const,

  container: {
    width: "100%",
    maxWidth: 980,
    margin: "0 auto",
    padding: "24px 16px 40px",
  } as const,

  hero: {
    position: "relative" as const,
    overflow: "hidden",
    borderRadius: 28,
    padding: "32px 24px",
    background: "linear-gradient(135deg, #0f172a 0%, #1d4ed8 52%, #22c55e 100%)",
    color: "#fff",
    boxShadow: "0 24px 80px rgba(15, 23, 42, 0.22)",
  },

  heroGlow1: {
    position: "absolute" as const,
    top: -60,
    right: -40,
    width: 180,
    height: 180,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.10)",
    filter: "blur(8px)",
  },

  heroGlow2: {
    position: "absolute" as const,
    bottom: -70,
    left: -30,
    width: 200,
    height: 200,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.08)",
    filter: "blur(10px)",
  },

  heroContent: {
    position: "relative" as const,
    zIndex: 1,
  },

  heroPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 14px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.14)",
    border: "1px solid rgba(255,255,255,0.18)",
    fontSize: 13,
    fontWeight: 800,
    letterSpacing: 0.3,
    marginBottom: 16,
  } as const,

  heroTitle: {
    margin: 0,
    fontSize: "clamp(28px, 4vw, 42px)",
    lineHeight: 1.08,
    fontWeight: 900,
    letterSpacing: -0.5,
    maxWidth: 760,
  } as const,

  heroText: {
    marginTop: 14,
    maxWidth: 760,
    fontSize: 16,
    lineHeight: 1.65,
    color: "rgba(255,255,255,0.92)",
  } as const,

  infoRow: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 12,
    marginTop: 18,
  },

  infoChip: {
    display: "inline-flex",
    alignItems: "center",
    padding: "10px 14px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.12)",
    border: "1px solid rgba(255,255,255,0.18)",
    fontSize: 13,
    fontWeight: 700,
    color: "#fff",
  } as const,

  contentGrid: {
    display: "grid",
    gridTemplateColumns: "1.15fr 0.85fr",
    gap: 18,
    marginTop: 20,
  } as const,

  card: {
    background: "#fff",
    borderRadius: 24,
    padding: 24,
    boxShadow: "0 18px 50px rgba(15, 23, 42, 0.08)",
    border: "1px solid rgba(226, 232, 240, 0.95)",
  } as const,

  sectionTitle: {
    margin: 0,
    fontSize: 22,
    color: "#0f172a",
    fontWeight: 900,
    letterSpacing: -0.3,
  } as const,

  paragraph: {
    margin: "10px 0 0",
    color: "#475569",
    fontSize: 15,
    lineHeight: 1.75,
  } as const,

  linksWrap: {
    display: "grid",
    gap: 12,
    marginTop: 20,
  } as const,

  linkCard: {
    display: "block",
    textDecoration: "none",
    borderRadius: 18,
    border: "1px solid #dbeafe",
    background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
    padding: 16,
    transition: "all 0.2s ease",
  } as const,

  linkTitle: {
    margin: 0,
    fontSize: 15,
    fontWeight: 900,
    color: "#0f172a",
  } as const,

  linkText: {
    margin: "6px 0 0",
    fontSize: 14,
    lineHeight: 1.6,
    color: "#64748b",
  } as const,

  checkboxBox: {
    marginTop: 22,
    padding: 18,
    borderRadius: 18,
    border: "1px solid #cbd5e1",
    background: "#f8fafc",
  } as const,

  checkboxLabel: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    cursor: "pointer",
  } as const,

  checkbox: {
    marginTop: 2,
    width: 18,
    height: 18,
    cursor: "pointer",
  } as const,

  checkboxText: {
    color: "#0f172a",
    fontSize: 15,
    lineHeight: 1.65,
    fontWeight: 700,
  } as const,

  checkboxMuted: {
    display: "block",
    marginTop: 4,
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.55,
    fontWeight: 500,
  } as const,

  actions: {
    marginTop: 22,
    display: "flex",
    gap: 12,
    flexWrap: "wrap" as const,
  } as const,

  primaryBtn: {
    flex: 1,
    minWidth: 220,
    padding: "14px 18px",
    borderRadius: 16,
    border: "none",
    background: "linear-gradient(135deg, #2563eb 0%, #16a34a 100%)",
    color: "#fff",
    fontWeight: 900,
    fontSize: 15,
    cursor: "pointer",
    boxShadow: "0 12px 30px rgba(37, 99, 235, 0.22)",
  } as const,

  primaryBtnDisabled: {
    flex: 1,
    minWidth: 220,
    padding: "14px 18px",
    borderRadius: 16,
    border: "none",
    background: "#cbd5e1",
    color: "#475569",
    fontWeight: 900,
    fontSize: 15,
    cursor: "not-allowed",
  } as const,

  secondaryBtn: {
    padding: "14px 18px",
    borderRadius: 16,
    border: "1px solid #cbd5e1",
    background: "#fff",
    color: "#0f172a",
    fontWeight: 800,
    fontSize: 15,
    cursor: "pointer",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  } as const,

  sideBox: {
    borderRadius: 22,
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    padding: 20,
    boxShadow: "0 14px 34px rgba(15, 23, 42, 0.05)",
  } as const,

  sideTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 900,
    color: "#0f172a",
  } as const,

  sideText: {
    margin: "8px 0 0",
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.65,
  } as const,

  infoList: {
    display: "grid",
    gap: 12,
    marginTop: 16,
  } as const,

  infoItem: {
    borderRadius: 16,
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    padding: 14,
  } as const,

  infoItemLabel: {
    margin: 0,
    fontSize: 12,
    fontWeight: 800,
    color: "#64748b",
    textTransform: "uppercase" as const,
    letterSpacing: 0.35,
  } as const,

  infoItemValue: {
    margin: "6px 0 0",
    fontSize: 14,
    fontWeight: 800,
    color: "#0f172a",
    lineHeight: 1.55,
  } as const,

  noteBox: {
    marginTop: 16,
    padding: 16,
    borderRadius: 18,
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    color: "#1e3a8a",
    fontSize: 14,
    lineHeight: 1.65,
    fontWeight: 600,
  } as const,

  footerText: {
    marginTop: 14,
    opacity: 0.75,
    fontSize: 12,
    color: "#64748b",
    fontWeight: 700,
  } as const,
};

export default function AceiteTermos() {
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useMemo(() => getAuth(), []);

  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);

  const from = (location.state as any)?.from || "/";

  async function aceitar() {
    const user = auth.currentUser;
    if (!user) return;

    setSaving(true);
    try {
      const ref = doc(db, "users", user.uid);
      await setDoc(
        ref,
        {
          termosAceitosEm: serverTimestamp(),
          versaoTermosAceitos: TERMOS_VERSAO_ATUAL,
        },
        { merge: true }
      );

      navigate(from, { replace: true });
    } finally {
      setSaving(false);
    }
  }

  const botaoStyle = !checked || saving ? styles.primaryBtnDisabled : styles.primaryBtn;

  return (
    <>
      <Header />

      <div style={styles.page}>
        <div style={styles.container}>
          <section style={styles.hero}>
            <div style={styles.heroGlow1} />
            <div style={styles.heroGlow2} />

            <div style={styles.heroContent}>
              <div style={styles.heroPill}>📘 Atualização de termos</div>

              <h1 style={styles.heroTitle}>Atualizamos nossos termos e políticas</h1>

              <p style={styles.heroText}>
                Para continuar usando o Quadra Play, precisamos confirmar que você
                leu e aceitou a versão atual dos Termos de Uso e da Política de
                Cancelamento e Reembolso.
              </p>

              <div style={styles.infoRow}>
                <div style={styles.infoChip}>Versão atual: {TERMOS_VERSAO_ATUAL}</div>
                <div style={styles.infoChip}>Leitura rápida</div>
                <div style={styles.infoChip}>Aceite necessário</div>
              </div>
            </div>
          </section>

          <div style={styles.contentGrid}>
            <section style={styles.card}>
              <h2 style={styles.sectionTitle}>Confirmação de aceite</h2>
              <p style={styles.paragraph}>
                Revise os documentos abaixo e confirme o aceite para seguir usando
                o aplicativo com segurança e transparência.
              </p>

              <div style={styles.linksWrap}>
                <Link to="/termos?from=aceite-termos" style={styles.linkCard}>
                  <p style={styles.linkTitle}>Ler Termos de Uso</p>
                  <p style={styles.linkText}>
                    Entenda as regras gerais da plataforma, responsabilidades da
                    conta e condições básicas de uso.
                  </p>
                </Link>

                <Link
                  to="/politica-cancelamento?from=aceite-termos"
                  style={styles.linkCard}
                >
                  <p style={styles.linkTitle}>Ler Política de Cancelamento</p>
                  <p style={styles.linkText}>
                    Veja como funcionam cancelamentos, reembolsos, créditos
                    internos, strikes e bloqueios.
                  </p>
                </Link>
              </div>

              <div style={styles.checkboxBox}>
                <label style={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => setChecked(e.target.checked)}
                    style={styles.checkbox}
                  />

                  <span style={styles.checkboxText}>
                    Li e aceito os Termos de Uso e a Política de Cancelamento e
                    Reembolso.
                    <span style={styles.checkboxMuted}>
                      Ao continuar, seu aceite será registrado na sua conta com a
                      versão atual dos documentos.
                    </span>
                  </span>
                </label>
              </div>

              <div style={styles.actions}>
                <button
                  onClick={aceitar}
                  disabled={!checked || saving}
                  style={botaoStyle}
                >
                  {saving ? "Salvando aceite..." : "Aceitar e continuar"}
                </button>

                <Link to="/termos?from=aceite-termos" style={styles.secondaryBtn}>
                  Revisar documentos
                </Link>
              </div>

              <div style={styles.footerText}>
                Versão registrada no aceite: {TERMOS_VERSAO_ATUAL}
              </div>
            </section>

            <aside style={{ display: "grid", gap: 18 }}>
              <div style={styles.sideBox}>
                <h3 style={styles.sideTitle}>Por que isso é importante?</h3>
                <p style={styles.sideText}>
                  Essas regras ajudam a manter a plataforma mais clara, confiável
                  e equilibrada para atletas e donos de quadra.
                </p>

                <div style={styles.infoList}>
                  <div style={styles.infoItem}>
                    <p style={styles.infoItemLabel}>Transparência</p>
                    <p style={styles.infoItemValue}>
                      Você entende melhor como funcionam reservas, cancelamentos e
                      responsabilidades dentro do app.
                    </p>
                  </div>

                  <div style={styles.infoItem}>
                    <p style={styles.infoItemLabel}>Proteção</p>
                    <p style={styles.infoItemValue}>
                      As políticas ajudam a reduzir conflitos, no-show e situações
                      injustas entre as partes.
                    </p>
                  </div>

                  <div style={styles.infoItem}>
                    <p style={styles.infoItemLabel}>Continuidade</p>
                    <p style={styles.infoItemValue}>
                      O aceite é necessário para manter sua conta alinhada com a
                      versão mais atual das regras da plataforma.
                    </p>
                  </div>
                </div>
              </div>

              <div style={styles.sideBox}>
                <h3 style={styles.sideTitle}>Resumo do registro</h3>

                <div style={styles.infoList}>
                  <div style={styles.infoItem}>
                    <p style={styles.infoItemLabel}>Documento</p>
                    <p style={styles.infoItemValue}>Termos + Política</p>
                  </div>

                  <div style={styles.infoItem}>
                    <p style={styles.infoItemLabel}>Versão</p>
                    <p style={styles.infoItemValue}>{TERMOS_VERSAO_ATUAL}</p>
                  </div>

                  <div style={styles.infoItem}>
                    <p style={styles.infoItemLabel}>Status atual</p>
                    <p style={styles.infoItemValue}>
                      {checked ? "Pronto para confirmar aceite" : "Aguardando confirmação"}
                    </p>
                  </div>
                </div>

                <div style={styles.noteBox}>
                  Depois de aceitar, você será redirecionado para continuar o fluxo
                  normal do app.
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </>
  );
}