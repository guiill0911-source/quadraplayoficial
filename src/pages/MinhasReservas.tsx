// src/pages/MinhasReservas.tsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../services/firebase";
import { type ReservaDoc, buscarReservasDoUsuario } from "../services/minhasReservas";
import { cancelarReserva } from "../services/reservas";
import { useAuth } from "../services/authContext";

const ESPORTES_LABELS: Record<string, string> = {
  futsal: "Futsal",
  society_5: "Society 5",
  society_7: "Society 7",
  volei: "Vôlei",
  futevolei: "Futevôlei",
  futmesa: "Futmesa",
  beach_tenis: "Beach Tênis",
};

function formatBRL(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function MinhasReservas() {
  const { user, loading: loadingAuth } = useAuth();

  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  const [reservas, setReservas] = useState<ReservaDoc[]>([]);
  const [msg, setMsg] = useState("");

  const [cancelandoId, setCancelandoId] = useState<string>("");

  // cache de nomes das quadras
  const [quadraNomeCache, setQuadraNomeCache] = useState<Record<string, string>>({});

  async function carregarNomesQuadras(quadraIds: string[]) {
    const idsUnicos = Array.from(new Set(quadraIds)).filter(Boolean);

    const faltando = idsUnicos.filter((id) => !quadraNomeCache[id]);
    if (faltando.length === 0) return;

    const novos: Record<string, string> = {};
    for (const qid of faltando) {
      try {
        const snap = await getDoc(doc(db, "quadras", qid));
        if (snap.exists()) {
          const data = snap.data() as any;
          novos[qid] = String(data.nome ?? qid);
        } else {
          novos[qid] = qid;
        }
      } catch {
        novos[qid] = qid;
      }
    }

    setQuadraNomeCache((prev) => ({ ...prev, ...novos }));
  }

  async function carregarReservas() {
    setErro("");
    setMsg("");
    setReservas([]);

    const uid = user?.uid;
    if (!uid) {
      setErro("Você precisa estar logado para ver suas reservas.");
      return;
    }

    setLoading(true);
    try {
      const res = await buscarReservasDoUsuario(uid);
      setReservas(res);

      if (res.length === 0) {
        setMsg("Você ainda não tem reservas.");
      } else {
        setMsg(`${res.length} reserva(s) encontrada(s).`);
        await carregarNomesQuadras(res.map((r) => r.quadraId));
      }
    } catch (e: any) {
      setErro(e?.message ?? "Erro ao buscar reservas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (loadingAuth) return;
    carregarReservas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingAuth, user?.uid]);

  async function onCancelar(r: ReservaDoc) {
    setErro("");
    setMsg("");

    if (!r.id) return;

    if (r.status !== "confirmada") {
      alert("Só é possível cancelar reservas confirmadas.");
      return;
    }

    const ok = window.confirm(
      `Cancelar esta reserva?\n\n` +
        `Data: ${r.data}\n` +
        `Horário: ${r.horaInicio}–${r.horaFim}\n` +
        `Quadra: ${quadraNomeCache[r.quadraId] ?? r.quadraId}\n` +
        `Esporte: ${ESPORTES_LABELS[r.esporte] ?? r.esporte}\n` +
        `Valor: ${formatBRL(Number(r.valor ?? 0))}`
    );
    if (!ok) return;

    try {
      setCancelandoId(r.id);
      await cancelarReserva({ reservaId: r.id }); // ✅ agora sem bypass

      setReservas((prev) =>
        prev.map((x) => (x.id === r.id ? ({ ...x, status: "cancelada" } as any) : x))
      );

      setMsg("Reserva cancelada e horário liberado!");
    } catch (e: any) {
      console.error(e);
      setErro(e?.message ?? "Erro ao cancelar reserva.");
    } finally {
      setCancelandoId("");
    }
  }

  const total = useMemo(() => {
    return reservas.reduce((acc, r) => acc + Number(r.valor ?? 0), 0);
  }, [reservas]);

  return (
    <div style={{ padding: 16, maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <h1 style={{ margin: 0 }}>Minhas Reservas</h1>
        <Link to="/">← Voltar</Link>
      </div>

      <div style={{ marginTop: 12, border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <strong>Usuário:</strong> {user?.email ?? "—"}
          </div>
          <button onClick={carregarReservas} disabled={loading || loadingAuth}>
            {loading ? "Atualizando..." : "Atualizar"}
          </button>
        </div>

        {erro ? <p style={{ color: "crimson", marginTop: 10 }}>{erro}</p> : null}
        {msg ? <p style={{ color: erro ? "crimson" : "#333", marginTop: 10 }}>{msg}</p> : null}
      </div>

      {reservas.length > 0 ? (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <strong>Lista de reservas</strong>
            <div>
              <strong>Total:</strong> {formatBRL(total)}
            </div>
          </div>

          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            {reservas.map((r) => {
              const podeCancelar = r.status === "confirmada";
              const estaCancelando = cancelandoId === r.id;

              return (
                <div
                  key={r.id}
                  style={{
                    border: "1px solid #eee",
                    borderRadius: 12,
                    padding: 12,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ minWidth: 260 }}>
                    <div style={{ fontWeight: 800 }}>
                      {r.data} • {r.horaInicio}–{r.horaFim}
                    </div>
                    <div style={{ opacity: 0.85 }}>
                      <strong>Quadra:</strong> {quadraNomeCache[r.quadraId] ?? r.quadraId}
                    </div>
                    <div style={{ opacity: 0.85 }}>
                      <strong>Esporte:</strong> {ESPORTES_LABELS[r.esporte] ?? r.esporte}
                    </div>
                  </div>

                  <div style={{ textAlign: "right", minWidth: 220 }}>
                    <div style={{ fontWeight: 800 }}>{formatBRL(Number(r.valor ?? 0))}</div>
                    <div style={{ fontSize: 13, opacity: 0.75 }}>Status: {r.status || "—"}</div>

                    {podeCancelar ? (
                      <button
                        onClick={() => onCancelar(r)}
                        disabled={estaCancelando}
                        style={{
                          marginTop: 8,
                          padding: "8px 10px",
                          borderRadius: 10,
                          border: "1px solid #b00020",
                          background: estaCancelando ? "#eee" : "#b00020",
                          color: estaCancelando ? "#333" : "#fff",
                          cursor: estaCancelando ? "not-allowed" : "pointer",
                        }}
                      >
                        {estaCancelando ? "Cancelando..." : "Cancelar"}
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
