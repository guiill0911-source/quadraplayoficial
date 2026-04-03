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
    fontSize: 36,
    lineHeight: 1.08,
    fontWeight: 900,
  } as const,

  heroText: {
    marginTop: 14,
    maxWidth: 820,
    color: "rgba(255,255,255,0.92)",
    fontSize: 16,
    lineHeight: 1.7,
  } as const,

  row: {
    display: "grid",
    gridTemplateColumns: "1.2fr 0.8fr",
    gap: 18,
    marginTop: 24,
  } as const,

  card: {
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

  title: {
    margin: 0,
    color: "#0f172a",
    fontSize: 24,
    fontWeight: 900,
  } as const,

  subtitle: {
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

  valueBox: {
    borderRadius: 18,
    padding: 16,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  } as const,

  valueTitle: {
    margin: "0 0 6px",
    color: "#0f172a",
    fontSize: 16,
    fontWeight: 900,
  } as const,

  valueText: {
    margin: 0,
    color: "#475569",
    fontSize: 14,
    lineHeight: 1.7,
  } as const,

  asideList: {
    display: "grid",
    gap: 12,
    marginTop: 14,
  } as const,

  asideItem: {
    padding: "14px 16px",
    borderRadius: 18,
    background: "linear-gradient(180deg, #eff6ff 0%, #f8fbff 100%)",
    border: "1px solid #dbeafe",
    color: "#1e3a8a",
    fontSize: 14,
    fontWeight: 800,
    lineHeight: 1.6,
  } as const,

  ctaBox: {
    marginTop: 20,
    padding: 18,
    borderRadius: 20,
    background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)",
    color: "#fff",
  } as const,

  ctaText: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.7,
    color: "rgba(255,255,255,0.92)",
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

export default function QuemSomos() {
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
              <div style={styles.pill}>🏟️ Institucional</div>
              <h1 style={styles.heroTitle}>Quem Somos — Quadra Play</h1>
              <p style={styles.heroText}>
                O Quadra Play nasceu para profissionalizar a conexão entre atletas
                e espaços esportivos. Nossa proposta é simplificar a reserva,
                reduzir atritos operacionais e transformar a experiência de jogar
                em algo mais prático, confiável e organizado para todos os lados.
              </p>
            </div>
          </section>

          <div style={styles.row}>
            <section style={styles.card}>
              <h2 style={styles.title}>Nossa visão de produto</h2>

              <div style={styles.sectionBox}>
                <h3 style={styles.subtitle}>Quem é o Quadra Play</h3>
                <p style={styles.paragraph}>
                  Somos uma plataforma digital voltada ao ecossistema esportivo.
                  Atuamos para conectar atletas, quadras e operadores com uma
                  experiência moderna de busca, reserva, pagamento e gestão.
                </p>
              </div>

              <div style={styles.sectionBox}>
                <h3 style={styles.subtitle}>Nossa missão</h3>
                <p style={styles.paragraph}>
                  Tornar o acesso ao esporte mais simples, eficiente e profissional,
                  oferecendo tecnologia que facilita a vida do atleta e gera mais
                  organização, previsibilidade e receita para os estabelecimentos.
                </p>
              </div>

              <div style={styles.sectionBox}>
                <h3 style={styles.subtitle}>Nossa visão</h3>
                <p style={styles.paragraph}>
                  Ser a principal plataforma brasileira de gestão e reservas
                  esportivas, reconhecida pela confiança, eficiência operacional e
                  inteligência aplicada ao mercado de quadras.
                </p>
              </div>

              <div style={styles.sectionBox}>
                <h3 style={styles.subtitle}>Nossos valores</h3>

                <div style={{ display: "grid", gap: 12 }}>
                  <div style={styles.valueBox}>
                    <p style={styles.valueTitle}>Agilidade com responsabilidade</p>
                    <p style={styles.valueText}>
                      Queremos que reservar uma quadra seja simples, sem burocracia
                      desnecessária e com regras claras.
                    </p>
                  </div>

                  <div style={styles.valueBox}>
                    <p style={styles.valueTitle}>Transparência</p>
                    <p style={styles.valueText}>
                      Preço, horário, disponibilidade, políticas e consequências de
                      uso precisam ser comunicados de forma objetiva.
                    </p>
                  </div>

                  <div style={styles.valueBox}>
                    <p style={styles.valueTitle}>Respeito ao ecossistema</p>
                    <p style={styles.valueText}>
                      O app existe para proteger a experiência do atleta e também o
                      funcionamento saudável das quadras parceiras.
                    </p>
                  </div>

                  <div style={styles.valueBox}>
                    <p style={styles.valueTitle}>Evolução contínua</p>
                    <p style={styles.valueText}>
                      O Quadra Play é construído com foco em melhoria constante,
                      produto robusto e visão de longo prazo.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <aside style={styles.card}>
              <h2 style={styles.title}>O que defendemos</h2>

              <div style={styles.asideList}>
                <div style={styles.asideItem}>
                  Atletas com mais praticidade para encontrar, reservar e organizar
                  seus jogos.
                </div>
                <div style={styles.asideItem}>
                  Donos de quadra com mais controle, mais profissionalismo e menos
                  atrito operacional.
                </div>
                <div style={styles.asideItem}>
                  Regras claras para reduzir cancelamentos abusivos, no-show e
                  prejuízos no ecossistema.
                </div>
                <div style={styles.asideItem}>
                  Produto sério, escalável e preparado para evoluir além do MVP.
                </div>
              </div>

              <div style={styles.ctaBox}>
                <p style={styles.ctaText}>
                  O esporte movimenta rotina, comunidade e negócio. O Quadra Play
                  existe para dar estrutura digital a esse mercado.
                </p>
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
            </aside>
          </div>
        </div>
      </div>
    </>
  );
}