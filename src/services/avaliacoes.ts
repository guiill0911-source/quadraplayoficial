// src/services/avaliacoes.ts
import {
  addDoc,
  collection,
  getDocs,
  query,
  where,
  serverTimestamp,
  limit,
} from "firebase/firestore";
import { auth, db } from "./firebase";

export type NovaAvaliacaoParams = {
  quadraId: string;
  reservaId: string; // pra amarrar 1 avaliação por jogo
  nota: number; // 1..5
  comentario: string;
};

export async function criarAvaliacao(params: NovaAvaliacaoParams) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Você precisa estar logado para avaliar.");

  const nota = Number(params.nota);
  if (!Number.isFinite(nota) || nota < 1 || nota > 5) {
    throw new Error("Nota inválida. Use de 1 a 5.");
  }

  const comentario = (params.comentario ?? "").trim();
  if (comentario.length < 3) {
    throw new Error("Escreva um comentário (mínimo 3 caracteres).");
  }

  // ✅ trava: 1 avaliação por reserva (jogo)
  const col = collection(db, "avaliacoes");
  const q = query(
    col,
    where("reservaId", "==", params.reservaId),
    where("clienteUid", "==", uid),
    limit(1)
  );
  const snap = await getDocs(q);
  if (!snap.empty) {
    throw new Error("Você já avaliou este jogo.");
  }

  await addDoc(col, {
    quadraId: params.quadraId,
    reservaId: params.reservaId,
    clienteUid: uid,
    nota,
    comentario,
    createdAt: serverTimestamp(),
  });

  return { ok: true };
}

export async function buscarResumoAvaliacoesDaQuadra(quadraId: string) {
  const col = collection(db, "avaliacoes");
  const q = query(col, where("quadraId", "==", quadraId));
  const snap = await getDocs(q);

  let total = 0;
  let soma = 0;

  snap.forEach((d) => {
    const x = d.data() as any;
    const nota = Number(x?.nota ?? 0);
    if (nota >= 1 && nota <= 5) {
      total++;
      soma += nota;
    }
  });

  const media = total > 0 ? soma / total : 0;
  return { total, media };
}
