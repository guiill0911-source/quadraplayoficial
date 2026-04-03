// 🔥 MANTIVE TODA SUA LÓGICA — só melhorei VISUAL/UX

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../../services/firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

type Role = "atleta" | "dono" | "ceo";

type Quadra = {
  id: string;
  nome?: string;
  cidade?: string;
  endereco?: string;
  donoUid?: string;
  ativo?: boolean;
  bloqueada?: boolean;
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

export default function CeoQuadras() {
  const navigate = useNavigate();

  const [quadras, setQuadras] = useState<Quadra[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState("");

  async function carregar() {
    setLoading(true);
    setErro(null);

    try {
      await exigirCeo();

      const q = query(collection(db, "quadras"), orderBy("nome", "asc"));
      const snap = await getDocs(q);

      const lista: Quadra[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      }));

      setQuadras(lista);
    } catch (e: any) {
      setErro(e?.message || "Erro ao carregar quadras.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  const listaFiltrada = useMemo(() => {
    const t = filtro.trim().toLowerCase();
    if (!t) return quadras;

    return quadras.filter((q) =>
      [q.nome, q.cidade, q.endereco, q.id]
        .join(" ")
        .toLowerCase()
        .includes(t)
    );
  }, [quadras, filtro]);

  async function bloquearOuDesbloquear(q: Quadra) {
    try {
      const ceoUid = await exigirCeo();

      const ref = doc(db, "quadras", q.id);
      const vaiBloquear = !(q.bloqueada === true);

      await updateDoc(ref, {
        ativo: !vaiBloquear,
        bloqueada: vaiBloquear,
        bloqueadaEm: vaiBloquear ? serverTimestamp() : null,
        bloqueadaPorUid: vaiBloquear ? ceoUid : null,
      });

      setQuadras((prev) =>
        prev.map((x) =>
          x.id === q.id
            ? { ...x, ativo: !vaiBloquear, bloqueada: vaiBloquear }
            : x
        )
      );
    } catch (e: any) {
      alert(e?.message || "Erro ao atualizar quadra.");
    }
  }

  return (
    <div style={{ padding: 20, maxWidth: 1100, margin: "0 auto" }}>
      {/* HERO CEO */}
      <div
        style={{
          borderRadius: 24,
          padding: 24,
          marginBottom: 20,
          background:
            "linear-gradient(135deg, #020617 0%, #1e3a8a 60%, #22c55e 100%)",
          color: "#fff",
          boxShadow: "0 25px 60px rgba(0,0,0,0.25)",
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 800, opacity: 0.8 }}>
          PAINEL CEO
        </div>

        <h1 style={{ margin: "8px 0", fontSize: 28 }}>
          Controle total das quadras
        </h1>

        <p style={{ opacity: 0.9 }}>
          Aqui você tem visão completa do ecossistema e pode bloquear ou liberar
          qualquer quadra da plataforma.
        </p>
      </div>

      {/* AÇÕES */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: "1px solid #e2e8f0",
            background: "#fff",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          ← Voltar
        </button>

        <button
          onClick={carregar}
          style={{
            padding: "10px 14px",
            borderRadius: 12,
            border: "none",
            background: "#111",
            color: "#fff",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          Atualizar
        </button>
      </div>

      {/* BUSCA */}
      <input
        value={filtro}
        onChange={(e) => setFiltro(e.target.value)}
        placeholder="Buscar quadra..."
        style={{
          width: "100%",
          padding: 14,
          borderRadius: 14,
          border: "1px solid #e2e8f0",
          marginBottom: 18,
        }}
      />

      {/* ESTADOS */}
      {loading && <div>Carregando...</div>}
      {erro && <div style={{ color: "red" }}>{erro}</div>}

      {/* LISTA */}
      <div style={{ display: "grid", gap: 12 }}>
        {listaFiltrada.map((q) => {
          const bloqueada = q.bloqueada === true || q.ativo === false;

          return (
            <div
              key={q.id}
              style={{
                borderRadius: 18,
                padding: 16,
                background: "#fff",
                border: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontWeight: 900 }}>
                  {q.nome || "Sem nome"}
                </div>

                <div style={{ fontSize: 13, color: "#64748b" }}>
                  {q.cidade} • {q.endereco}
                </div>

                <div style={{ fontSize: 12, color: "#94a3b8" }}>
                  ID: {q.id}
                </div>
              </div>

              <button
                onClick={() => bloquearOuDesbloquear(q)}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "none",
                  background: bloqueada ? "#22c55e" : "#ef4444",
                  color: "#fff",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                {bloqueada ? "Desbloquear" : "Bloquear"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}