import {
  collection,
  doc,
  getDocs,
  query,
  Timestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";

/**
 * Finaliza automaticamente reservas confirmadas cujo horário já terminou (endAt < agora).
 * Regra: só finaliza se tiver endAt.
 */
export async function finalizarReservasAtrasadas() {
  const agora = Timestamp.now();

  const col = collection(db, "reservas");
  const q = query(col, where("status", "==", "confirmada"));

  const snap = await getDocs(q);
  if (snap.empty) return { atualizadas: 0 };

  const batch = writeBatch(db);
  let count = 0;

  snap.forEach((d) => {
    const r = d.data() as any;

    const endAt: Timestamp | null = r?.endAt instanceof Timestamp ? r.endAt : null;
    if (!endAt) return;

    if (endAt.toMillis() <= agora.toMillis()) {
      batch.update(doc(db, "reservas", d.id), {
        status: "finalizada",
        finalizadaEm: agora,
        finalizadaPorTipo: "auto",
      });
      count++;
    }
  });

  if (count > 0) await batch.commit();
  return { atualizadas: count };
}
