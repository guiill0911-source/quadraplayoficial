import { Routes, Route, Navigate } from "react-router-dom";

import Home from "./pages/Home";
import NovaQuadra from "./pages/NovaQuadra";
import Quadra from "./pages/Quadra";

import DonoHome from "./pages/dono/DonoHome";
import DonoReservasQuadra from "./pages/dono/DonoReservasQuadra";
import EditarQuadra from "./pages/dono/EditarQuadra";
import GerenciarHorariosMes from "./pages/dono/GerenciarHorariosMes";
import CentralProprietario from "./pages/dono/CentralProprietario"; // ✅ NOVO



import MinhasReservas from "./pages/MinhasReservas";
import Login from "./pages/Login";
import Cadastro from "./pages/Cadastro";

import RequireAuth from "./services/RequireAuth";
import RequireRole from "./services/RequireRole";

export default function AppRoutes() {
  return (
    <Routes>
      {/* =======================
          PÚBLICAS
      ======================= */}
      <Route path="/login" element={<Login />} />
      <Route path="/cadastro" element={<Cadastro />} />

      {/* =======================
          PROTEGIDAS (LOGADO)
      ======================= */}
      <Route
        path="/"
        element={
          <RequireAuth>
            <Home />
          </RequireAuth>
        }
      />
<Route
  path="/dono/central"
  element={
    <RequireAuth>
      <RequireRole role="dono">
        <CentralProprietario />
      </RequireRole>
    </RequireAuth>
  }
/>


      <Route
        path="/quadra/:id"
        element={
          <RequireAuth>
            <Quadra />
          </RequireAuth>
        }
      />

      <Route
        path="/minhas-reservas"
        element={
          <RequireAuth>
            <MinhasReservas />
          </RequireAuth>
        }
      />

      {/* =======================
          DONO ONLY
      ======================= */}

      {/* ⭐ NOVA CENTRAL DO PROPRIETÁRIO */}
      <Route
        path="/dono/central"
        element={
          <RequireAuth>
            <RequireRole role="dono">
              <CentralProprietario />
            </RequireRole>
          </RequireAuth>
        }
      />

      <Route
        path="/nova-quadra"
        element={
          <RequireAuth>
            <RequireRole role="dono">
              <NovaQuadra />
            </RequireRole>
          </RequireAuth>
        }
      />

      {/* Painel do dono (lista de quadras) */}
      <Route
        path="/dono"
        element={
          <RequireAuth>
            <RequireRole role="dono">
              <DonoHome />
            </RequireRole>
          </RequireAuth>
        }
      />

      {/* Reservas de uma quadra específica */}
      <Route
        path="/dono/quadra/:id/reservas"
        element={
          <RequireAuth>
            <RequireRole role="dono">
              <DonoReservasQuadra />
            </RequireRole>
          </RequireAuth>
        }
      />

      {/* Editar dados da quadra */}
      <Route
        path="/dono/quadra/:id/editar"
        element={
          <RequireAuth>
            <RequireRole role="dono">
              <EditarQuadra />
            </RequireRole>
          </RequireAuth>
        }
      />

      {/* Gerenciar horários (grade mensal) */}
      <Route
        path="/dono/quadra/:id/horarios"
        element={
          <RequireAuth>
            <RequireRole role="dono">
              <GerenciarHorariosMes />
            </RequireRole>
          </RequireAuth>
        }
      />

      {/* =======================
          FALLBACK
      ======================= */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
