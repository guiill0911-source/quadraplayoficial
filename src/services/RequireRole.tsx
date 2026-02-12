import { Navigate } from "react-router-dom";
import { useAuth } from "./authContext";

type Props = {
  role: "atleta" | "dono";
  children: React.ReactNode;
};

export default function RequireRole({ role, children }: Props) {
  const { user, loading } = useAuth();

  if (loading) return <p>Carregando...</p>;
  if (!user) return <Navigate to="/login" replace />;

  if (user.role !== role) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
