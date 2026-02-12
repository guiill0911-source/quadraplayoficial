import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./authContext";

export default function RequireAuth({ children }: { children: ReactNode }) {
  const { loading, user } = useAuth();

  if (loading) return <p style={{ padding: 16 }}>Carregando...</p>;
  if (!user) return <Navigate to="/login" replace />;

  return <>{children}</>;
}
