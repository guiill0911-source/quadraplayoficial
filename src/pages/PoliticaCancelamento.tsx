import Header from "../components/Header";
import { useNavigate, useSearchParams } from "react-router-dom";

const styles = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(circle at top left, rgba(37,99,235,0.10), transparent 28%), radial-gradient(circle at top right, rgba(15,23,42,0.14), transparent 24%), linear-gradient(180deg, #f8fafc 0%, #eef4ff 100%)",
  } as const,

  container: {
    maxWidth: 1080,
    margin: "0 auto",
    padding: "24px 16px 92px",
  } as const,

  hero: {
    position: "relative" as const,
    overflow: "hidden",
    borderRadius: 28,
    padding: "32px 24px",
    background: "linear-gradient(135deg, #0f172a 0%, #172554 58%, #1d4ed8 100%)",
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
    background: "rgba(96,165,250,0.10)",
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
    fontSize: 34,
    lineHeight: 1.1,
    fontWeight: 900,
  } as const,

  heroText: {
    marginTop: 14,
    maxWidth: 800,
    fontSize: 16,
    lineHeight: 1.7,
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

  contentWrap: {
    marginTop: 24,
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
    gap: 18,
  } as const,

  card: {
    background: "#fff",
    borderRadius: 24,
    padding: 24,
    boxShadow: "0 18px 50px rgba(15, 23, 42, 0.08)",
    border: "1px solid rgba(226, 232, 240, 0.95)",
  } as const,

  sectionBox: {
    background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
    border: "1px solid #e2e8f0",
    borderRadius: 20,
    padding: 20,
    marginTop: 16,
  } as const,

  sectionTitle: {
    margin: "0 0 10px",
    fontSize: 22,
    color: "#0f172a",
    fontWeight: 900,
  } as const,

  sectionSubtitle: {
    margin: "0 0 10px",
    fontSize: 18,
    color: "#0f172a",
    fontWeight: 800,
  } as const,

  paragraph: {
    margin: 0,
    color: "#334155",
    fontSize: 15,
    lineHeight: 1.8,
  } as const,

  list: {
    margin: "10px 0 0 0",
    paddingLeft: 20,
    color: "#334155",
    fontSize: 15,
    lineHeight: 1.8,
  } as const,

  alertBox: {
    marginTop: 18,
    padding: 18,
    borderRadius: 18,
    background: "linear-gradient(180deg, #fff7ed 0%, #fffbeb 100%)",
    border: "1px solid #fdba74",
    color: "#9a3412",
    fontSize: 14,
    lineHeight: 1.65,
    fontWeight: 700,
  } as const,

  note: {
    marginTop: 18,
    padding: 16,
    borderRadius: 18,
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    color: "#1e3a8a",
    fontSize: 14,
    lineHeight: 1.65,
    fontWeight: 600,
  } as const,

  footerBox: {
    marginTop: 12,
    padding: 16,
    borderRadius: 18,
    background: "#f8fafc",
    border: "1px dashed #cbd5e1",
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.6,
    fontWeight: 700,
  } as const,

  actions: {
    marginTop: 28,
    display: "flex",
    gap: 12,
    flexWrap: "wrap" as const,
  } as const,

  buttonPrimary: {
    padding: "12px 18px",
    borderRadius: 14,
    border: "none",
    background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
    color: "#fff",
    fontWeight: 800,
    fontSize: 15,
    cursor: "pointer",
    boxShadow: "0 12px 30px rgba(37, 99, 235, 0.22)",
  } as const,

  buttonSecondary: {
    padding: "12px 18px",
    borderRadius: 14,
    border: "1px solid #cbd5e1",
    background: "#fff",
    color: "#0f172a",
    fontWeight: 800,
    fontSize: 15,
    cursor: "pointer",
  } as const,
};

