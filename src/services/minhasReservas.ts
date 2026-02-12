// src/services/minhasReservas.ts
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "./firebase";

export type ReservaDoc = {
  id: string;
  disponibilidadeId: string;
  quadraId: string;
  esporte: string;
  data: string; // "YYYY-MM-DD"
  horaInicio: string; // "HH:MM"
  horaFim: string; // "HH:MM"
  valor: number;
  status: string;

  // ✅ segurança / vínculo com login
  clienteUid?: string;

  cliente?: {
    nome?: string;
    telefone?: string | null;
  };

  createdAt?: any;
};

function mapReservaDoc(d: { id: string; data: any }): ReservaDoc {
  const x = d.data as any;
  return {
    id: d.id,
    disponibilidadeId: String(x.disponibilidadeId ?? ""),
    quadraId: String(x.quadraId ?? ""),
    esporte: String(x.esporte ?? ""),
    data: String(x.data ?? ""),
    horaInicio: String(x.horaInicio ?? ""),
    horaFim: String(x.horaFim ?? ""),
    valor: Number(x.valor ?? 0),
    status: String(x.status ?? ""),
    clienteUid: x.clienteUid ? String(x.clienteUid) : undefined,
    cliente: x.cliente
      ? {
          nome: x.cliente.nome ?? "",
          telefone: x.cliente.telefone ?? null,
        }
      : undefined,
    createdAt: x.createdAt ?? null,
  };
}

function ordenarPorDataHora(reservas: ReservaDoc[]) {
  reservas.sort((a, b) => {
    const ka = `${a.data} ${a.horaInicio}`;
    const kb = `${b.data} ${b.horaInicio}`;
    return ka.localeCompare(kb);
  });
  return reservas;
}

// ✅ NOVO: reservas do usuário logado
export async function buscarReservasDoUsuario(uid: string): Promise<ReservaDoc[]> {
  const u = uid?.trim();
  if (!u) return [];

  const col = collection(db, "reservas");
  const q = query(col, where("clienteUid", "==", u));

  const snap = await getDocs(q);
  const reservas = snap.docs.map((docSnap) => mapReservaDoc({ id: docSnap.id, data: docSnap.data() }));

  return ordenarPorDataHora(reservas);
}

/**
 * ⚠️ LEGADO (debug/MVP antigo): reservas por telefone.
 * Ideal: remover quando você não precisar mais.
 */
export async function buscarReservasPorTelefone(telefone: string): Promise<ReservaDoc[]> {
  const tel = telefone.trim();
  if (!tel) return [];

  const col = collection(db, "reservas");
  const q = query(col, where("cliente.telefone", "==", tel));

  const snap = await getDocs(q);
  const reservas = snap.docs.map((docSnap) => mapReservaDoc({ id: docSnap.id, data: docSnap.data() }));

  return ordenarPorDataHora(reservas);
}
