import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../../services/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
} from "firebase/firestore";

type Role = "atleta" | "dono" | "ceo";

type Quadra = {
  id: string;
  nome?: string;
  cidade?: string;
  endereco?: string;
  ativo?: boolean;
  bloqueada?: boolean;
  ownerId?: string;
  ownerUid?: string;
};

type Reserva = {
  id: string;
  quadraId?: string;
  status?: string;
  valorTotalCentavos?: number;
  valorPlataformaCentavos?: number;
  clienteUid?: string;
  donoUid?: string;
  data?: string;
  horaInicio?: string;
  createdAt?: any;
  startAt?: any;
};

type UserDoc = {
  id: string;
  role?: Role;
  nome?: string;
  sobrenome?: string;
};

type DashboardStats = {
  totalQuadras: number;
  quadrasAtivas: number;
  quadrasBloqueadas: number;
  totalReservas: number;
  reservasFinalizadas: number;
  reservasCanceladas: number;
  reservasPendentes: number;
  totalUsuarios: number;
  totalAtletas: number;
  totalDonos: number;
  totalCeo: number;
  brutoTotalCentavos: number;
  plataformaTotalCentavos: number;
};

function normalizeRole(value: any): Role | null {
  if (!value) return null;
  const v = String(value).trim().toLowerCase();
  if (v === "atleta" || v === "dono" || v === "ceo") return v as Role;
  return null;
}

async function exigirCeo() {
  const user = auth.currentUser;
  if (!user) throw new Error("Você precisa estar logado.");

  const snap = await getDoc(doc(db, "users", user.uid));
  const role = normalizeRole(snap.exists() ? (snap.data() as any).role : null);

  if (role !== "ceo") {
    throw new Error("Acesso negado: somente CEO.");
  }

  return user.uid;
}

