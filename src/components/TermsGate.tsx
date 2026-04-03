import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { db } from "../services/firebase";
import { TERMOS_VERSAO_ATUAL } from "../config/termos";

type Props = { children: React.ReactNode };

const FORCE_SHOW_TERMS = false;

export default function TermsGate({ children }: Props) {
  const auth = useMemo(() => getAuth(), []);
  const location = useLocation();

  const [loading, setLoading] = useState(true);
  const [needsAccept, setNeedsAccept] = useState(false);
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);

  async function checkUser(user: any) {
    const ref = doc(db, "users", user.uid);
    const snap = await getDoc(ref);
    const data = snap.exists() ? snap.data() : null;

    const versao = data?.versaoTermosAceitos ?? null;
    const aceitosEm = data?.termosAceitosEm ?? null;

    const ok = !!aceitosEm && versao === TERMOS_VERSAO_ATUAL;

    setNeedsAccept(!ok);
    setLoading(false);
  }

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setNeedsAccept(false);
        setLoading(false);
        return;
      }
      void checkUser(user);
    });

    return () => unsub();
  }, [auth]);

  async function aceitar() {
    const user = auth.currentUser;
    if (!user) return;

    setSaving(true);

    try {
      const ref = doc(db, "users", user.uid);

      await setDoc(
        ref,
        {
          termosAceitosEm: serverTimestamp(),
          versaoTermosAceitos: TERMOS_VERSAO_ATUAL,
        },
        { merge: true }
      );

      setNeedsAccept(false);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return null;

  const shouldShow = FORCE_SHOW_TERMS ? true : needsAccept;

  const isReading =
    location.pathname === "/termos" ||
    location.pathname === "/politica-cancelamento";

  if (!shouldShow || isReading) {
    return <>{children}</>;
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.65)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 9999,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 520,
          background: "#111",
          color: "#fff",
          borderRadius: 12,
          padding: 16,
          boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
        }}
      >
        <h2 style={{ marginTop: 0 }}>Aceite obrigatório</h2>

        <p style={{ opacity: 0.9 }}>
          Para usar o Quadra Play, você precisa aceitar os Termos e a Política de
          Cancelamento/Reembolso.
        </p>

        <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
          <a
            href="/termos"
            style={{ color: "#7dd3fc", textDecoration: "underline" }}
          >
            Ler Termos
          </a>

          <a
            href="/politica-cancelamento"
            style={{ color: "#7dd3fc", textDecoration: "underline" }}
          >
            Ler Política
          </a>
        </div>

        <label
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
            marginTop: 14,
          }}
        >
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
          />
          <span>Li e aceito</span>
        </label>

        <button
          onClick={aceitar}
          disabled={!checked || saving}
          style={{
            marginTop: 12,
            width: "100%",
            padding: 12,
            borderRadius: 10,
            border: 0,
            cursor: !checked || saving ? "not-allowed" : "pointer",
            opacity: !checked || saving ? 0.6 : 1,
            fontWeight: 700,
          }}
        >
          {saving ? "Salvando..." : "Aceitar e continuar"}
        </button>

        <div style={{ marginTop: 10, opacity: 0.7, fontSize: 12 }}>
          Versão atual: {TERMOS_VERSAO_ATUAL}
        </div>
      </div>
    </div>
  );
}