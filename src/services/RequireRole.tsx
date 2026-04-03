import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

type Role = "atleta" | "dono" | "ceo";

type Props = {
  role: Role;
  children: any;
};

function normalizeRole(value: any): Role | null {
  if (!value) return null;
  const v = String(value).trim().toLowerCase();

  if (v === "atleta") return "atleta";
  if (v === "dono") return "dono";
  if (v === "ceo") return "ceo";

  return null;
}

export default function RequireRole({ role, children }: Props) {
  const [loading, setLoading] = useState(true);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    let alive = true;

    async function run() {
      try {
        const user = auth.currentUser;

        if (!user) {
          if (alive) {
            setOk(false);
            setLoading(false);
          }
          return;
        }

        const snap = await getDoc(doc(db, "users", user.uid));
        const rawRole = snap.exists() ? (snap.data() as any).role : null;
        const userRole = normalizeRole(rawRole);

        if (alive) {
          setOk(userRole === role);
          setLoading(false);
        }
      } catch {
        if (alive) {
          setOk(false);
          setLoading(false);
        }
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, [role]);

  if (loading) return null;
  if (!ok) return <Navigate to="/" replace />;
  return children;
}
