import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "./firebase";
import { TERMOS_VERSAO_ATUAL } from "../config/termos";

type Props = { children: React.ReactNode };

export default function RequireTerms({ children }: Props) {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    (async () => {
      const user = getAuth().currentUser;
      if (!user) {
        // quem garante login é o RequireAuth
        setLoading(false);
        setOk(false);
        return;
      }

      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);
      const data = snap.exists() ? snap.data() : null;

      const versao = (data?.versaoTermosAceitos as string | undefined) ?? null;
      const aceitosEm = data?.termosAceitosEm ?? null;

      const aceitou = !!aceitosEm && versao === TERMOS_VERSAO_ATUAL;

      setOk(aceitou);
      setLoading(false);
    })();
  }, []);

  if (loading) return null;

  if (!ok) {
    return (
      <Navigate
        to="/aceite-termos"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }

  return <>{children}</>;
}