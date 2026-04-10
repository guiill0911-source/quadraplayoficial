import Header from "../components/Header";
import { useNavigate } from "react-router-dom";

const styles = {
  page: {
    minHeight: "100vh",
    background:
      "linear-gradient(180deg, #03122e 0px, #053ff9 180px, #f8fafc 180px, #f8fafc 100%)",
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
    background: "linear-gradient(135deg, #053ff9, #2563eb)",
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
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 20,
    padding: 20,
    marginTop: 16,
  } as const,

  sectionTitle: {
    margin: 0,
    color: "#03122e",
    fontSize: 22,
    fontWeight: 900,
  } as const,

  sectionSubtitle: {
    margin: "0 0 10px",
    color: "#03122e",
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

  alertStrong: {
    marginTop: 18,
    padding: 18,
    borderRadius: 18,
    background: "linear-gradient(180deg, #fff7ed 0%, #fffbeb 100%)",
    border: "1px solid #fdba74",
    color: "#9a3412",
    fontSize: 14,
    lineHeight: 1.7,
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
    background: "#053ff9",
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
    color: "#03122e",
    fontWeight: 800,
    fontSize: 15,
    cursor: "pointer",
  } as const,
};

export default function PagamentosRegras() {
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
              <div style={styles.pill}>💳 Operação, pagamentos e consequências</div>
              <h1 style={styles.heroTitle}>Pagamentos, Reembolsos e Regras Operacionais</h1>
              <p style={styles.heroText}>
                Esta página resume como os pagamentos funcionam no Quadra Play e
                quais são as consequências aplicáveis em caso de cancelamento fora
                do prazo, ausência no horário reservado, inadimplência ou descumprimento
                das regras da plataforma.
              </p>

              <div style={styles.chips}>
                <div style={styles.chip}>PIX no app</div>
                <div style={styles.chip}>Pagamento presencial</div>
                <div style={styles.chip}>No-show e bloqueios</div>
              </div>
            </div>
          </section>

          <section style={styles.card}>
            <h2 style={styles.sectionTitle}>1. Formas de pagamento</h2>

            <div style={styles.sectionBox}>
              <h3 style={styles.sectionSubtitle}>Pagamento digital na plataforma</h3>
              <p style={styles.paragraph}>
                Em reservas com pagamento via PIX ou outro meio digital integrado,
                a confirmação da reserva poderá depender da efetiva compensação do
                pagamento, da validação operacional do status e das regras de repasse.
              </p>
            </div>

            <div style={styles.sectionBox}>
              <h3 style={styles.sectionSubtitle}>Pagamento presencial</h3>
              <p style={styles.paragraph}>
                Em determinadas quadras, o pagamento poderá ocorrer presencialmente,
                diretamente no estabelecimento, conforme regras definidas pela quadra
                parceira e informadas no fluxo de reserva.
              </p>
            </div>

            <div style={styles.sectionBox}>
              <h3 style={styles.sectionSubtitle}>2. Quando a reserva é considerada válida</h3>
              <ul style={styles.list}>
                <li>No pagamento digital, a reserva depende do registro válido no app e do status final do pagamento.</li>
                <li>No pagamento presencial, a reserva registrada no app gera compromisso de comparecimento e pagamento no local.</li>
                <li>O usuário não pode utilizar a modalidade presencial para reservar e simplesmente deixar de comparecer sem consequência.</li>
              </ul>
            </div>

            <div style={styles.sectionBox}>
              <h3 style={styles.sectionSubtitle}>3. Cancelamento e reembolso</h3>
              <p style={styles.paragraph}>
                As regras detalhadas de cancelamento e reembolso seguem a Política
                de Cancelamento do Quadra Play, inclusive quanto a prazos, créditos
                internos, ausência de devolução em dinheiro em determinadas hipóteses
                e medidas de proteção ao ecossistema.
              </p>
            </div>

            <div style={styles.sectionBox}>
              <h3 style={styles.sectionSubtitle}>4. No-show e ausência no pagamento presencial</h3>
              <ul style={styles.list}>
                <li>Se o usuário reservar e não comparecer, poderá ser caracterizado no-show.</li>
                <li>Se a reserva for presencial e o atleta não comparecer para pagar e utilizar o horário, isso poderá gerar strike, bloqueio e outras consequências previstas na plataforma.</li>
                <li>O objetivo dessas medidas é evitar prejuízo operacional ao estabelecimento e o desperdício do horário reservado.</li>
              </ul>
            </div>

            <div style={styles.sectionBox}>
              <h3 style={styles.sectionSubtitle}>5. Penalidades possíveis no app</h3>
              <ul style={styles.list}>
                <li>registro de strike por ausência ou descumprimento relevante;</li>
                <li>redução de reputação operacional do usuário;</li>
                <li>bloqueio temporário da conta;</li>
                <li>exigência de quitação de multa ou pendência antes de novas reservas;</li>
                <li>restrição de determinadas funcionalidades até regularização.</li>
              </ul>
            </div>

            <div style={styles.sectionBox}>
              <h3 style={styles.sectionSubtitle}>6. Multas e regularização</h3>
              <p style={styles.paragraph}>
                Quando houver aplicação de multa ou bloqueio por reincidência,
                a regularização poderá depender do pagamento do valor indicado no app,
                conforme política vigente, antes da liberação de novas reservas.
              </p>
            </div>

            <div style={styles.alertStrong}>
              Reservar e não comparecer, especialmente em modalidades de pagamento
              presencial, não é tratado como mera desistência sem efeito. O Quadra
              Play poderá aplicar consequências operacionais para proteger a quadra,
              o fluxo de agenda e a integridade do ecossistema.
            </div>

            <div style={styles.note}>
              Esse texto foi estruturado para ficar claro para o usuário final.
              Na versão final de lançamento, ele pode ser refinado em conjunto com
              os Termos e a Política de Cancelamento para padronizar percentuais,
              prazos e fluxos exatos do produto.
            </div>

            <div style={styles.actions}>
              <button onClick={() => navigate(-1)} style={styles.buttonSecondary}>
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
    </>
  );
}