function centavosParaReais(valor?: number) {
  const n = Number(valor || 0) / 100;
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatarNome(user?: UserDoc) {
  const nome = String(user?.nome || "").trim();
  const sobrenome = String(user?.sobrenome || "").trim();
  return [nome, sobrenome].filter(Boolean).join(" ") || "Sem nome";
}

export default function CeoDashboard() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [quadras, setQuadras] = useState<Quadra[]>([]);
  const [reservasRecentes, setReservasRecentes] = useState<Reserva[]>([]);
  const [quadrasRecentes, setQuadrasRecentes] = useState<Quadra[]>([]);
  const [usuariosRecentes, setUsuariosRecentes] = useState<UserDoc[]>([]);

  const [stats, setStats] = useState<DashboardStats>({
    totalQuadras: 0,
    quadrasAtivas: 0,
    quadrasBloqueadas: 0,
    totalReservas: 0,
    reservasFinalizadas: 0,
    reservasCanceladas: 0,
    reservasPendentes: 0,
    totalUsuarios: 0,
    totalAtletas: 0,
    totalDonos: 0,
    totalCeo: 0,
    brutoTotalCentavos: 0,
    plataformaTotalCentavos: 0,
  });

  async function carregar() {
    setLoading(true);
    setErro(null);

    try {
      await exigirCeo();

      const [
        quadrasSnap,
        reservasSnap,
        usersSnap,
        quadrasRecentesSnap,
        reservasRecentesSnap,
      ] = await Promise.all([
        getDocs(collection(db, "quadras")),
        getDocs(collection(db, "reservas")),
        getDocs(collection(db, "users")),
        getDocs(query(collection(db, "quadras"), orderBy("nome", "asc"), limit(6))),
        getDocs(query(collection(db, "reservas"), orderBy("createdAt", "desc"), limit(8))),
      ]);

      const quadrasLista: Quadra[] = quadrasSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      }));

      const reservasLista: Reserva[] = reservasSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      }));

      const usersLista: UserDoc[] = usersSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      }));

      const quadrasRecentesLista: Quadra[] = quadrasRecentesSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      }));

      const reservasRecentesLista: Reserva[] = reservasRecentesSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      }));

      const totalQuadras = quadrasLista.length;
      const quadrasBloqueadas = quadrasLista.filter(
        (q) => q.bloqueada === true || q.ativo === false
      ).length;
      const quadrasAtivas = totalQuadras - quadrasBloqueadas;

      const totalReservas = reservasLista.length;
      const reservasFinalizadas = reservasLista.filter(
        (r) => r.status === "finalizada"
      ).length;
      const reservasCanceladas = reservasLista.filter(
        (r) => r.status === "cancelada"
      ).length;
      const reservasPendentes = reservasLista.filter((r) =>
        ["pendente", "confirmada", "ativa", "agendada"].includes(
          String(r.status || "").toLowerCase()
        )
      ).length;

      const totalUsuarios = usersLista.length;
      const totalAtletas = usersLista.filter((u) => normalizeRole(u.role) === "atleta").length;
      const totalDonos = usersLista.filter((u) => normalizeRole(u.role) === "dono").length;
      const totalCeo = usersLista.filter((u) => normalizeRole(u.role) === "ceo").length;

      const brutoTotalCentavos = reservasLista.reduce(
        (acc, r) => acc + Number(r.valorTotalCentavos || 0),
        0
      );
      const plataformaTotalCentavos = reservasLista.reduce(
        (acc, r) => acc + Number(r.valorPlataformaCentavos || 0),
        0
      );

      setStats({
        totalQuadras,
        quadrasAtivas,
        quadrasBloqueadas,
        totalReservas,
        reservasFinalizadas,
        reservasCanceladas,
        reservasPendentes,
        totalUsuarios,
        totalAtletas,
        totalDonos,
        totalCeo,
        brutoTotalCentavos,
        plataformaTotalCentavos,
      });

      setQuadras(quadrasLista);
      setQuadrasRecentes(quadrasRecentesLista);
      setReservasRecentes(reservasRecentesLista);
      setUsuariosRecentes(usersLista.slice(0, 6));
    } catch (e: any) {
      setErro(e?.message || "Erro ao carregar dashboard CEO.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  const taxaBloqueio = useMemo(() => {
    if (!stats.totalQuadras) return "0%";
    return `${Math.round((stats.quadrasBloqueadas / stats.totalQuadras) * 100)}%`;
  }, [stats]);

  const taxaFinalizacao = useMemo(() => {
    if (!stats.totalReservas) return "0%";
    return `${Math.round((stats.reservasFinalizadas / stats.totalReservas) * 100)}%`;
  }, [stats]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left, rgba(34,197,94,0.10), transparent 28%), radial-gradient(circle at top right, rgba(59,130,246,0.10), transparent 24%), linear-gradient(180deg, #f8fafc 0%, #eef6ff 100%)",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "20px 16px 40px" }}>
        <section
          style={{
            position: "relative",
            overflow: "hidden",
            borderRadius: 28,
            padding: 24,
            background:
              "linear-gradient(135deg, #020617 0%, #1e3a8a 58%, #16a34a 100%)",
            color: "#fff",
            boxShadow: "0 24px 70px rgba(15, 23, 42, 0.22)",
          }}
        >
          <div
            style={{
              position: "absolute",
              right: -50,
              top: -40,
              width: 180,
              height: 180,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.10)",
              filter: "blur(10px)",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: -30,
              bottom: -70,
              width: 210,
              height: 210,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.08)",
              filter: "blur(12px)",
            }}
          />

          <div style={{ position: "relative", zIndex: 1 }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 14px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.14)",
                border: "1px solid rgba(255,255,255,0.18)",
                fontSize: 12,
                fontWeight: 900,
                letterSpacing: 0.4,
              }}
            >
              CEO • VISÃO EXECUTIVA
            </div>

            <h1
              style={{
                margin: "14px 0 8px",
                fontSize: "clamp(28px, 4vw, 42px)",
                lineHeight: 1.05,
                fontWeight: 900,
              }}
            >
              Dashboard geral do Quadra Play
            </h1>

            <p
              style={{
                margin: 0,
                maxWidth: 760,
                color: "rgba(255,255,255,0.92)",
                lineHeight: 1.65,
                fontSize: 15,
              }}
            >
              Acompanhe a operação da plataforma com visão centralizada de quadras,
              reservas, usuários e indicadores financeiros estimados.
            </p>

            <div
              style={{
                marginTop: 18,
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <button
                onClick={() => navigate(-1)}
                style={{
                  padding: "11px 14px",
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.18)",
                  background: "rgba(255,255,255,0.10)",
                  color: "#fff",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                ← Voltar
              </button>

              <button
                onClick={() => navigate("/ceo/quadras")}
                style={{
                  padding: "11px 14px",
                  borderRadius: 14,
                  border: "none",
                  background: "#fff",
                  color: "#0f172a",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                Ver quadras
              </button>

              <button
                onClick={carregar}
                style={{
                  padding: "11px 14px",
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.18)",
                  background: "#16a34a",
                  color: "#fff",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                Atualizar painel
              </button>
            </div>
          </div>
        </section>

        {loading && (
          <div
            style={{
              marginTop: 18,
              padding: 16,
              borderRadius: 18,
              border: "1px solid #e2e8f0",
              background: "#fff",
              color: "#475569",
              fontWeight: 800,
            }}
          >
            Carregando dashboard CEO...
          </div>
        )}

        {erro && !loading && (
          <div
            style={{
              marginTop: 18,
              padding: 16,
              borderRadius: 18,
              border: "1px solid #fecaca",
              background: "#fff1f2",
              color: "#b91c1c",
              fontWeight: 800,
            }}
          >
            {erro}
          </div>
        )}

        {!loading && !erro && (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 16,
                marginTop: 18,
              }}
            >
              <StatCard
                title="Quadras"
                value={String(stats.totalQuadras)}
                subtitle={`${stats.quadrasAtivas} ativas • ${stats.quadrasBloqueadas} bloqueadas`}
              />
              <StatCard
                title="Reservas"
                value={String(stats.totalReservas)}
                subtitle={`${stats.reservasFinalizadas} finalizadas • ${stats.reservasCanceladas} canceladas`}
              />
              <StatCard
                title="Usuários"
                value={String(stats.totalUsuarios)}
                subtitle={`${stats.totalAtletas} atletas • ${stats.totalDonos} donos`}
              />
              <StatCard
                title="Receita bruta"
                value={centavosParaReais(stats.brutoTotalCentavos)}
                subtitle="Somatório das reservas"
              />
              <StatCard
                title="Receita plataforma"
                value={centavosParaReais(stats.plataformaTotalCentavos)}
                subtitle="Estimativa de comissão acumulada"
              />
              <StatCard
                title="Taxa de finalização"
                value={taxaFinalizacao}
                subtitle={`${stats.reservasPendentes} reservas ainda em aberto`}
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.1fr 0.9fr",
                gap: 18,
                marginTop: 18,
              }}
            >
              <section
                style={{
                  background: "#fff",
                  borderRadius: 24,
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 14px 34px rgba(15, 23, 42, 0.06)",
                  padding: 20,
                }}
              >
                <h2
                  style={{
                    margin: 0,
                    fontSize: 22,
                    fontWeight: 900,
                    color: "#0f172a",
                  }}
                >
                  Indicadores operacionais
                </h2>

                <p
                  style={{
                    margin: "8px 0 0",
                    color: "#64748b",
                    fontSize: 14,
                    lineHeight: 1.6,
                  }}
                >
                  Visão rápida da saúde da operação e da composição atual do ecossistema.
                </p>

                <div
                  style={{
                    display: "grid",
                    gap: 12,
                    marginTop: 16,
                  }}
                >
                  <InfoRow
                    label="Quadras ativas"
                    value={`${stats.quadrasAtivas} de ${stats.totalQuadras}`}
                    tone="green"
                  />
                  <InfoRow
                    label="Quadras bloqueadas"
                    value={`${stats.quadrasBloqueadas} (${taxaBloqueio})`}
                    tone="dark"
                  />
                  <InfoRow
                    label="Reservas finalizadas"
                    value={`${stats.reservasFinalizadas} de ${stats.totalReservas}`}
                    tone="blue"
                  />
                  <InfoRow
                    label="Reservas canceladas"
                    value={String(stats.reservasCanceladas)}
                    tone="orange"
                  />
                  <InfoRow
                    label="Usuários atletas"
                    value={String(stats.totalAtletas)}
                    tone="green"
                  />
                  <InfoRow
                    label="Usuários donos"
                    value={String(stats.totalDonos)}
                    tone="blue"
                  />
                  <InfoRow
                    label="Usuários CEO"
                    value={String(stats.totalCeo)}
                    tone="dark"
                  />
                </div>
              </section>

              <section
                style={{
                  display: "grid",
                  gap: 18,
                }}
              >
                <PanelCard
                  title="Resumo financeiro"
                  description="Valores estimados com base nas reservas registradas."
                >
                  <MiniInfo label="Bruto total" value={centavosParaReais(stats.brutoTotalCentavos)} />
                  <MiniInfo
                    label="Plataforma total"
                    value={centavosParaReais(stats.plataformaTotalCentavos)}
                  />
                  <MiniInfo
                    label="Ticket médio bruto"
                    value={
                      stats.totalReservas > 0
                        ? centavosParaReais(
                            Math.round(stats.brutoTotalCentavos / stats.totalReservas)
                          )
                        : "R$ 0,00"
                    }
                  />
                </PanelCard>

                <PanelCard
                  title="Usuários recentes"
                  description="Amostra rápida de documentos de usuários."
                >
                  {usuariosRecentes.length === 0 ? (
                    <EmptyText text="Nenhum usuário encontrado." />
                  ) : (
                    <div style={{ display: "grid", gap: 10 }}>
                      {usuariosRecentes.map((u) => (
                        <SimpleRow
                          key={u.id}
                          title={formatarNome(u)}
                          subtitle={`Role: ${u.role || "—"}`}
                        />
                      ))}
                    </div>
                  )}
                </PanelCard>
              </section>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 18,
                marginTop: 18,
              }}
            >
              <PanelCard
                title="Últimas quadras"
                description="Amostra de quadras registradas na plataforma."
              >
                {quadrasRecentes.length === 0 ? (
                  <EmptyText text="Nenhuma quadra encontrada." />
                ) : (
                  <div style={{ display: "grid", gap: 10 }}>
                    {quadrasRecentes.map((q) => {
                      const bloqueada = q.bloqueada === true || q.ativo === false;
                      return (
                        <div
                          key={q.id}
                          style={{
                            borderRadius: 16,
                            border: "1px solid #e2e8f0",
                            background: "#fff",
                            padding: 14,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              gap: 10,
                              alignItems: "center",
                            }}
                          >
                            <div style={{ minWidth: 0 }}>
                              <div
                                style={{
                                  fontWeight: 900,
                                  color: "#0f172a",
                                  fontSize: 15,
                                }}
                              >
                                {q.nome || "(Sem nome)"}
                              </div>

                              <div
                                style={{
                                  marginTop: 4,
                                  color: "#64748b",
                                  fontSize: 13,
                                }}
                              >
                                {q.cidade || "Sem cidade"}
                                {q.endereco ? ` • ${q.endereco}` : ""}
                              </div>
                            </div>

                            <span
                              style={{
                                padding: "6px 10px",
                                borderRadius: 999,
                                fontSize: 12,
                                fontWeight: 900,
                                background: bloqueada ? "#111827" : "#ecfdf5",
                                color: bloqueada ? "#fff" : "#166534",
                                border: bloqueada ? "none" : "1px solid #bbf7d0",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {bloqueada ? "BLOQUEADA" : "ATIVA"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </PanelCard>

              <PanelCard
                title="Últimas reservas"
                description="Amostra das reservas mais recentes registradas."
              >
                {reservasRecentes.length === 0 ? (
                  <EmptyText text="Nenhuma reserva encontrada." />
                ) : (
                  <div style={{ display: "grid", gap: 10 }}>
                    {reservasRecentes.map((r) => (
                      <div
                        key={r.id}
                        style={{
                          borderRadius: 16,
                          border: "1px solid #e2e8f0",
                          background: "#fff",
                          padding: 14,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 10,
                            alignItems: "center",
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                fontWeight: 900,
                                color: "#0f172a",
                                fontSize: 15,
                              }}
                            >
                              Reserva {r.id.slice(0, 8)}...
                            </div>

                            <div
                              style={{
                                marginTop: 4,
                                color: "#64748b",
                                fontSize: 13,
                              }}
                            >
                              Quadra: {r.quadraId || "—"}
                            </div>

                            <div
                              style={{
                                marginTop: 4,
                                color: "#64748b",
                                fontSize: 13,
                              }}
                            >
                              Valor: {centavosParaReais(r.valorTotalCentavos || 0)}
                            </div>
                          </div>

                          <span
                            style={{
                              padding: "6px 10px",
                              borderRadius: 999,
                              fontSize: 12,
                              fontWeight: 900,
                              background:
                                r.status === "finalizada"
                                  ? "#ecfdf5"
                                  : r.status === "cancelada"
                                  ? "#fff7ed"
                                  : "#eff6ff",
                              color:
                                r.status === "finalizada"
                                  ? "#166534"
                                  : r.status === "cancelada"
                                  ? "#c2410c"
                                  : "#1d4ed8",
                              border: "1px solid #e2e8f0",
                              whiteSpace: "nowrap",
                              textTransform: "uppercase",
                            }}
                          >
                            {r.status || "—"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </PanelCard>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: string;
  subtitle: string;
}) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 22,
        border: "1px solid #e2e8f0",
        boxShadow: "0 14px 34px rgba(15, 23, 42, 0.06)",
        padding: 18,
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 900,
          color: "#64748b",
          textTransform: "uppercase",
          letterSpacing: 0.35,
        }}
      >
        {title}
      </div>

      <div
        style={{
          marginTop: 8,
          fontSize: 28,
          fontWeight: 900,
          color: "#0f172a",
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>

      <div
        style={{
          marginTop: 8,
          fontSize: 13,
          color: "#64748b",
          lineHeight: 1.55,
          fontWeight: 700,
        }}
      >
        {subtitle}
      </div>
    </div>
  );
}

function PanelCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        background: "#fff",
        borderRadius: 24,
        border: "1px solid #e2e8f0",
        boxShadow: "0 14px 34px rgba(15, 23, 42, 0.06)",
        padding: 20,
      }}
    >
      <h3
        style={{
          margin: 0,
          fontSize: 20,
          fontWeight: 900,
          color: "#0f172a",
        }}
      >
        {title}
      </h3>

      <p
        style={{
          margin: "8px 0 0",
          color: "#64748b",
          fontSize: 14,
          lineHeight: 1.6,
        }}
      >
        {description}
      </p>

      <div style={{ marginTop: 16 }}>{children}</div>
    </section>
  );
}

function MiniInfo({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        borderRadius: 16,
        border: "1px solid #e2e8f0",
        background: "#f8fafc",
        padding: 14,
        marginBottom: 10,
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 900,
          color: "#64748b",
          textTransform: "uppercase",
          letterSpacing: 0.35,
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 6,
          fontSize: 18,
          fontWeight: 900,
          color: "#0f172a",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "green" | "blue" | "orange" | "dark";
}) {
  const bg =
    tone === "green"
      ? "#ecfdf5"
      : tone === "blue"
      ? "#eff6ff"
      : tone === "orange"
      ? "#fff7ed"
      : "#f8fafc";

  const color =
    tone === "green"
      ? "#166534"
      : tone === "blue"
      ? "#1d4ed8"
      : tone === "orange"
      ? "#c2410c"
      : "#0f172a";

  return (
    <div
      style={{
        borderRadius: 16,
        border: "1px solid #e2e8f0",
        background: bg,
        padding: 14,
        display: "flex",
        justifyContent: "space-between",
        gap: 14,
        alignItems: "center",
      }}
    >
      <span
        style={{
          color: "#334155",
          fontSize: 14,
          fontWeight: 800,
        }}
      >
        {label}
      </span>

      <span
        style={{
          color,
          fontSize: 14,
          fontWeight: 900,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function SimpleRow({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div
      style={{
        borderRadius: 16,
        border: "1px solid #e2e8f0",
        background: "#f8fafc",
        padding: 14,
      }}
    >
      <div
        style={{
          fontSize: 14,
          fontWeight: 900,
          color: "#0f172a",
        }}
      >
        {title}
      </div>

      <div
        style={{
          marginTop: 4,
          fontSize: 13,
          color: "#64748b",
        }}
      >
        {subtitle}
      </div>
    </div>
  );
}

function EmptyText({ text }: { text: string }) {
  return (
    <div
      style={{
        borderRadius: 16,
        border: "1px dashed #cbd5e1",
        background: "#fff",
        padding: 18,
        color: "#64748b",
        fontWeight: 700,
      }}
    >
      {text}
    </div>
  );
}