export default function PoliticaCancelamento() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const from = params.get("from");

  function voltar() {
    if (from === "aceite-termos") {
      navigate("/aceite-termos");
      return;
    }
    navigate(-1);
  }

  return (
    <>
      <Header />
      <div style={styles.page}>
        <div style={styles.container}>
          <section style={styles.hero}>
            <div style={styles.heroGlow1} />
            <div style={styles.heroGlow2} />

            <div style={styles.heroContent}>
              <div style={styles.heroPill}>🛡️ Política de Cancelamento</div>

              <h1 style={styles.heroTitle}>
                Política de Cancelamento, No-show e Reembolso — Quadra Play
              </h1>

              <p style={styles.heroText}>
                Esta política define como o Quadra Play trata cancelamentos,
                reembolsos, créditos internos, ausência no horário reservado e
                consequências aplicáveis ao usuário que descumprir as regras
                operacionais da plataforma.
              </p>

              <div style={styles.infoRow}>
                <div style={styles.infoChip}>Versão: 2026-03-27</div>
                <div style={styles.infoChip}>Proteção do ecossistema</div>
                <div style={styles.infoChip}>Regras claras e objetivas</div>
              </div>
            </div>
          </section>

          <div style={styles.contentWrap}>
            <section style={styles.card}>
              <h2 style={styles.sectionTitle}>Resumo importante</h2>
              <p style={styles.paragraph}>
                O objetivo desta política é preservar a confiança entre atleta,
                dono da quadra e plataforma, reduzindo prejuízos operacionais,
                desperdício de horários e comportamentos abusivos.
              </p>

              <div style={styles.alertBox}>
                Cancelamentos muito próximos do horário, ausência sem aviso,
                inadimplência no pagamento presencial e uso abusivo da agenda podem
                gerar perda de reembolso, strike, bloqueio temporário e exigência
                de regularização para novas reservas.
              </div>
            </section>

            <section style={styles.card}>
              <div style={styles.sectionBox}>
                <h3 style={styles.sectionSubtitle}>1) Objetivo da política</h3>
                <p style={styles.paragraph}>
                  Esta política existe para estabelecer previsibilidade, reduzir
                  conflitos e proteger a operação das quadras parceiras e a
                  experiência dos atletas que utilizam a plataforma.
                </p>
              </div>

              <div style={styles.sectionBox}>
                <h3 style={styles.sectionSubtitle}>2) Cancelamento pelo atleta</h3>
                <div style={{ marginTop: 14 }}>
                  <h4
                    style={{
                      margin: "0 0 8px",
                      fontSize: 16,
                      fontWeight: 800,
                      color: "#0f172a",
                    }}
                  >
                    2.1) Cancelamento com antecedência superior a 1 hora
                  </h4>
                  <ul style={styles.list}>
                    <li>Se ainda não houve repasse ao dono, poderá haver reembolso conforme o meio de pagamento e fluxo vigente.</li>
                    <li>Se já houve repasse, o valor poderá ser convertido em crédito interno no app, conforme política operacional.</li>
                  </ul>
                </div>

                <div style={{ marginTop: 18 }}>
                  <h4
                    style={{
                      margin: "0 0 8px",
                      fontSize: 16,
                      fontWeight: 800,
                      color: "#0f172a",
                    }}
                  >
                    2.2) Cancelamento com 1 hora ou menos de antecedência
                  </h4>
                  <ul style={styles.list}>
                    <li>Poderá não haver reembolso em dinheiro, em razão da proximidade do horário e do impacto operacional ao estabelecimento.</li>
                    <li>Casos excepcionais poderão ser analisados pela plataforma, sem garantia de deferimento automático.</li>
                  </ul>
                </div>
              </div>

              <div style={styles.sectionBox}>
                <h3 style={styles.sectionSubtitle}>3) Cancelamento pelo dono da quadra</h3>
                <ul style={styles.list}>
                  <li>Quando o cancelamento partir do estabelecimento, o usuário poderá receber reembolso ou crédito interno, conforme o estágio financeiro da operação.</li>
                  <li>A plataforma poderá adotar fluxos específicos para proteger o usuário em cancelamentos imputáveis ao parceiro.</li>
                </ul>
              </div>

              <div style={styles.sectionBox}>
                <h3 style={styles.sectionSubtitle}>4) No-show do atleta</h3>
                <p style={styles.paragraph}>
                  Considera-se no-show a ausência do atleta no horário reservado,
                  sem cancelamento válido dentro do prazo aplicável.
                </p>

                <ul style={styles.list}>
                  <li>Cada no-show poderá gerar 1 strike.</li>
                  <li>Os strikes possuem validade operacional conforme a política vigente da plataforma.</li>
                  <li>O acúmulo de strikes poderá resultar em bloqueio temporário da conta.</li>
                  <li>O desbloqueio poderá depender de regularização financeira ou do cumprimento das condições indicadas no app.</li>
                </ul>
              </div>

              <div style={styles.sectionBox}>
                <h3 style={styles.sectionSubtitle}>5) Pagamento presencial não realizado</h3>
                <p style={styles.paragraph}>
                  Quando a reserva permitir pagamento presencial, o usuário assume
                  o compromisso de comparecer e honrar o pagamento no local, salvo
                  cancelamento válido dentro das regras aplicáveis.
                </p>

                <ul style={styles.list}>
                  <li>A ausência injustificada poderá ser tratada como no-show.</li>
                  <li>A inadimplência poderá gerar strike, bloqueio e restrição para novas reservas.</li>
                  <li>Em casos de reincidência, a plataforma poderá exigir regularização antes de liberar nova utilização.</li>
                </ul>
              </div>

              <div style={styles.sectionBox}>
                <h3 style={styles.sectionSubtitle}>6) Crédito interno (wallet)</h3>
                <ul style={styles.list}>
                  <li>Créditos internos poderão ser utilizados em futuras reservas, conforme disponibilidade funcional do app.</li>
                  <li>No estágio atual do MVP, créditos não representam saque automático em dinheiro, salvo hipótese específica decidida pela plataforma.</li>
                </ul>
              </div>

              <div style={styles.sectionBox}>
                <h3 style={styles.sectionSubtitle}>7) Atualizações</h3>
                <p style={styles.paragraph}>
                  Esta política pode ser atualizada para refletir melhorias no
                  produto, mudanças operacionais, evolução financeira do sistema e
                  ajustes de conformidade.
                </p>
              </div>

              <div style={styles.footerBox}>
                Esta política foi redigida para o MVP com foco em clareza
                operacional. Antes do lançamento oficial, vale consolidar percentuais,
                prazos exatos, critérios de exceção e fluxo definitivo de reembolso.
              </div>

              <div style={styles.actions}>
                <button onClick={voltar} style={styles.buttonSecondary}>
                  Voltar
                </button>

                <button
                  onClick={() => navigate("/pagamentos-e-regras")}
                  style={styles.buttonPrimary}
                >
                  Ver pagamentos e regras
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}