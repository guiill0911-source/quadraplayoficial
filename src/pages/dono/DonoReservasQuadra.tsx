import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Header from "../../components/Header";
import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "../../services/firebase";
import { cancelarReserva } from "../../services/reservas";

type Reserva = {
  id: string;
  quadraId: string;
  esporte: string;
  data: string;
  horaInicio: string;
  horaFim: string;
  valor: number;
  status?: string;

  cliente?: {
    nome?: string;
    telefone?: string | null;
  };

  // ✅ no-show (novo)
  noShow?: boolean;
  noShowEm?: any;
  noShowPorUid?: string | null;
};

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

export default function DonoReservasQuadra() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [msg, setMsg] = useState<string>("");

  const [cancelandoId, setCancelandoId] = useState<string>("");
  const [bloqueandoId, setBloqueandoId] = useState<string>("");
  const [marcandoNoShowId, setMarcandoNoShowId] = useState<string>("");

  const [dataFiltro, setDataFiltro] = useState("");

  async function carregar() {
    if (!id) return;

    setLoading(true);
    setErro(null);
    setMsg("");

    try {
      const col = collection(db, "reservas");
      const q = query(col, where("quadraId", "==", id));
      const snap = await getDocs(q);

      const lista: Reserva[] = [];
      snap.forEach((d) => lista.push({ id: d.id, ...(d.data() as any) }));
      setReservas(lista);
    } catch (e) {
      console.error(e);
      setErro("Erro ao carregar reservas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
  }, [id]);

  const reservasFiltradas = useMemo(() => {
    let lista = reservas.slice();

    if (dataFiltro) {
      lista = lista.filter((r) => r.data === dataFiltro);
    }

    lista.sort((a, b) =>
      `${a.data} ${a.horaInicio}`.localeCompare(`${b.data} ${b.horaInicio}`)
    );

    return lista;
  }, [reservas, dataFiltro]);

  /* =============================
     CANCELAR NORMAL
  ============================= */

  async function onCancelar(r: Reserva) {
    setErro(null);
    setMsg("");

    if (r.status !== "confirmada") return;
    if (r.noShow === true) {
      alert("Esta reserva já está marcada como NÃO COMPARECEU. (MVP: não vamos cancelar depois disso.)");
      return;
    }

    const ok = window.confirm(
      `Cancelar reserva?\n\n${r.data} ${r.horaInicio}–${r.horaFim}`
    );
    if (!ok) return;

    try {
      setCancelandoId(r.id);

      await cancelarReserva({
        reservaId: r.id,
        bypassClienteUidCheck: true,
      });

      setReservas((prev) =>
        prev.map((x) =>
          x.id === r.id ? { ...x, status: "cancelada" } : x
        )
      );

      setMsg("Reserva cancelada e horário liberado.");
    } catch (e: any) {
      setErro(e?.message ?? "Erro ao cancelar.");
    } finally {
      setCancelandoId("");
    }
  }

  /* =============================
     CANCELAR + BLOQUEAR
  ============================= */

  async function buscarDisponibilidadeId(r: Reserva) {
    const col = collection(db, "disponibilidades");

    const q = query(
      col,
      where("quadraId", "==", r.quadraId),
      where("data", "==", r.data),
      where("horaInicio", "==", r.horaInicio),
      where("horaFim", "==", r.horaFim),
      limit(1)
    );

    const snap = await getDocs(q);
    if (snap.empty) return "";

    return snap.docs[0].id;
  }

  async function onCancelarEBloquear(r: Reserva) {
    setErro(null);
    setMsg("");

    if (r.status !== "confirmada") return;
    if (r.noShow === true) {
      alert("Esta reserva já está marcada como NÃO COMPARECEU. (MVP: não vamos cancelar/bloquear depois disso.)");
      return;
    }

    const ok = window.confirm(
      `Cancelar E BLOQUEAR horário?\n\n${r.data} ${r.horaInicio}–${r.horaFim}`
    );
    if (!ok) return;

    try {
      setBloqueandoId(r.id);

      const uid = getAuth().currentUser?.uid;
      if (!uid) throw new Error("Usuário não autenticado.");

      const dispId = await buscarDisponibilidadeId(r);
      if (!dispId) throw new Error("Slot não encontrado.");

      await cancelarReserva({
        reservaId: r.id,
        bypassClienteUidCheck: true,
      });

      await updateDoc(doc(db, "disponibilidades", dispId), {
        ativo: false,
        bloqueado: true,
        bloqueadoPorUid: uid,
        reservadoPorUid: null,
        bloqueadoEm: serverTimestamp(),
      });

      setReservas((prev) =>
        prev.map((x) =>
          x.id === r.id ? { ...x, status: "cancelada" } : x
        )
      );

      setMsg("Reserva cancelada e horário bloqueado.");
    } catch (e: any) {
      setErro(e?.message ?? "Erro ao bloquear.");
    } finally {
      setBloqueandoId("");
    }
  }

  /* =============================
     ✅ MARCAR NÃO COMPARECEU (NO-SHOW)
  ============================= */

  async function onMarcarNoShow(r: Reserva) {
    setErro(null);
    setMsg("");

    if (r.status !== "confirmada") {
      alert("Só dá pra marcar NÃO COMPARECEU em reservas confirmadas.");
      return;
    }

    if (r.noShow === true) {
      alert("Esta reserva já está marcada como NÃO COMPARECEU.");
      return;
    }

    const ok = window.confirm(
      `Marcar como NÃO COMPARECEU?\n\n` +
        `${r.data} ${r.horaInicio}–${r.horaFim}\n` +
        `Cliente: ${r.cliente?.nome ?? "—"}\n\n` +
        `Atenção: isso bloqueia a avaliação desse jogo (MVP).`
    );
    if (!ok) return;

    try {
      setMarcandoNoShowId(r.id);

      const uid = getAuth().currentUser?.uid;
      if (!uid) throw new Error("Usuário não autenticado.");

      await updateDoc(doc(db, "reservas", r.id), {
        noShow: true,
        noShowEm: serverTimestamp(),
        noShowPorUid: uid,
      });

      setReservas((prev) =>
        prev.map((x) => (x.id === r.id ? { ...x, noShow: true, noShowPorUid: uid } : x))
      );

      setMsg("Marcado como NÃO COMPARECEU ✅");
    } catch (e: any) {
      console.error(e);
      setErro(e?.message ?? "Erro ao marcar não compareceu.");
    } finally {
      setMarcandoNoShowId("");
    }
  }

  /* =============================
     CONTADORES
  ============================= */

  const ativas = reservasFiltradas.filter((r) => r.status === "confirmada").length;
  const canceladas = reservasFiltradas.filter((r) => r.status === "cancelada").length;
  const noShows = reservasFiltradas.filter((r) => r.noShow === true).length;

  /* =============================
     RENDER
  ============================= */

  return (
    <>
      <Header />

      <div style={{ padding: 16 }}>
        <Link to="/dono">
          <button>← Voltar</button>
        </Link>

        <h1>Reservas desta quadra (gestão do dono)</h1>

        <div style={{ marginTop: 8, display: "flex", gap: 14, flexWrap: "wrap" }}>
          <div>
            Reservas ativas: <strong style={{ color: "green" }}>{ativas}</strong>
          </div>
          <div>
            Canceladas: <strong style={{ color: "crimson" }}>{canceladas}</strong>
          </div>
          <div>
            No-show: <strong style={{ color: "#b36b00" }}>{noShows}</strong>
          </div>
        </div>

        <hr />

        <input
          type="date"
          value={dataFiltro}
          onChange={(e) => setDataFiltro(e.target.value)}
        />

        {erro && <p style={{ color: "crimson", whiteSpace: "pre-line" }}>{erro}</p>}
        {msg && !erro && <p style={{ color: "green" }}>{msg}</p>}

        <div style={{ display: "grid", gap: 10 }}>
          {reservasFiltradas.map((r) => {
            const podeAcoes = r.status === "confirmada";
            const travado =
              cancelandoId === r.id ||
              bloqueandoId === r.id ||
              marcandoNoShowId === r.id;

            return (
              <div
                key={r.id}
                style={{
                  border: "1px solid #ddd",
                  padding: 10,
                  borderRadius: 8,
                }}
              >
                <strong>
                  {r.data} — {r.horaInicio} → {r.horaFim}
                </strong>

                <div style={{ marginTop: 4 }}>
                  {ESPORTES_LABELS[r.esporte] ?? r.esporte}
                </div>

                <div style={{ marginTop: 2 }}>{formatBRL(r.valor)}</div>

                <div style={{ marginTop: 4 }}>
                  Status: <strong>{r.status ?? "—"}</strong>
                  {r.noShow ? (
                    <span style={{ marginLeft: 10, color: "#b36b00", fontWeight: 800 }}>
                      ⚠️ No-show
                    </span>
                  ) : null}
                </div>

                <div style={{ marginTop: 6, fontSize: 12, color: "#666" }}>
                  Cliente: <strong>{r.cliente?.nome ?? "—"}</strong>
                  {r.cliente?.telefone ? ` • ${r.cliente.telefone}` : ""}
                </div>

                {podeAcoes && (
                  <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                    <button onClick={() => onCancelar(r)} disabled={travado || r.noShow === true}>
                      {cancelandoId === r.id ? "Cancelando..." : "Cancelar (liberar)"}
                    </button>

                    <button onClick={() => onCancelarEBloquear(r)} disabled={travado || r.noShow === true}>
                      {bloqueandoId === r.id ? "Bloqueando..." : "Cancelar e bloquear"}
                    </button>

                    <button
                      onClick={() => onMarcarNoShow(r)}
                      disabled={travado || r.noShow === true}
                      style={{
                        border: "1px solid #b36b00",
                        background: "#fff7e6",
                      }}
                    >
                      {marcandoNoShowId === r.id ? "Marcando..." : "Marcar não compareceu"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {!loading && !erro && reservasFiltradas.length === 0 && (
            <div style={{ border: "1px dashed #ccc", borderRadius: 12, padding: 12 }}>
              <p style={{ margin: 0 }}>Nenhuma reserva encontrada para esta quadra.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
