// src/services/disponibilidadesBusca.ts
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "./firebase";

export type FiltroDisponibilidade = {
  data: string;
  horaInicio?: string;
  esportes?: string[];
};

// ✅ Usado na HOME: retorna apenas IDs de quadras com slot realmente disponível
export async function buscarQuadrasDisponiveis(filtro: FiltroDisponibilidade) {
  const col = collection(db, "disponibilidades");

  let q = query(
    col,
    where("data", "==", filtro.data),
    where("ativo", "==", true),
    where("bloqueado", "==", false),
    where("removido", "==", false)
  );

  if (filtro.horaInicio) {
    q = query(q, where("horaInicio", "==", filtro.horaInicio));
  }

  if (filtro.esportes && filtro.esportes.length > 0) {
    // ATENÇÃO: "in" aceita no máximo 10 itens
    q = query(q, where("esporte", "in", filtro.esportes.slice(0, 10)));
  }

  const snap = await getDocs(q);

  const quadraIds = new Set<string>();
  snap.forEach((d) => {
    const x = d.data() as any;
    if (x?.quadraId) quadraIds.add(String(x.quadraId));
  });

  return Array.from(quadraIds);
}

// ✅ Usado em /quadra/:id: retorna os slots realmente disponíveis (com id do documento)
export type SlotDisponibilidade = {
  id: string;
  quadraId: string;
  esporte: string;
  data: string; // "YYYY-MM-DD"
  horaInicio: string; // "HH:MM"
  horaFim: string; // "HH:MM"
  valor: number;
  ativo: boolean;

  // novos campos (opcional no tipo, mas na prática virão)
  bloqueado?: boolean;
  removido?: boolean;
};

export async function buscarSlotsDisponiveisDaQuadra(params: {
  quadraId: string;
  data: string;
  esporte: string;
}): Promise<SlotDisponibilidade[]> {
  const col = collection(db, "disponibilidades");

  const q = query(
    col,
    where("quadraId", "==", params.quadraId),
    where("data", "==", params.data),
    where("esporte", "==", params.esporte),

    // ✅ só o que pode reservar
    where("ativo", "==", true),
    where("bloqueado", "==", false),
    where("removido", "==", false)
  );

  const snap = await getDocs(q);

  const slots: SlotDisponibilidade[] = snap.docs.map((d) => {
    const x = d.data() as any;
    return {
      id: d.id,
      quadraId: String(x.quadraId ?? ""),
      esporte: String(x.esporte ?? ""),
      data: String(x.data ?? ""),
      horaInicio: String(x.horaInicio ?? ""),
      horaFim: String(x.horaFim ?? ""),
      valor: Number(x.valor ?? 0),
      ativo: Boolean(x.ativo),

      bloqueado: Boolean(x.bloqueado),
      removido: Boolean(x.removido),
    };
  });

  // ordenar por hora
  slots.sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));

  return slots;
}
