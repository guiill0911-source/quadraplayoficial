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
    maxWidth: 760,
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

export default function Termos() {
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
              <div style={styles.heroPill}>📘 Termos de Uso</div>

              <h1 style={styles.heroTitle}>Termos de Uso — Quadra Play</h1>

              <p style={styles.heroText}>
                Estes Termos estabelecem as condições de acesso e uso da plataforma,
                as responsabilidades dos usuários, as regras gerais de reservas,
                pagamentos, conduta e medidas operacionais adotadas para proteger
                a integridade do ecossistema do Quadra Play.
              </p>

              <div style={styles.infoRow}>
                <div style={styles.infoChip}>Versão: 2026-03-27</div>
                <div style={styles.infoChip}>MVP jurídico-operacional</div>
                <div style={styles.infoChip}>Linguagem clara e profissional</div>
              </div>
            </div>
          </section>

          <div style={styles.contentWrap}>
            <section style={styles.card}>
              <h2 style={styles.sectionTitle}>Resumo importante</h2>
              <p style={styles.paragraph}>
                Ao utilizar o Quadra Play, o usuário declara ciência de que a
                plataforma intermedeia e organiza experiências de reserva esportiva,
                sujeitas a regras de cadastro, pagamento, cancelamento, no-show,
                reputação, créditos internos, medidas de segurança e limitações
                técnicas próprias do estágio do produto.
              </p>

              <div style={styles.note}>
                O uso do aplicativo pressupõe leitura mínima das regras essenciais
                de pagamento, cancelamento, política de privacidade e consequências
                por descumprimento das condições de uso.
              </div>
            </section>

            <section style={styles.card}>
              <div style={styles.sectionBox}>
                <h3 style={styles.sectionSubtitle}>1) O que é o Quadra Play</h3>
                <p style={styles.paragraph}>
                  O Quadra Play é uma plataforma digital voltada à busca, reserva,
                  organização e gestão de horários esportivos, aproximando atletas,
                  quadras e operadores em um ambiente de uso controlado.
                </p>
              </div>

              <div style={styles.sectionBox}>
                <h3 style={styles.sectionSubtitle}>2) Cadastro e conta de usuário</h3>
                <ul style={styles.list}>
                  <li>O usuário deve fornecer informações verdadeiras, completas e atualizadas.</li>
                  <li>O titular da conta responde pelo uso de suas credenciais e pela segurança de acesso ao app.</li>
                  <li>O uso de dados falsos, identidade enganosa ou fraude poderá resultar em bloqueio imediato da conta.</li>
                </ul>
              </div>

              <div style={styles.sectionBox}>
                <h3 style={styles.sectionSubtitle}>3) Reservas e funcionamento da plataforma</h3>
                <ul style={styles.list}>
                  <li>As reservas devem ser realizadas pelos fluxos disponibilizados dentro do aplicativo.</li>
                  <li>Uma reserva somente será considerada regular quando registrada no sistema do Quadra Play.</li>
                  <li>Em reservas com pagamento digital, a confirmação poderá depender do status final da transação.</li>
                  <li>Em reservas com pagamento presencial, o usuário assume compromisso de comparecimento e quitação no local, quando aplicável.</li>
                </ul>
              </div>

              <div style={styles.sectionBox}>
                <h3 style={styles.sectionSubtitle}>4) Pagamentos, créditos e reembolsos</h3>
                <p style={styles.paragraph}>
                  As regras específicas sobre pagamento, reembolso, wallet, multa,
                  bloqueio e ausência no horário reservado estão descritas na
                  Política de Cancelamento e na página de Pagamentos e Regras
                  Operacionais, que integram este conjunto contratual.
                </p>
              </div>

              <div style={styles.sectionBox}>
                <h3 style={styles.sectionSubtitle}>5) Conduta e uso aceitável</h3>
                <ul style={styles.list}>
                  <li>É vedado utilizar a plataforma para fraude, abuso operacional, manipulação indevida de reservas ou qualquer prática ilícita.</li>
                  <li>No-show, inadimplência, tentativa de burlar regras do app ou causar prejuízo ao ecossistema podem gerar strike, redução de reputação, bloqueio temporário e outras medidas compatíveis com a política vigente.</li>
                  <li>O usuário deve respeitar as regras do estabelecimento parceiro, os horários reservados e os fluxos operacionais definidos pela plataforma.</li>
                </ul>
              </div>

              <div style={styles.sectionBox}>
                <h3 style={styles.sectionSubtitle}>6) Limitações e disponibilidade</h3>
                <p style={styles.paragraph}>
                  O Quadra Play poderá atualizar funcionalidades, corrigir erros,
                  alterar fluxos e evoluir regras operacionais conforme o avanço do
                  produto. A plataforma não garante disponibilidade ininterrupta e
                  poderá realizar manutenções, ajustes e melhorias.
                </p>
              </div>

              <div style={styles.sectionBox}>
                <h3 style={styles.sectionSubtitle}>7) Privacidade e dados</h3>
                <p style={styles.paragraph}>
                  O tratamento de dados pessoais segue a Política de Privacidade do
                  Quadra Play, que integra estes Termos e deve ser lida em conjunto
                  com este documento.
                </p>
              </div>

              <div style={styles.sectionBox}>
                <h3 style={styles.sectionSubtitle}>8) Atualizações dos Termos</h3>
                <p style={styles.paragraph}>
                  Estes Termos podem ser alterados a qualquer tempo. Em caso de
                  atualização material, o usuário poderá ser solicitado a aceitar a
                  nova versão para continuar utilizando a plataforma.
                </p>
              </div>

              <div style={styles.footerBox}>
                Este texto foi estruturado para o MVP com linguagem de produto
                profissional. Antes do lançamento oficial, vale alinhar a versão
                final com revisão jurídica e com o fluxo definitivo de pagamentos.
              </div>

              <div style={styles.actions}>
                <button onClick={voltar} style={styles.buttonSecondary}>
                  Voltar
                </button>

                <button
                  onClick={() => navigate("/politica-cancelamento")}
                  style={styles.buttonPrimary}
                >
                  Ver política de cancelamento
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}