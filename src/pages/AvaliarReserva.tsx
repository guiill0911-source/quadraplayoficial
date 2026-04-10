import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Header from "../components/Header";
import ConfirmModal from "../components/ConfirmModal";
import { doc, getDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "../services/firebase";
import {
  criarAvaliacao,
  jaExisteAvaliacaoParaReserva,
} from "../services/avaliacoes";

const styles = {
  page: {
    minHeight: "100vh",
    background:
      "linear-gradient(180deg, #03122e 0px, #053ff9 180px, #f8fafc 180px, #f8fafc 100%)",
    paddingBottom: 40,
  } as const,

  container: {
    width: "100%",
    maxWidth: 980,
    margin: "0 auto",
    padding: "20px 16px 32px",
    boxSizing: "border-box" as const,
  } as const,

  backLink: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    textDecoration: "none",
    color: "#ffffff",
    fontWeight: 700,
    marginBottom: 16,
  } as const,

  hero: {
    position: "relative" as const,
    overflow: "hidden",
    borderRadius: 28,
    padding: "28px 24px",
    background: "linear-gradient(135deg, #053ff9, #2563eb)",
    color: "#fff",
    boxShadow: "0 22px 60px rgba(15, 23, 42, 0.18)",
  },

  heroGlow: {
    position: "absolute" as const,
    right: -60,
    top: -40,
    width: 220,
    height: 220,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.12)",
    filter: "blur(8px)",
  },

  heroGlow2: {
    position: "absolute" as const,
    left: -40,
    bottom: -80,
    width: 220,
    height: 220,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.10)",
    filter: "blur(10px)",
  },

  heroBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "7px 12px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.15)",
    border: "1px solid rgba(255,255,255,0.18)",
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 0.3,
    marginBottom: 14,
  } as const,

  heroTitle: {
    margin: 0,
    fontSize: "clamp(28px, 4vw, 42px)",
    lineHeight: 1.05,
    fontWeight: 900,
    letterSpacing: -0.6,
    maxWidth: 720,
  } as const,

  heroText: {
    margin: "12px 0 0",
    maxWidth: 740,
    fontSize: 15,
    lineHeight: 1.6,
    color: "rgba(255,255,255,0.92)",
  } as const,

  grid: {
    display: "grid",
    gridTemplateColumns: "1.2fr 0.8fr",
    gap: 18,
    marginTop: 18,
  } as const,

  card: {
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: 24,
    boxShadow: "0 14px 34px rgba(15, 23, 42, 0.06)",
  } as const,

  cardBody: {
    padding: 20,
  } as const,

  sectionTitle: {
    margin: 0,
    fontSize: 20,
    fontWeight: 900,
    color: "#03122e",
    letterSpacing: -0.3,
  } as const,

  helper: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.55,
  } as const,

  alertError: {
    marginTop: 16,
    border: "1px solid #fecaca",
    background: "#fff1f2",
    color: "#b91c1c",
    borderRadius: 16,
    padding: 14,
    whiteSpace: "pre-line" as const,
    fontWeight: 700,
  } as const,

  alertOk: {
    marginTop: 16,
    border: "1px solid #bbf7d0",
    background: "#f0fdf4",
    color: "#166534",
    borderRadius: 16,
    padding: 14,
    whiteSpace: "pre-line" as const,
    fontWeight: 700,
  } as const,

  loadingBox: {
    marginTop: 16,
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    color: "#475569",
    borderRadius: 16,
    padding: 14,
    fontWeight: 700,
  } as const,

  field: {
    display: "grid",
    gap: 8,
    marginTop: 18,
  } as const,

  label: {
    fontSize: 14,
    fontWeight: 800,
    color: "#0f172a",
  } as const,

  textarea: {
    width: "100%",
    marginTop: 0,
    padding: 14,
    borderRadius: 16,
    border: "1px solid #cbd5e1",
    background: "#fff",
    resize: "vertical" as const,
    minHeight: 120,
    fontSize: 14,
    color: "#0f172a",
    outline: "none",
    boxSizing: "border-box" as const,
  } as const,

  actions: {
    marginTop: 18,
    display: "flex",
    gap: 10,
    flexWrap: "wrap" as const,
  } as const,

  greenBtn: {
    border: "none",
    borderRadius: 14,
    background: "#8ae809",
    color: "#fff",
    padding: "12px 16px",
    fontWeight: 800,
    cursor: "pointer",
    boxShadow: "0 10px 24px rgba(34, 197, 94, 0.22)",
  } as const,

  neutralBtn: {
    border: "1px solid #cbd5e1",
    borderRadius: 14,
    background: "#fff",
    color: "#0f172a",
    padding: "12px 16px",
    fontWeight: 800,
    cursor: "pointer",
  } as const,

  sideBox: {
    borderRadius: 20,
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    padding: 16,
  } as const,

  sideTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 900,
    color: "#03122e",
  } as const,

  sideText: {
    margin: "8px 0 0",
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.6,
  } as const,

  infoList: {
    marginTop: 14,
    display: "grid",
    gap: 10,
  } as const,

  infoItem: {
    borderRadius: 16,
    border: "1px solid #e2e8f0",
    background: "#fff",
    padding: 12,
  } as const,

  infoItemLabel: {
    margin: 0,
    fontSize: 12,
    fontWeight: 800,
    color: "#64748b",
    textTransform: "uppercase" as const,
    letterSpacing: 0.4,
  } as const,

  infoItemValue: {
    margin: "6px 0 0",
    fontSize: 14,
    fontWeight: 800,
    color: "#03122e",
    lineHeight: 1.5,
  } as const,

  emptyState: {
    marginTop: 14,
    border: "1px dashed #cbd5e1",
    background: "#fff",
    color: "#64748b",
    borderRadius: 16,
    padding: 18,
    fontWeight: 700,
  } as const,
};

