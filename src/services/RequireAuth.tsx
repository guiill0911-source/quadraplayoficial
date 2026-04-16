// src/services/RequireAuth.tsx
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./authContext";
import { TERMOS_VERSAO_ATUAL } from "../config/termos";

export default function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const loc = useLocation();

  // ✅ nunca redireciona enquanto está carregando
  if (loading) {
    return <p style={{ padding: 16 }}>Carregando…</p>;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  }

  // 🔥 REGRA CORRETA (igual ao fluxo de termos normal)
  if (
    user.role === "dono" &&
    user.versaoTermosDonoAceitos !== TERMOS_VERSAO_ATUAL &&
    loc.pathname !== "/aceite-termos-dono" &&
    loc.pathname !== "/termos-dono"
  ) {
    return (
      <Navigate
        to="/aceite-termos-dono"
        replace
        state={{ from: loc.pathname }}
      />
    );
  }

  return <>{children}</>;
}