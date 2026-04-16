import Header from "../components/Header";
import { useNavigate, useSearchParams } from "react-router-dom";

const styles = {
  page: {
    minHeight: "100vh",
    background:
      "linear-gradient(180deg, #03122e 0px, #053ff9 180px, #f8fafc 180px, #f8fafc 100%)",
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
    background: "linear-gradient(135deg, #053ff9, #2563eb)",
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
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 20,
    padding: 20,
    marginTop: 16,
  } as const,

  sectionTitle: {
    margin: "0 0 10px",
    fontSize: 22,
    color: "#03122e",
    fontWeight: 900,
  } as const,

  sectionSubtitle: {
    margin: "0 0 10px",
    fontSize: 18,
    color: "#03122e",
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
    background: "#053ff9",
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
    color: "#03122e",
    fontWeight: 800,
    fontSize: 15,
    cursor: "pointer",
  } as const,
};

export default function TermosDono() {
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
              <div style={styles.heroPill}>🤝 Termos para Parceiros</div>

              <h1 style={styles.heroTitle}>Termos de Parceria — Quadra Play</h1>

              <p style={styles.heroText}>
                Este documento estabelece as condições de uso da plataforma pelos proprietários
de quadras parceiras do Quadra Play, incluindo período de teste, comissão,
responsabilidades operacionais, avaliações, bloqueios e regras gerais da parceria.
              </p>

              <div style={styles.infoRow}>
              <div style={styles.infoChip}>Versão: 2026-04-16</div>
              <div style={styles.infoChip}>Parceiros / Donos de quadra</div>
              <div style={styles.infoChip}>Uso profissional da plataforma</div>
              </div>
            </div>
          </section>

          <div style={styles.contentWrap}>
            <section style={styles.card}>
<h2 style={styles.sectionTitle}>Resumo importante</h2>
<p style={styles.paragraph}>
  Ao utilizar o Quadra Play como parceiro, o proprietário da quadra declara ciência
  de que a plataforma atua como intermediadora digital de reservas esportivas,
  disponibilizando ferramentas de gestão, divulgação, organização de horários,
  recebimento de avaliações e controle operacional da parceria.
</p>

<div style={styles.note}>
  Durante os primeiros 30 dias de uso, o parceiro poderá utilizar a plataforma em
  período de teste gratuito. Após esse prazo, passa a incidir a comissão padrão
  sobre as reservas realizadas, conforme as regras vigentes do Quadra Play.
</div>
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
                <div style={styles.sectionBox}>
  <h3 style={styles.sectionSubtitle}>1) Objeto da parceria</h3>
  <p style={styles.paragraph}>
    O Quadra Play é uma plataforma digital que permite ao parceiro divulgar sua
    quadra, organizar horários, receber reservas e operar sua presença digital
    dentro do ecossistema do aplicativo.
  </p>
</div>
                <p style={styles.paragraph}>
                  O Quadra Play é uma plataforma digital voltada à busca, reserva,
                  organização e gestão de horários esportivos, aproximando atletas,
                  quadras e operadores em um ambiente de uso controlado.
                </p>
              </div>

              <div style={styles.sectionBox}>
                <div style={styles.sectionBox}>
  <h3 style={styles.sectionSubtitle}>2) Cadastro do parceiro</h3>
  <ul style={styles.list}>
    <li>O parceiro deve fornecer informações verdadeiras, completas e atualizadas sobre sua conta e sua quadra.</li>
    <li>O parceiro é responsável pelas credenciais de acesso utilizadas no aplicativo.</li>
    <li>O uso de informações falsas, enganosas ou fraudulentas poderá gerar bloqueio imediato da conta e da quadra.</li>
  </ul>
</div>
                <ul style={styles.list}>
                  <li>O usuário deve fornecer informações verdadeiras, completas e atualizadas.</li>
                  <li>O titular da conta responde pelo uso de suas credenciais e pela segurança de acesso ao app.</li>
                  <li>O uso de dados falsos, identidade enganosa ou fraude poderá resultar em bloqueio imediato da conta.</li>
                </ul>
              </div>

              <div style={styles.sectionBox}>
               <div style={styles.sectionBox}>
  <h3 style={styles.sectionSubtitle}>3) Funcionamento da plataforma</h3>
  <ul style={styles.list}>
    <li>As reservas devem ser realizadas pelos fluxos disponibilizados dentro do aplicativo.</li>
    <li>Os horários exibidos e organizados no sistema dependem das informações cadastradas pelo parceiro.</li>
    <li>A plataforma atua como intermediadora digital, organizando a experiência de reserva entre atleta e parceiro.</li>
    <li>O parceiro compromete-se a respeitar as reservas confirmadas no sistema, salvo situações excepcionais justificadas.</li>
  </ul>
