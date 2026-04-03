import { doc, onSnapshot, Timestamp } from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import type { User } from "firebase/auth";
import { db } from "./firebase";

export type UserStatus = {
  uid: string;
  role?: string | null;

  suspensoAteMs: number | null;
  suspensoMotivo: string | null;

  multaPendenteCentavos: number;
};

function toMs(ts: any): number | null {
  if (!ts) return null;
  if (typeof ts?.toMillis === "function") return ts.toMillis();
  if (ts instanceof Timestamp) return ts.toMillis();
  return null;
}

export function listenUserStatus(cb: (s: UserStatus | null) => void) {
  const auth = getAuth();
  let unsubUserDoc: null | (() => void) = null;

  const unsubAuth = onAuthStateChanged(auth, (u: User | null) => {
    // limpa listener anterior
    if (unsubUserDoc) {
      unsubUserDoc();
      unsubUserDoc = null;
    }

    if (!u?.uid) {
      cb(null);
      return;
    }

    const ref = doc(db, "users", u.uid);
    unsubUserDoc = onSnapshot(ref, (snap) => {
      const data: any = snap.exists() ? snap.data() : {};

      const suspMs = toMs(data?.suspensoAte);
      const motivo = data?.suspensoMotivo ? String(data.suspensoMotivo) : null;

      cb({
        uid: u.uid,
        role: (data?.role ?? null) as any,
        suspensoAteMs: suspMs,
        suspensoMotivo: motivo,
        multaPendenteCentavos: Number(data?.multaPendenteCentavos ?? 0),
      });
    });
  });

  return () => {
    try {
      unsubAuth();
    } catch {}
    try {
      unsubUserDoc?.();
    } catch {}
  };
}

export function isSuspensoAgora(s: UserStatus | null) {
  if (!s?.suspensoAteMs) return false;
  return s.suspensoAteMs > Date.now();
}

export function formatDateTimeBR(ms: number) {
  const d = new Date(ms);
  const pad2 = (n: number) => String(n).padStart(2, "0");
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} ${pad2(
    d.getHours()
  )}:${pad2(d.getMinutes())}`;
}