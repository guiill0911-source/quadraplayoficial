import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Header from "../../components/Header";
import { buscarQuadrasDoDono } from "../../services/quadras";
import { useAuth } from "../../services/authContext";

type Quadra = {
  id: string;
  nome: string;
  cidade: string;
  endereco?: string;
  ativo?: boolean;
};

export default function DonoHome() {
  const { user, loading } = useAuth();
  const [quadras, setQuadras] = useState<Quadra[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (!user?.uid) {
      setCarregando(false);
      return;
    }

    const ownerId = user.uid;

    async function carregar() {
      try {
        setCarregando(true);
        const dados = await buscarQuadrasDoDono(ownerId);
        setQuadras(dados as Quadra[]);
      } catch (e) {
        console.error(e);
        alert("Erro ao buscar suas quadras. Veja o console.");
      } finally {
        setCarregando(false);
      }
    }

    carregar();
  }, [user?.uid]);

  if (loading) return <p>Carregando usuário...</p>;

  return (
    <>
      <Header />

      <div style={{ padding: 16 }}>
        <h1 style={{ margin: 0 }}>Minhas Quadras</h1>
        <p style={{ margin: "6px 0 0", color: "#666" }}>
          Aqui você gerencia suas quadras, edita informações e vê reservas.
        </p>

        <hr style={{ margin: "16px 0" }} />

        {carregando && <p>Carregando quadras...</p>}

        {!carregando && (
          <p>
            Total: <strong>{quadras.length}</strong>
          </p>
        )}

        <div style={{ display: "grid", gap: 14, marginTop: 12 }}>
          {quadras.map((q) => (
            <div
              key={q.id}
              style={{
                border: "1px solid #ddd",
                borderRadius: 12,
                padding: 12,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <h3 style={{ margin: "0 0 6px" }}>{q.nome}</h3>
                  <div style={{ color: "#444" }}>{q.cidade}</div>
                  {q.endereco && <div style={{ color: "#666", marginTop: 4 }}>{q.endereco}</div>}
                  {q.ativo === false && <div style={{ color: "red", marginTop: 6 }}>Inativa</div>}
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <Link to={`/quadra/${q.id}`}>
                    <button>Abrir</button>
                  </Link>

                  <Link to={`/dono/quadra/${q.id}/editar`}>
                    <button>Editar</button>
                  </Link>

                  <Link to={`/dono/quadra/${q.id}/reservas`}>
                    <button>Ver reservas</button>
                  </Link>
                </div>
              </div>
            </div>
          ))}

          {!carregando && quadras.length === 0 && (
            <div style={{ border: "1px dashed #ccc", borderRadius: 12, padding: 12 }}>
              <p style={{ margin: 0 }}>
                Nenhuma quadra encontrada. Use <strong>Nova Quadra</strong> no topo para criar.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