</div>
                <ul style={styles.list}>
                  <li>As reservas devem ser realizadas pelos fluxos disponibilizados dentro do aplicativo.</li>
                  <li>Uma reserva somente será considerada regular quando registrada no sistema do Quadra Play.</li>
                  <li>Em reservas com pagamento digital, a confirmação poderá depender do status final da transação.</li>
                  <li>Em reservas com pagamento presencial, o usuário assume compromisso de comparecimento e quitação no local, quando aplicável.</li>
                </ul>
              </div>

              <div style={styles.sectionBox}>
                <div style={styles.sectionBox}>
  <h3 style={styles.sectionSubtitle}>4) Trial, comissão e pagamentos</h3>
  <p style={styles.paragraph}>
    O parceiro poderá utilizar o Quadra Play com período inicial de 30 dias de
    teste gratuito, sem cobrança de comissão. Após esse prazo, a plataforma
    poderá cobrar comissão de 5% sobre cada reserva realizada. Nos fluxos com
    integração de pagamento, a divisão poderá ocorrer automaticamente; nos demais
    casos, o valor poderá ser registrado como saldo pendente do parceiro junto à
    plataforma.
  </p>
</div>
                <p style={styles.paragraph}>
                  As regras específicas sobre pagamento, reembolso, wallet, multa,
                  bloqueio e ausência no horário reservado estão descritas na
                  Política de Cancelamento e na página de Pagamentos e Regras
                  Operacionais, que integram este conjunto contratual.
                </p>
              </div>

              <div style={styles.sectionBox}>
                <div style={styles.sectionBox}>
  <h3 style={styles.sectionSubtitle}>5) Responsabilidades do parceiro</h3>
  <ul style={styles.list}>
    <li>O parceiro é responsável pela quadra, sua estrutura, organização, funcionamento e atendimento prestado aos atletas.</li>
    <li>O parceiro é responsável por manter informações corretas sobre horários, disponibilidade e condições de uso do espaço.</li>
    <li>O parceiro compromete-se a atuar com boa-fé e a não burlar os fluxos operacionais da plataforma.</li>
  </ul>
</div>
                <ul style={styles.list}>
                  <li>É vedado utilizar a plataforma para fraude, abuso operacional, manipulação indevida de reservas ou qualquer prática ilícita.</li>
                  <li>No-show, inadimplência, tentativa de burlar regras do app ou causar prejuízo ao ecossistema podem gerar strike, redução de reputação, bloqueio temporário e outras medidas compatíveis com a política vigente.</li>
                  <li>O usuário deve respeitar as regras do estabelecimento parceiro, os horários reservados e os fluxos operacionais definidos pela plataforma.</li>
                </ul>
              </div>

              <div style={styles.sectionBox}>
                <div style={styles.sectionBox}>
  <h3 style={styles.sectionSubtitle}>6) Avaliações, bloqueio e medidas operacionais</h3>
  <p style={styles.paragraph}>
    Os atletas poderão avaliar a quadra e a experiência de reserva dentro da
    plataforma. O Quadra Play poderá adotar medidas operacionais, incluindo
    bloqueio temporário ou suspensão da quadra, em caso de inadimplência,
    fraude, tentativa de burlar o sistema, uso indevido da plataforma ou conduta
    prejudicial ao ecossistema do aplicativo.
  </p>
</div>
                <p style={styles.paragraph}>
                  O Quadra Play poderá atualizar funcionalidades, corrigir erros,
                  alterar fluxos e evoluir regras operacionais conforme o avanço do
                  produto. A plataforma não garante disponibilidade ininterrupta e
                  poderá realizar manutenções, ajustes e melhorias.
                </p>
              </div>

              <div style={styles.sectionBox}>
                <div style={styles.sectionBox}>
  <h3 style={styles.sectionSubtitle}>7) Limitação de responsabilidade da plataforma</h3>
  <p style={styles.paragraph}>
    O Quadra Play atua como plataforma digital intermediadora e não se
    responsabiliza por acidentes, lesões, danos materiais, conflitos entre
    usuários, condutas ocorridas no local da quadra ou pela execução do serviço
    esportivo prestado pelo parceiro. A responsabilidade pela operação física do
    espaço é do proprietário ou responsável pela quadra.
  </p>
</div>
                <p style={styles.paragraph}>
                  O tratamento de dados pessoais segue a Política de Privacidade do
                  Quadra Play, que integra estes Termos e deve ser lida em conjunto
                  com este documento.
                </p>
              </div>

              <div style={styles.sectionBox}>
                <div style={styles.sectionBox}>
  <h3 style={styles.sectionSubtitle}>8) Atualizações destes termos</h3>
  <p style={styles.paragraph}>
    Estes Termos de Parceria poderão ser atualizados a qualquer momento para
    refletir mudanças operacionais, comerciais, técnicas ou jurídicas do Quadra
    Play. Em caso de alteração relevante, o parceiro poderá ser solicitado a
    aceitar a nova versão para continuar utilizando a plataforma.
  </p>
</div>
                <p style={styles.paragraph}>
                  Estes Termos podem ser alterados a qualquer tempo. Em caso de
                  atualização material, o usuário poderá ser solicitado a aceitar a
                  nova versão para continuar utilizando a plataforma.
                </p>
              </div>

              <div style={styles.footerBox}>
                Este documento foi estruturado para o modelo operacional atual do Quadra Play,
com foco na parceria entre a plataforma e os proprietários de quadras. Antes da
escala comercial maior, recomenda-se revisão jurídica formal da versão final.
              </div>

              <div style={styles.actions}>
                <button onClick={voltar} style={styles.buttonSecondary}>
                  Voltar
                </button>

                <button
  onClick={() => navigate(-1)}
  style={styles.buttonPrimary}
>
  Li os termos
</button>
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}