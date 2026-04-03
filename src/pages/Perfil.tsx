import { useEffect, useState } from "react";
import Header from "../components/Header";
import { useAuth } from "../services/authContext";
import { db, auth } from "../services/firebase";
import { updateEmail } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";
import {
  collection,
  getDocs,
  doc,
  getDoc,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { Link } from "react-router-dom";
import {
  ouvirResumoReputacaoDoUsuario,
  resumoReputacaoPadrao,
  type ResumoReputacao,
} from "../services/reputacao";

type Quadra = {
  id: string;
  nome?: string;
  cidade?: string;
  endereco?: string;
  fotoCapaUrl?: string;
};

type ReservaPerfil = {
  id: string;
  quadraId: string;
  quadraNome?: string;
  esporte?: string;
  data?: string;
  horaInicio?: string;
  horaFim?: string;
  valor?: number;
  status?: string;
};

function getNivelColors(score: number) {
  if (score >= 90) {
    return {
      bg: "#e8fff2",
      text: "#15803d",
      border: "#bbf7d0",
    };
  }

  if (score >= 70) {
    return {
      bg: "#fff8e6",
      text: "#a16207",
      border: "#fde68a",
    };
  }

  if (score >= 40) {
    return {
      bg: "#fff1e8",
      text: "#c2410c",
      border: "#fdba74",
    };
  }

  return {
    bg: "#ffeaea",
    text: "#b91c1c",
    border: "#fecaca",
  };
}

function formatBRL(value: number) {
  return Number(value ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function tituloStatus(status?: string) {
  if (status === "confirmada") return "Confirmada";
  if (status === "agendada") return "Agendada";
  if (status === "finalizada") return "Finalizada";
  if (status === "cancelada") return "Cancelada";
  return status ?? "—";
}

function statusVisual(status?: string) {
  const s = String(status ?? "").toLowerCase().trim();

  if (s === "cancelada") {
    return {
      text: "Cancelada",
      color: "#991b1b",
      bg: "#fef2f2",
      border: "#fecaca",
    };
  }

  if (s === "finalizada") {
    return {
      text: "Finalizada",
      color: "#0f766e",
      bg: "#ecfeff",
      border: "#a5f3fc",
    };
  }

  if (s === "confirmada" || s === "agendada") {
    return {
      text: tituloStatus(status),
      color: "#1d4ed8",
      bg: "#eff6ff",
      border: "#bfdbfe",
    };
  }

  return {
    text: status ?? "—",
    color: "#334155",
    bg: "#f8fafc",
    border: "#cbd5e1",
  };
}

export default function Perfil() {
  const { user } = useAuth();

  const [data, setData] = useState<any>(null);
  const [favoritas, setFavoritas] = useState<Quadra[]>([]);
  const [historico, setHistorico] = useState<ReservaPerfil[]>([]);
  const [loading, setLoading] = useState(true);

  const [reenviandoVerificacao, setReenviandoVerificacao] = useState(false);
  const [cooldownVerificacao, setCooldownVerificacao] = useState(0);

  const [reputacao, setReputacao] = useState<ResumoReputacao>(
    resumoReputacaoPadrao()
  );

  async function carregar() {
    if (!user?.uid) return;

    setLoading(true);

    try {
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const userData = userSnap.data() as any;

        setData({
          ...userData,
          emailVerificado:
            auth.currentUser?.emailVerified ??
            userData?.emailVerificado ??
            false,
        });
      } else {
        setData(null);
      }

      try {
        const favRef = collection(db, "users", user.uid, "favoritas");
        const favSnap = await getDocs(favRef);

        const lista: Quadra[] = [];

        for (const d of favSnap.docs) {
          const quadraId = d.id;
          const quadraRef = doc(db, "quadras", quadraId);
          const quadraSnap = await getDoc(quadraRef);

          if (quadraSnap.exists()) {
            lista.push({
              id: quadraId,
              ...quadraSnap.data(),
            });
          }
        }

        setFavoritas(lista);
      } catch {
        setFavoritas([]);
      }

      try {
        const reservasRef = collection(db, "reservas");
        const qReservas = query(
          reservasRef,
          where("clienteUid", "==", user.uid),
          orderBy("data", "desc")
        );

        const reservasSnap = await getDocs(qReservas);

        const listaReservas: ReservaPerfil[] = [];

        for (const d of reservasSnap.docs) {
          const r = d.data() as any;

          let quadraNome = r.quadraNome;

          if (!quadraNome && r.quadraId) {
            try {
              const quadraSnap = await getDoc(doc(db, "quadras", r.quadraId));
              if (quadraSnap.exists()) {
                quadraNome = quadraSnap.data()?.nome;
              }
            } catch {
              // silencioso de propósito
            }
          }

          listaReservas.push({
            id: d.id,
            quadraId: String(r.quadraId ?? ""),
            quadraNome: quadraNome ? String(quadraNome) : undefined,
            esporte: r.esporte ? String(r.esporte) : undefined,
            data: r.data ? String(r.data) : undefined,
            horaInicio: r.horaInicio ? String(r.horaInicio) : undefined,
            horaFim: r.horaFim ? String(r.horaFim) : undefined,
            valor: Number(r.valor ?? 0),
            status: r.status ? String(r.status) : undefined,
          });
        }

        setHistorico(listaReservas.slice(0, 6));
      } catch {
        setHistorico([]);
      }
    } catch {
      setData(null);
      setFavoritas([]);
      setHistorico([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
  }, [user?.uid]);

  useEffect(() => {
    const uid = (user as any)?.uid;
    if (!uid) {
      setReputacao(resumoReputacaoPadrao());
      return;
    }

    const unsubscribe = ouvirResumoReputacaoDoUsuario(
      uid,
      (resumo) => {
        setReputacao(resumo);
      },
      () => {
        setReputacao(resumoReputacaoPadrao());
      }
    );

    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (cooldownVerificacao <= 0) return;

    const timer = window.setTimeout(() => {
      setCooldownVerificacao((tempoAtual) => tempoAtual - 1);
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [cooldownVerificacao]);

  async function handleReenviarVerificacao() {
    if (!auth.currentUser) {
      alert("Usuário não autenticado.");
      return;
    }

    if (auth.currentUser.emailVerified) {
      alert("Seu email já está verificado.");
      return;
    }

    if (reenviandoVerificacao || cooldownVerificacao > 0) {
      return;
    }

    try {
      setReenviandoVerificacao(true);

      const functions = getFunctions();
      const enviarEmailVerificacaoCustom = httpsCallable(
        functions,
        "enviarEmailVerificacaoCustom"
      );

      const res: any = await enviarEmailVerificacaoCustom({
        email: auth.currentUser.email,
        nome: data?.nome || "",
      });

      console.log("RESPOSTA FUNCTION:", res);

      const ok = Boolean(res?.data?.ok);
      if (!ok) {
        throw new Error("Falha ao enviar email de verificação.");
      }

      setCooldownVerificacao(60);
      alert("Email de verificação enviado com sucesso.");
    } catch (e: any) {
      console.error("Erro real:", e);

      if (e?.message) {
        alert(e.message);
      } else {
        alert("Falha ao enviar. Tente novamente.");
      }
    } finally {
      setReenviandoVerificacao(false);
    }
  }

  if (!user) return <p>Você precisa estar logado.</p>;
  if (loading) return <p>Carregando...</p>;

  const badgeStyle = getNivelColors(reputacao.score);
  const temPendencia =
    reputacao.cancelUltimaHora > 0 ||
    reputacao.noShows > 0 ||
    reputacao.multaPendenteCentavos > 0 ||
    reputacao.suspenso ||
    reputacao.score < 100;

  return (
    <>
      <Header />

      <div style={styles.page}>
        <div style={styles.container}>
          <div style={styles.profileHeader}>
            <h1 style={styles.title}>Meu Perfil</h1>

            <p style={styles.subtitle}>
              {data?.nome} {data?.sobrenome}
            </p>

            <div style={{ marginTop: 6 }}>
              <span style={styles.email}>{data?.email}</span>
            </div>
          </div>

          <div style={styles.card}>
            <div style={styles.sectionHead}>
              <div>
                <h2 style={styles.sectionTitle}>⚙️ Configurações da conta</h2>
                <p style={styles.helper}>
                  Gerencie seus dados de acesso e segurança do Quadra Play.
                </p>
              </div>
            </div>

            <div style={styles.configGrid}>
              <div style={styles.configBox}>
                <div style={styles.configLabel}>Email atual</div>
                <div style={styles.configValue}>{data?.email || "—"}</div>
              </div>

              <div style={styles.configBox}>
                <div style={styles.configLabel}>Status do email</div>
                <div style={styles.configValue}>
                  {data?.emailVerificado ? "Verificado" : "Não verificado"}
                </div>
              </div>
            </div>

            <div style={styles.configActions}>
              <button
                style={styles.configBtn}
                onClick={() => {
                  const novo = prompt("Digite o novo e-mail:");

                  if (!novo) return;

                  (async () => {
                    try {
                      if (!auth.currentUser) return;

                      await updateEmail(auth.currentUser, novo);

                      alert("Email atualizado! Verifique seu novo email.");
                    } catch (e: any) {
                      console.error(e);
                      alert(e?.message || "Erro ao atualizar email");
                    }
                  })();
                }}
              >
                Alterar e-mail
              </button>

              <button
                style={{
                  ...styles.configBtnSecondary,
                  opacity:
                    reenviandoVerificacao || cooldownVerificacao > 0 ? 0.65 : 1,
                  cursor:
                    reenviandoVerificacao || cooldownVerificacao > 0
                      ? "not-allowed"
                      : "pointer",
                }}
                onClick={handleReenviarVerificacao}
                disabled={reenviandoVerificacao || cooldownVerificacao > 0}
              >
                {reenviandoVerificacao
                  ? "Enviando..."
                  : cooldownVerificacao > 0
                  ? `Reenviar em ${cooldownVerificacao}s`
                  : "Reenviar verificação"}
              </button>

              <button style={styles.configBtnSecondary}>Trocar senha</button>
            </div>
          </div>

          <div style={styles.card}>
            <div style={styles.sectionHead}>
              <div>
                <h2 style={styles.sectionTitle}>🛡️ Reputação</h2>
                <p style={styles.helper}>
                  Seu histórico dentro do app influencia sua confiança e
                  experiência nas reservas.
                </p>
              </div>
            </div>

            <div style={styles.reputacaoTop}>
              <div>
                <div style={styles.reputacaoScore}>{reputacao.score}/100</div>
                <div style={styles.reputacaoHint}>
                  Pontuação atual da sua conta
                </div>
              </div>

              <div
                style={{
                  ...styles.reputacaoBadge,
                  background: badgeStyle.bg,
                  color: badgeStyle.text,
                  border: `1px solid ${badgeStyle.border}`,
                }}
              >
                {String(reputacao.nivel).toUpperCase()}
              </div>
            </div>

            <div style={styles.reputacaoGrid}>
              <div style={styles.reputacaoBox}>
                <div style={styles.reputacaoLabel}>
                  Cancelamentos última hora
                </div>
                <div style={styles.reputacaoValue}>
                  {reputacao.cancelUltimaHora}
                </div>
              </div>

              <div style={styles.reputacaoBox}>
                <div style={styles.reputacaoLabel}>No-shows</div>
                <div style={styles.reputacaoValue}>{reputacao.noShows}</div>
              </div>

              <div style={styles.reputacaoBox}>
                <div style={styles.reputacaoLabel}>Multa pendente</div>
                <div style={styles.reputacaoValue}>
                  {formatBRL((reputacao.multaPendenteCentavos ?? 0) / 100)}
                </div>
              </div>

              <div style={styles.reputacaoBox}>
                <div style={styles.reputacaoLabel}>Status da conta</div>
                <div
                  style={{
                    ...styles.reputacaoValue,
                    color: reputacao.suspenso ? "#b91c1c" : "#166534",
                  }}
                >
                  {reputacao.suspenso ? "Suspensa" : "Ativa"}
                </div>
              </div>
            </div>

            <div
              style={{
                ...styles.reputacaoNote,
                ...(temPendencia
                  ? styles.reputacaoNoteWarn
                  : styles.reputacaoNoteOk),
              }}
            >
              {temPendencia
                ? "Cancelamentos tardios e não comparecimentos reduzem sua reputação e podem gerar multa ou bloqueio."
                : "Seu histórico está excelente até agora. Continue assim para manter uma conta forte no app."}
            </div>
          </div>

          <div style={styles.card}>
            <div style={styles.sectionHead}>
              <div>
                <h2 style={styles.sectionTitle}>❤️ Quadras favoritas</h2>
                <p style={styles.helper}>
                  Suas quadras salvas para acesso rápido e reservas futuras.
                </p>
              </div>
            </div>

            {favoritas.length === 0 ? (
              <div style={styles.empty}>
                Você ainda não favoritou nenhuma quadra.
              </div>
            ) : (
              <div style={styles.grid}>
                {favoritas.map((q) => (
                  <div key={q.id} style={styles.quadraCard}>
                    <div style={styles.imageWrap}>
                      {q.fotoCapaUrl ? (
                        <img src={q.fotoCapaUrl} style={styles.image} />
                      ) : (
                        <div style={styles.noImage}>Sem imagem</div>
                      )}

                      <div style={styles.heart}>❤️</div>
                    </div>

                    <div style={styles.cardBody}>
                      <h3 style={styles.quadraNome}>{q.nome}</h3>

                      <p style={styles.quadraCidade}>{q.cidade}</p>

                      <p style={styles.quadraEndereco}>{q.endereco}</p>

                      <Link to={`/quadra/${q.id}`}>
                        <button style={styles.btn}>Abrir quadra</button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={styles.card}>
            <div style={styles.sectionHead}>
              <div>
                <h2 style={styles.sectionTitle}>📅 Histórico de reservas</h2>
                <p style={styles.helper}>
                  Suas reservas mais recentes para consulta rápida dentro do
                  perfil.
                </p>
              </div>
            </div>

            {historico.length === 0 ? (
              <div style={styles.empty}>
                Você ainda não possui reservas no histórico.
              </div>
            ) : (
              <div style={styles.historyList}>
                {historico.map((r) => {
                  const st = statusVisual(r.status);

                  return (
                    <div key={r.id} style={styles.historyCard}>
                      <div style={styles.historyTop}>
                        <div>
                          <div style={styles.historyTitle}>
                            {r.data || "—"} • {r.horaInicio || "--:--"}–
                            {r.horaFim || "--:--"}
                          </div>

                          <div style={styles.historySub}>
                            {r.quadraNome ?? r.quadraId}
                            {r.esporte ? ` • ${r.esporte}` : ""}
                          </div>
                        </div>

                        <span
                          style={{
                            ...styles.statusChip,
                            background: st.bg,
                            color: st.color,
                            border: `1px solid ${st.border}`,
                          }}
                        >
                          {st.text}
                        </span>
                      </div>

                      <div style={styles.historyBottom}>
                        <div style={styles.historyValue}>
                          {formatBRL(Number(r.valor ?? 0))}
                        </div>

                        <Link
                          to={`/quadra/${r.quadraId}`}
                          style={styles.historyLink}
                        >
                          Ver quadra
                        </Link>
                      </div>
                    </div>
                  );
                })}

                <Link
                  to="/minhas-reservas"
                  style={styles.fullHistoryLink}
                >
                  Ver histórico completo
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background:
      "linear-gradient(180deg, #f8fafc 0%, #eef4ff 45%, #f8fafc 100%)",
    paddingBottom: 40,
  },

  container: {
    maxWidth: 1100,
    margin: "0 auto",
    padding: "20px 16px",
  },

  profileHeader: {
    marginBottom: 20,
  },

  title: {
    fontSize: 32,
    fontWeight: 900,
    margin: 0,
  },

  subtitle: {
    margin: "8px 0 0",
    fontWeight: 700,
  },

  email: {
    color: "#64748b",
    fontSize: 14,
  },

  card: {
    background: "#fff",
    borderRadius: 24,
    border: "1px solid #e2e8f0",
    padding: 18,
    marginBottom: 18,
  },

  sectionHead: {
    marginBottom: 14,
  },

  sectionTitle: {
    margin: 0,
    fontSize: 20,
    fontWeight: 900,
  },

  helper: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.5,
  },

  reputacaoTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    flexWrap: "wrap" as const,
    marginBottom: 16,
  },

  reputacaoScore: {
    fontSize: 36,
    fontWeight: 900,
    color: "#0f172a",
    lineHeight: 1,
  },

  reputacaoHint: {
    marginTop: 6,
    fontSize: 13,
    color: "#64748b",
    fontWeight: 600,
  },

  reputacaoBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 40,
    padding: "0 14px",
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 900,
  },

  reputacaoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 12,
    marginBottom: 14,
  },

  reputacaoBox: {
    borderRadius: 18,
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    padding: 14,
  },

  reputacaoLabel: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: 800,
    textTransform: "uppercase" as const,
    letterSpacing: 0.4,
  },

  reputacaoValue: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: 900,
    color: "#0f172a",
    lineHeight: 1.3,
  },

  reputacaoNote: {
    borderRadius: 16,
    padding: 14,
    fontSize: 14,
    fontWeight: 700,
    lineHeight: 1.5,
  },

  reputacaoNoteOk: {
    background: "#ecfdf5",
    border: "1px solid #bbf7d0",
    color: "#166534",
  },

  reputacaoNoteWarn: {
    background: "#fff7ed",
    border: "1px solid #fdba74",
    color: "#9a3412",
  },

  empty: {
    textAlign: "center" as const,
    padding: 20,
    color: "#64748b",
  },

  grid: {
    display: "grid",
    gap: 16,
  },

  quadraCard: {
    border: "1px solid #e2e8f0",
    borderRadius: 20,
    overflow: "hidden",
  },

  imageWrap: {
    position: "relative" as const,
    height: 160,
    overflow: "hidden",
  },

  image: {
    width: "100%",
    height: "100%",
    objectFit: "cover" as const,
  },

  noImage: {
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f1f5f9",
  },

  heart: {
    position: "absolute" as const,
    top: 10,
    right: 10,
    background: "#fff",
    borderRadius: 999,
    padding: "6px 8px",
  },

  cardBody: {
    padding: 14,
  },

  quadraNome: {
    margin: 0,
    fontWeight: 900,
  },

  quadraCidade: {
    margin: "6px 0 0",
    color: "#64748b",
  },

  quadraEndereco: {
    margin: "4px 0 10px",
    fontSize: 13,
    color: "#64748b",
  },

  btn: {
    border: "none",
    borderRadius: 12,
    background: "#16a34a",
    color: "#fff",
    padding: "10px 14px",
    fontWeight: 800,
    cursor: "pointer",
  },

  historyList: {
    display: "grid",
    gap: 12,
  },

  historyCard: {
    borderRadius: 16,
    border: "1px solid #e2e8f0",
    background: "#fff",
    padding: 14,
    boxShadow: "0 8px 20px rgba(15,23,42,0.04)",
  },

  historyTop: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    flexWrap: "wrap" as const,
    marginBottom: 12,
  },

  historyTitle: {
    fontSize: 15,
    fontWeight: 900,
    color: "#0f172a",
    marginBottom: 4,
  },

  historySub: {
    fontSize: 13,
    color: "#64748b",
    lineHeight: 1.45,
  },

  statusChip: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "7px 10px",
    fontSize: 12,
    fontWeight: 800,
  },

  historyBottom: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap" as const,
  },

  historyValue: {
    fontSize: 14,
    fontWeight: 900,
    color: "#0f172a",
  },

  historyLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 36,
    padding: "0 12px",
    borderRadius: 12,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    color: "#0f172a",
    fontWeight: 800,
    fontSize: 13,
    textDecoration: "none",
  },

  fullHistoryLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    minHeight: 40,
    padding: "0 14px",
    borderRadius: 12,
    background: "linear-gradient(135deg, #0f172a, #1d4ed8)",
    color: "#fff",
    fontWeight: 900,
    fontSize: 13,
    textDecoration: "none",
    boxShadow: "0 10px 18px rgba(29,78,216,0.16)",
  },

  configGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
    marginBottom: 14,
  },

  configBox: {
    borderRadius: 18,
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    padding: 14,
  },

  configLabel: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: 800,
    textTransform: "uppercase" as const,
    letterSpacing: 0.4,
  },

  configValue: {
    marginTop: 8,
    fontSize: 15,
    fontWeight: 800,
    color: "#0f172a",
    lineHeight: 1.4,
  },

  configActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap" as const,
  },

  configBtn: {
    border: "none",
    borderRadius: 12,
    background: "#0f172a",
    color: "#fff",
    padding: "10px 14px",
    fontWeight: 800,
    cursor: "pointer",
  },

  configBtnSecondary: {
    border: "1px solid #cbd5e1",
    borderRadius: 12,
    background: "#fff",
    color: "#0f172a",
    padding: "10px 14px",
    fontWeight: 800,
    cursor: "pointer",
  },
};