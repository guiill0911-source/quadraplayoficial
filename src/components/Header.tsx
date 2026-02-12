// src/components/Header.tsx
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../services/authContext";
import { logout } from "../services/authService";

export default function Header() {
  const { user } = useAuth();
  const loc = useLocation();

  const isDono = user?.role === "dono";

  function isActive(path: string) {
    return loc.pathname === path;
  }

  async function sair() {
    await logout();
  }

  const itemStyle = (active: boolean) => ({
    textDecoration: "none",
    fontWeight: active ? 900 : 600,
    color: active ? "#111" : "#444",
  });

  return (
    <div style={{ padding: "10px 16px", borderBottom: "1px solid #ddd" }}>
      <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
        <Link to="/" style={itemStyle(isActive("/"))}>
          Home
        </Link>

        <Link to="/minhas-reservas" style={itemStyle(isActive("/minhas-reservas"))}>
          Minhas Reservas
        </Link>

        {isDono && (
          <Link to="/dono" style={itemStyle(isActive("/dono"))}>
            Central do Proprietário
          </Link>
        )}

        <span style={{ marginLeft: "auto" }} />

        <span style={{ color: "#666", fontSize: 14 }}>
          Olá, <strong>{user?.nome ?? "usuário"}</strong>
        </span>

        <button onClick={sair}>Sair</button>
      </div>
    </div>
  );
}
