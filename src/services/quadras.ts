import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { db } from "./firebase";

// Mantido: usado em outros pontos (ex: Home) para listar tudo
export async function buscarQuadras() {
  const col = collection(db, "quadras");
  const q = query(col, orderBy("createdAt", "desc"));
  const snap = await getDocs(q);

  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as any),
  }));
}

// Dono: sem depender de índice composto (ordena no front)
export async function buscarQuadrasDoDono(ownerId: string) {
  const col = collection(db, "quadras");
  const q = query(col, where("ownerId", "==", ownerId));
  const snap = await getDocs(q);

  const lista = snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as any),
  }));

  // ordena por createdAt (se existir) desc
  lista.sort((a: any, b: any) => {
    const aSec = a?.createdAt?.seconds ?? 0;
    const bSec = b?.createdAt?.seconds ?? 0;
    return bSec - aSec;
  });

  return lista;
}
