import Header from "../components/Header";
import { useNavigate } from "react-router-dom";

const styles = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(circle at top left, rgba(37,99,235,0.10), transparent 28%), radial-gradient(circle at top right, rgba(15,23,42,0.14), transparent 24%), linear-gradient(180deg, #f8fafc 0%, #eef4ff 100%)",
  } as const,

  container: {
    maxWidth: 1120,
    margin: "0 auto",
    padding: "24px 16px 92px",
  } as const,

  hero: {
    position: "relative" as const,
    overflow: "hidden",
    borderRadius: 30,
    padding: "34px 26px",
    background: "linear-gradient(135deg, #0f172a 0%, #172554 55%, #1d4ed8 100%)",
    color: "#fff",
    boxShadow: "0 28px 90px rgba(15,23,42,0.24)",
  },

  heroGlow1: {
    position: "absolute" as const,
    top: -70,
    right: -40,
    width: 220,
    height: 220,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.08)",
    filter: "blur(10px)",
  },

  heroGlow2: {
    position: "absolute" as const,
    bottom: -90,
    left: -40,
    width: 240,
    height: 240,
    borderRadius: "50%",
    background: "rgba(96,165,250,0.12)",
    filter: "blur(12px)",
  },

  heroContent: {
    position: "relative" as const,
    zIndex: 1,
  },

  pill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 14px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.12)",
    border: "1px solid rgba(255,255,255,0.16)",
    fontSize: 13,
    fontWeight: 800,
    marginBottom: 16,
  } as const,

  heroTitle: {
    margin: 0,
    fontSize: 35,
    lineHeight: 1.08,
    fontWeight: 900,
  } as const,

  heroText: {
    marginTop: 14,
    maxWidth: 860,
    color: "rgba(255,255,255,0.92)",
    fontSize: 16,
    lineHeight: 1.7,
  } as const,

  chips: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap" as const,
    marginTop: 18,
  } as const,

  chip: {
    display: "inline-flex",
    padding: "9px 13px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.12)",
    border: "1px solid rgba(255,255,255,0.16)",
    fontSize: 13,
    fontWeight: 700,
    color: "#fff",
  } as const,

  card: {
    marginTop: 24,
    background: "#fff",
    borderRadius: 24,
    padding: 24,
    boxShadow: "0 18px 50px rgba(15,23,42,0.08)",
    border: "1px solid rgba(226,232,240,0.95)",
  } as const,

  sectionBox: {
    background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
    border: "1px solid #e2e8f0",
    borderRadius: 20,
    padding: 20,
    marginTop: 16,
  } as const,

  sectionTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 22,
    fontWeight: 900,
  } as const,

  sectionSubtitle: {
    margin: "0 0 10px",
    color: "#0f172a",
    fontSize: 20,
    fontWeight: 900,
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

  actions: {
    marginTop: 24,
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
    boxShadow: "0 12px 30px rgba(37,99,235,0.22)",
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

export default function PoliticaPrivacidade() {
  const navigate = useNavigate();

  return (
    <>
      <Header />
      <div style={styles.page}>
        <div style={styles.container}>
          <section style={styles.hero}>
            <div style={styles.heroGlow1} />
            <div style={styles.heroGlow2} />

            <div style={styles.heroContent}>
              <div style={styles.pill}>🔐 Privacidade e proteção de dados</div>
              <h1 style={styles.heroTitle}>Política de Privacidade — Quadra Play</h1>
              <p style={styles.heroText}>
                Esta Política de Privacidade descreve como o Quadra Play coleta,
                utiliza, armazena, compartilha e protege dados pessoais no uso da
                plataforma, em conformidade com a legislação aplicável, em especial
                a Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018),
                o Marco Civil da Internet (Lei nº 12.965/2014) e normas
                complementares aplicáveis.
              </p>

              <div style={styles.chips}>
                <div style={styles.chip}>LGPD</div>
                <div style={styles.chip}>Marco Civil da Internet</div>
                <div style={styles.chip}>Transparência e segurança</div>
              </div>
            </div>
          </section>

          <section style={styles.card}>
            <h2 style={styles.sectionTitle}>1. Aplicação desta política</h2>

            <div style={styles.sectionBox}>
              <p style={styles.paragraph}>
                Esta política se aplica ao tratamento de dados pessoais realizado
                pelo Quadra Play no contexto de cadastro, autenticação, reservas,
                pagamentos, atendimento, navegação e uso das funcionalidades do app.
              </p>
            </div>

            <div style={styles.sectionBox}>
              <h3 style={styles.sectionSubtitle}>2. Dados pessoais que podemos coletar</h3>
              <ul style={styles.list}>
                <li>Dados cadastrais, como nome, e-mail, telefone, CPF e informações de perfil.</li>
                <li>Dados de autenticação e segurança de conta.</li>
                <li>Dados de reserva, histórico de uso, cancelamentos, no-show e reputação operacional.</li>
                <li>Dados de pagamento e transação, inclusive informações enviadas por intermediadores de pagamento.</li>
                <li>Dados de localização, quando fornecidos pelo usuário ou necessários ao funcionamento de buscas e proximidade.</li>
                <li>Dados técnicos de navegação, dispositivo, logs de acesso, IP, data e hora de uso.</li>
              </ul>
            </div>

            <div style={styles.sectionBox}>
              <h3 style={styles.sectionSubtitle}>3. Finalidades do tratamento</h3>
              <ul style={styles.list}>
                <li>Criar, manter e administrar contas de usuário.</li>
                <li>Permitir buscas, reservas, cancelamentos e demais operações da plataforma.</li>
                <li>Processar pagamentos, reembolsos, créditos internos e conciliações financeiras.</li>
                <li>Prevenir fraudes, abusos, inadimplência e uso indevido da plataforma.</li>
                <li>Executar políticas de reputação, strikes, bloqueios e medidas de segurança operacional.</li>
                <li>Prestar suporte, atendimento e responder solicitações dos titulares.</li>
                <li>Cumprir obrigações legais, regulatórias e de defesa em processos administrativos ou judiciais.</li>
                <li>Aprimorar funcionalidades, estabilidade, segurança e experiência do produto.</li>
              </ul>
            </div>

            <div style={styles.sectionBox}>
              <h3 style={styles.sectionSubtitle}>4. Bases legais</h3>
              <p style={styles.paragraph}>
                O tratamento de dados poderá ocorrer com fundamento em bases legais
                previstas na LGPD, incluindo, conforme o caso concreto: execução de
                contrato, cumprimento de obrigação legal ou regulatória, exercício
                regular de direitos, legítimo interesse e consentimento, quando
                necessário.
              </p>
            </div>

            <div style={styles.sectionBox}>
              <h3 style={styles.sectionSubtitle}>5. Compartilhamento de dados</h3>
              <p style={styles.paragraph}>
                O Quadra Play poderá compartilhar dados pessoais com terceiros
                estritamente necessários à operação da plataforma, tais como:
              </p>
              <ul style={styles.list}>
                <li>quadras e estabelecimentos parceiros envolvidos na reserva;</li>
                <li>intermediadores de pagamento e instituições financeiras;</li>
                <li>fornecedores de infraestrutura, hospedagem, autenticação, analytics, suporte e segurança;</li>
                <li>autoridades públicas, órgãos reguladores ou judiciais, quando houver obrigação legal.</li>
              </ul>
            </div>

            <div style={styles.sectionBox}>
              <h3 style={styles.sectionSubtitle}>6. Armazenamento e retenção</h3>
              <p style={styles.paragraph}>
                Os dados pessoais serão armazenados pelo período necessário para
                cumprimento das finalidades informadas, obrigações legais,
                regulatórias, prevenção a fraude, exercício de direitos e
                preservação da integridade operacional da plataforma.
              </p>
            </div>

            <div style={styles.sectionBox}>
              <h3 style={styles.sectionSubtitle}>7. Segurança da informação</h3>
              <p style={styles.paragraph}>
                O Quadra Play adota medidas técnicas e administrativas razoáveis e
                compatíveis com o estado da técnica para proteger dados pessoais
                contra acessos não autorizados, destruição, perda, alteração,
                comunicação ou difusão indevida.
              </p>
            </div>

            <div style={styles.sectionBox}>
              <h3 style={styles.sectionSubtitle}>8. Direitos do titular</h3>
              <p style={styles.paragraph}>
                Observadas as hipóteses legais, o titular poderá solicitar, quando
                cabível:
              </p>
              <ul style={styles.list}>
                <li>confirmação da existência de tratamento;</li>
                <li>acesso aos dados;</li>
                <li>correção de dados incompletos, inexatos ou desatualizados;</li>
                <li>anonimização, bloqueio ou eliminação de dados desnecessários;</li>
                <li>portabilidade, nos termos aplicáveis;</li>
                <li>informação sobre compartilhamentos realizados;</li>
                <li>revogação de consentimento, quando essa for a base legal.</li>
              </ul>
            </div>

            <div style={styles.sectionBox}>
              <h3 style={styles.sectionSubtitle}>9. Cookies, logs e tecnologias semelhantes</h3>
              <p style={styles.paragraph}>
                O Quadra Play pode utilizar cookies, identificadores e registros de
                navegação para autenticação, segurança, desempenho, preferências do
                usuário, analytics e melhoria da experiência.
              </p>
            </div>

            <div style={styles.sectionBox}>
              <h3 style={styles.sectionSubtitle}>10. Contato e solicitações</h3>
              <p style={styles.paragraph}>
                Solicitações relacionadas à privacidade, proteção de dados e
                exercício de direitos poderão ser encaminhadas pelos canais oficiais
                do Quadra Play. O contato responsável por privacidade e tratamento
                de dados deve permanecer divulgado de forma clara na plataforma.
              </p>
            </div>

            <div style={styles.note}>
              Antes do lançamento oficial em produção, vale revisar este texto com
              apoio jurídico para ajustar dados do controlador, canal oficial do
              encarregado/DPO, fornecedores efetivos e fluxo final de retenção.
            </div>

            <div style={styles.actions}>
              <button onClick={() => navigate(-1)} style={styles.buttonSecondary}>
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
    </>
  );
}