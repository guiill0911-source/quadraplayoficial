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
    where("ativo", "==", true)
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

    if (x?.bloqueado === true) return;
    if (x?.removido === true) return;

    if (x?.quadraId) quadraIds.add(String(x.quadraId));
  });

  return Array.from(quadraIds);
}

// ✅ Usado em /quadra/:id: retorna os slots realmente disponíveis
export type SlotDisponibilidade = {
  id: string;
  quadraId: string;
  esporte: string;
  data: string;
  horaInicio: string;
  horaFim: string;
  valor: number;
  numeroQuadra?: number;
  ativo: boolean;

  promocaoAtiva?: boolean;
  valorOriginal?: number | null;
  valorPromocional?: number | null;

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
    where("ativo", "==", true)
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
      numeroQuadra: Number(x.numeroQuadra ?? 1),
      ativo: Boolean(x.ativo),

      promocaoAtiva: x.promocaoAtiva === true,
      valorOriginal: x.valorOriginal != null ? Number(x.valorOriginal) : null,
      valorPromocional: x.valorPromocional != null ? Number(x.valorPromocional) : null,

      bloqueado: x.bloqueado === true,
      removido: x.removido === true,
    };
  });

  const slotsFiltrados = slots.filter(
    (s) => s.bloqueado !== true && s.removido !== true
  );

  slotsFiltrados.sort((a, b) => {
    const porHora = a.horaInicio.localeCompare(b.horaInicio);
    if (porHora !== 0) return porHora;

    return Number(a.numeroQuadra ?? 1) - Number(b.numeroQuadra ?? 1);
  });

  return slotsFiltrados;
}