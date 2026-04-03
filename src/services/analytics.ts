import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "./firebase";

type AnaliseHorario = {
  hora: string;
  totalReservas: number;
};

export async function analisarHorariosQuadra(quadraId: string) {
  const col = collection(db, "reservas");

  const q = query(
    col,
    where("quadraId", "==", quadraId),
  where("status", "in", ["confirmada", "finalizada"])
  );

  const snap = await getDocs(q);

  const mapa: Record<string, number> = {};

  snap.forEach((doc) => {
    const r = doc.data() as any;

    const hora = String(r.horaInicio ?? "").slice(0, 5);
    if (!hora) return;

    if (!mapa[hora]) mapa[hora] = 0;
    mapa[hora]++;
  });

  const resultado: AnaliseHorario[] = Object.entries(mapa).map(
    ([hora, totalReservas]) => ({
      hora,
      totalReservas,
    })
  );

  // ordenar do mais vendido pro menos vendido
  resultado.sort((a, b) => b.totalReservas - a.totalReservas);

  return resultado;
}