import { Link } from "react-router-dom";
import Header from "../../components/Header";

export default function CentralProprietario() {
  return (
    <>
      <Header />

      <div style={{ padding: 16, maxWidth: 760 }}>
        <h1 style={{ marginTop: 0 }}>Central do Proprietário</h1>

        <p style={{ color: "#666", marginTop: 6 }}>
          Aqui ficam as opções de gestão das suas quadras (cadastro, edição, reservas e horários).
        </p>

        <hr style={{ margin: "16px 0" }} />

        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
            <h3 style={{ margin: "0 0 8px" }}>🏟 Minhas quadras</h3>
            <p style={{ margin: "0 0 12px", color: "#666" }}>
              Ver suas quadras, editar informações e acessar ações (reservas / horários).
            </p>
            <Link to="/dono">
              <button>Entrar em Minhas Quadras</button>
            </Link>
          </div>

          <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
            <h3 style={{ margin: "0 0 8px" }}>➕ Nova quadra</h3>
            <p style={{ margin: "0 0 12px", color: "#666" }}>
              Cadastre uma nova quadra com esportes, valores, comodidades e foto de capa.
            </p>
            <Link to="/nova-quadra">
              <button>Cadastrar Nova Quadra</button>
            </Link>
          </div>

          {/* Se você ainda não estiver usando /dono/reservas, pode deixar assim por enquanto */}
          <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
            <h3 style={{ margin: "0 0 8px" }}>📅 Reservas das minhas quadras</h3>
            <p style={{ margin: "0 0 12px", color: "#666" }}>
              Acesse o painel e escolha uma quadra para ver/cancelar reservas.
            </p>
            <Link to="/dono">
              <button>Ver Reservas</button>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
