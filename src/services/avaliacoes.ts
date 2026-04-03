import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  where,
  orderBy,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { db } from "./firebase";

export type CriarAvaliacaoArgs = {
  reservaId: string;
  quadraId: string;
  nota: number; // 1..5
  comentario?: string;
};

export type ResumoAvaliacoesQuadra = {
  quadraId: string;
  total: number;
  media: number; // 0..5
  contagemPorNota: Record<number, number>; // 1..5
};

function clampNota(n: number) {
  const x = Math.round(Number(n || 0));
  if (x < 1) return 1;
  if (x > 5) return 5;
  return x;
}

async function buscarAvaliacaoPorReserva(reservaId: string) {
  const col = collection(db, "avaliacoes");
  const q = query(col, where("reservaId", "==", reservaId), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...(d.data() as any) };
}

/**
 * ✅ Cria avaliação com regras:
 * - reserva precisa existir
 * - status === "finalizada"
 * - naoCompareceu !== true
 * - clienteUid === user.uid
 * - não pode avaliar 2x (reserva.avaliadaEm)
 */
export async function criarAvaliacao(args: CriarAvaliacaoArgs) {
  const user = getAuth().currentUser;
  if (!user?.uid) throw new Error("Você precisa estar logado.");

  const { reservaId, quadraId } = args;
  const nota = clampNota(args.nota);
  const comentario = args.comentario?.trim() ? args.comentario.trim() : null;

  if (!reservaId) throw new Error("reservaId inválido.");
  if (!quadraId) throw new Error("quadraId inválido.");

  const reservaRef = doc(db, "reservas", reservaId);
  const avaliacoesCol = collection(db, "avaliacoes");

  const res = await runTransaction(db, async (tx) => {
    const reservaSnap = await tx.get(reservaRef);
    if (!reservaSnap.exists()) throw new Error("Reserva não encontrada.");

    const reserva = reservaSnap.data() as any;

    if (reserva?.status !== "finalizada") {
      throw new Error("Você só pode avaliar após a reserva ser finalizada.");
    }
    if (reserva?.naoCompareceu === true) {
      throw new Error("Não é possível avaliar uma reserva marcada como 'não compareceu'.");
    }
    if (!reserva?.clienteUid || reserva.clienteUid !== user.uid) {
      throw new Error("Você não tem permissão para avaliar esta reserva.");
    }
    if (reserva?.avaliadaEm) {
      throw new Error("Esta reserva já foi avaliada.");
    }

    const avaliacaoRef = doc(avaliacoesCol);

    tx.set(avaliacaoRef, {
      reservaId,
      quadraId,
      clienteUid: user.uid,
      nota,
      comentario,
      createdAt: serverTimestamp(),
    });

    tx.update(reservaRef, {
      avaliadaEm: serverTimestamp(),
    });

    return { ok: true, avaliacaoId: avaliacaoRef.id };
  });

  return res;
}

export async function jaExisteAvaliacaoParaReserva(reservaId: string) {
  if (!reservaId) return false;
  const a = await buscarAvaliacaoPorReserva(reservaId);
  return !!a;
}

/**
 * ✅ Lista avaliações de uma quadra (últimas N)
 * (útil pra futuro: mostrar comentários/estrelas)
 */
export async function buscarAvaliacoesDaQuadra(quadraId: string, max = 50) {
  if (!quadraId) return [];
  const col = collection(db, "avaliacoes");
  const q = query(
    col,
    where("quadraId", "==", quadraId),
    orderBy("createdAt", "desc"),
    limit(Math.max(1, Math.min(max, 200)))
  );
  const snap = await getDocs(q);
  const lista: any[] = [];
  snap.forEach((d) => lista.push({ id: d.id, ...(d.data() as any) }));
  return lista;
}

/**
 * ✅ RESOLVE O ERRO DO SEU APP:
 * Export que estava sendo importado em algum lugar.
 *
 * Retorna resumo: total + média + contagem por nota.
 */
export async function buscarResumoAvaliacoesDaQuadra(
  quadraId: string
): Promise<ResumoAvaliacoesQuadra> {
  if (!quadraId) {
    return {
      quadraId: "",
      total: 0,
      media: 0,
      contagemPorNota: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    };
  }

  const col = collection(db, "avaliacoes");
  const q = query(col, where("quadraId", "==", quadraId));
  const snap = await getDocs(q);

  let total = 0;
  let soma = 0;
  const contagem: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  snap.forEach((d) => {
    const a = d.data() as any;
    const n = clampNota(a?.nota ?? 0);
    total++;
    soma += n;
    contagem[n] = (contagem[n] ?? 0) + 1;
  });

  const media = total > 0 ? Math.round((soma / total) * 10) / 10 : 0;

  return {
    quadraId,
    total,
    media,
    contagemPorNota: contagem,
  };
}