function Stars({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        alignItems: "center",
        flexWrap: "wrap",
      }}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const ativo = n <= value;

        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            disabled={disabled}
            style={{
              minHeight: 46,
              padding: "0 16px",
              borderRadius: 14,
              border: ativo ? "1px solid #facc15" : "1px solid #cbd5e1",
              cursor: disabled ? "not-allowed" : "pointer",
              background: ativo ? "#fef9c3" : "#fff",
              color: ativo ? "#854d0e" : "#0f172a",
              fontWeight: 900,
              boxShadow: ativo ? "0 8px 18px rgba(250,204,21,0.18)" : "none",
            }}
          >
            {n} ★
          </button>
        );
      })}
    </div>
  );
}

export default function AvaliarReserva() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const reservaId = String(params.get("reservaId") ?? "");
  const quadraId = String(params.get("quadraId") ?? "");

  const [loading, setLoading] = useState(true);
  const [permitido, setPermitido] = useState(false);

  const [nota, setNota] = useState(5);
  const [comentario, setComentario] = useState("");

  const [erro, setErro] = useState<string | null>(null);
  const [msg, setMsg] = useState<string>("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 900);

  async function validarRegras() {
    setLoading(true);
    setErro(null);
    setMsg("");

    try {
      const user = getAuth().currentUser;
      if (!user?.uid) throw new Error("Você precisa estar logado.");

      if (!reservaId) throw new Error("reservaId inválido na URL.");
      if (!quadraId) throw new Error("quadraId inválido na URL.");

      const reservaRef = doc(db, "reservas", reservaId);
      const snap = await getDoc(reservaRef);
      if (!snap.exists()) throw new Error("Reserva não encontrada.");

      const r = snap.data() as any;

      if (r?.clienteUid !== user.uid) {
        throw new Error("Você não tem permissão para avaliar esta reserva.");
      }
      if (r?.status !== "finalizada") {
        throw new Error("Você só pode avaliar após a reserva ser finalizada.");
      }
      if (r?.naoCompareceu === true) {
        throw new Error(
          "Não é possível avaliar uma reserva marcada como 'não compareceu'."
        );
      }
      if (r?.avaliadaEm) {
        throw new Error("Esta reserva já foi avaliada.");
      }

      const jaExiste = await jaExisteAvaliacaoParaReserva(reservaId);
      if (jaExiste) throw new Error("Esta reserva já foi avaliada.");

      setPermitido(true);
    } catch (e: any) {
      setPermitido(false);
      setErro(e?.message ?? "Não foi possível validar a avaliação.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const onResize = () => {
      setIsMobile(window.innerWidth <= 900);
    };

    onResize();
    window.addEventListener("resize", onResize);

    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    validarRegras();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservaId, quadraId]);

  async function onEnviar() {
    if (!permitido || enviando) return;
    setConfirmOpen(true);
  }

  async function confirmarEnvio() {
    try {
      setEnviando(true);
      setErro(null);
      setMsg("");

      await criarAvaliacao({
        reservaId,
        quadraId,
        nota,
        comentario,
      });

      setMsg("Avaliação enviada ✅");
      setPermitido(false);
      setConfirmOpen(false);

      setTimeout(() => navigate("/minhas-reservas"), 800);
    } catch (e: any) {
      setErro(e?.message ?? "Erro ao enviar avaliação.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <Header />

      <div style={styles.page}>
        <div style={styles.container}>
          <Link to="/dono" style={{ ...styles.backLink, color: "#fff" }}>
            <span>←</span>
            <span>Voltar para minhas reservas</span>
          </Link>

          <section style={styles.hero}>
            <div style={styles.heroGlow} />
            <div style={styles.heroGlow2} />

            <div style={{ position: "relative" }}>
              <div style={styles.heroBadge}>AVALIAÇÃO DA RESERVA</div>

              <h1 style={styles.heroTitle}>
                Conte como foi sua experiência na quadra
              </h1>

              <p style={styles.heroText}>
                Sua avaliação ajuda outros atletas a escolher melhor e também
                fortalece a credibilidade das quadras dentro do Quadra Play.
              </p>
            </div>
          </section>

          <div
            style={{
              ...styles.grid,
              gridTemplateColumns: isMobile ? "1fr" : "1.2fr 0.8fr",
            }}
          >
            <section style={styles.card}>
              <div style={styles.cardBody}>
                <h2 style={styles.sectionTitle}>Enviar avaliação</h2>
                <p style={styles.helper}>
                  Escolha uma nota de 1 a 5 e, se quiser, escreva um comentário
                  com sua percepção sobre a quadra.
                </p>

                {loading && (
                  <div style={styles.loadingBox}>
                    Carregando validações da reserva…
                  </div>
                )}

                {!loading && erro && (
                  <div style={styles.alertError}>{erro}</div>
                )}

                {!loading && msg && !erro && (
                  <div style={styles.alertOk}>{msg}</div>
                )}

                {!loading && permitido && (
                  <>
                    <div style={styles.field}>
                      <label style={styles.label}>Nota</label>
                      <Stars
                        value={nota}
                        onChange={setNota}
                        disabled={enviando}
                      />
                    </div>

                    <div style={styles.field}>
                      <label style={styles.label}>Comentário (opcional)</label>
                      <textarea
                        value={comentario}
                        onChange={(e) => setComentario(e.target.value)}
                        rows={5}
                        style={styles.textarea}
                        placeholder="Ex: quadra muito boa, iluminação ótima, atendimento rápido, localização fácil..."
                        disabled={enviando}
                      />
                    </div>

                    <div style={styles.actions}>
                      <button
                        onClick={onEnviar}
                        style={styles.greenBtn}
                        disabled={enviando}
                      >
                        {enviando ? "Enviando..." : "Enviar avaliação"}
                      </button>

                      <button
                        onClick={validarRegras}
                        style={styles.neutralBtn}
                        disabled={enviando}
                      >
                        Revalidar
                      </button>
                    </div>
                  </>
                )}

                {!loading && !permitido && !erro && !msg && (
                  <div style={styles.emptyState}>
                    Esta reserva não está disponível para avaliação no momento.
                  </div>
                )}
              </div>
            </section>

            <aside style={{ display: "grid", gap: 18 }}>
              <div style={styles.sideBox}>
                <h3 style={styles.sideTitle}>Dicas para avaliar bem</h3>
                <p style={styles.sideText}>
                  Uma boa avaliação é objetiva, honesta e ajuda outras pessoas a
                  entender como foi a experiência real na quadra.
                </p>

                <div style={styles.infoList}>
                  <div style={styles.infoItem}>
                    <p style={styles.infoItemLabel}>Considere</p>
                    <p style={styles.infoItemValue}>
                      qualidade da quadra, iluminação, organização, localização
                      e estado geral do espaço.
                    </p>
                  </div>

                  <div style={styles.infoItem}>
                    <p style={styles.infoItemLabel}>Evite</p>
                    <p style={styles.infoItemValue}>
                      comentários genéricos demais ou informações que não ajudem
                      quem vai reservar depois.
                    </p>
                  </div>

                  <div style={styles.infoItem}>
                    <p style={styles.infoItemLabel}>Objetivo</p>
                    <p style={styles.infoItemValue}>
                      fortalecer a confiança no app e melhorar a escolha das
                      quadras.
                    </p>
                  </div>
                </div>
              </div>

              <div style={styles.sideBox}>
                <h3 style={styles.sideTitle}>Resumo desta avaliação</h3>

                <div style={styles.infoList}>
                  <div style={styles.infoItem}>
                    <p style={styles.infoItemLabel}>Reserva</p>
                    <p style={styles.infoItemValue}>{reservaId || "—"}</p>
                  </div>

                  <div style={styles.infoItem}>
                    <p style={styles.infoItemLabel}>Quadra</p>
                    <p style={styles.infoItemValue}>{quadraId || "—"}</p>
                  </div>

                  <div style={styles.infoItem}>
                    <p style={styles.infoItemLabel}>Nota atual</p>
                    <p style={styles.infoItemValue}>{nota} de 5</p>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={confirmOpen}
        title="Confirmar envio da avaliação"
        message={`Você está prestes a enviar sua avaliação.\n\nNota: ${nota}\nComentário: ${
          comentario?.trim() ? comentario.trim() : "—"
        }`}
        confirmText="Enviar avaliação"
        cancelText="Voltar"
        onConfirm={confirmarEnvio}
        onCancel={() => setConfirmOpen(false)}
        loading={enviando}
      />
    </>
  );
}