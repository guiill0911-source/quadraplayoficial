import { runTransaction, doc, collection, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./firebase";

type ReservarParams = {
  disponibilidadeId: string;
  nomeCliente: string;
  telefoneCliente?: string;
};

export async function reservarHorario(params: ReservarParams) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Você precisa estar logado para reservar.");

  const dispRef = doc(db, "disponibilidades", params.disponibilidadeId);
  const reservasCol = collection(db, "reservas");

  return await runTransaction(db, async (tx) => {
    const dispSnap = await tx.get(dispRef);
    if (!dispSnap.exists()) throw new Error("Disponibilidade não existe");

    const disp = dispSnap.data() as any;

    if (disp.ativo !== true) throw new Error("Este horário já foi reservado");

    // ✅ 1) trava a disponibilidade (rules exigem reservadoPorUid)
    tx.update(dispRef, {
      ativo: false,
      reservadoEm: serverTimestamp(),
      reservadoPorUid: uid,
    });

    // ✅ 2) cria reserva
    const reservaRef = doc(reservasCol);
    tx.set(reservaRef, {
      disponibilidadeId: params.disponibilidadeId,
      quadraId: disp.quadraId,
      esporte: disp.esporte,
      data: disp.data,
      horaInicio: disp.horaInicio,
      horaFim: disp.horaFim,
      valor: disp.valor,
      status: "confirmada",

      clienteUid: uid,
      cliente: {
        nome: params.nomeCliente,
        telefone: params.telefoneCliente?.trim() ? params.telefoneCliente.trim() : null,
      },

      createdAt: serverTimestamp(),
    });

    return { reservaId: reservaRef.id };
  });
}

type CancelarReservaParams = {
  reservaId: string;
  bypassClienteUidCheck?: boolean; // dono/admin
};

export async function cancelarReserva(params: CancelarReservaParams) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Você precisa estar logado para cancelar.");

  const reservaRef = doc(db, "reservas", params.reservaId);

  return await runTransaction(db, async (tx) => {
    const reservaSnap = await tx.get(reservaRef);
    if (!reservaSnap.exists()) throw new Error("Reserva não encontrada");

    const reserva = reservaSnap.data() as any;

    if (reserva.status !== "confirmada") {
      throw new Error("Esta reserva não pode ser cancelada");
    }

    // por padrão, só o cliente; dono usa bypass
    if (!params.bypassClienteUidCheck) {
      if (reserva.clienteUid !== uid) {
        throw new Error("Você não tem permissão para cancelar esta reserva");
      }
    }

    const disponibilidadeId = reserva.disponibilidadeId;
    if (!disponibilidadeId) throw new Error("Reserva sem disponibilidadeId");

    const dispRef = doc(db, "disponibilidades", disponibilidadeId);

    // ✅ 1) cancela reserva
    tx.update(reservaRef, {
      status: "cancelada",
      canceladaEm: serverTimestamp(),
      canceladaPorUid: uid,
    });

    // ✅ 2) libera a disponibilidade (rules exigem reservadoPorUid -> null)
    tx.update(dispRef, {
      ativo: true,
      liberadoEm: serverTimestamp(),
      reservadoPorUid: null,
    });

    return { ok: true };
  });
}

type CancelarReservaEBloquearParams = {
  reservaId: string;
  // neste MVP é sempre ação do dono/admin, então não expus bypass aqui
};

export async function cancelarReservaEBloquear(params: CancelarReservaEBloquearParams) {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Você precisa estar logado para cancelar.");

  const reservaRef = doc(db, "reservas", params.reservaId);

  return await runTransaction(db, async (tx) => {
    const reservaSnap = await tx.get(reservaRef);
    if (!reservaSnap.exists()) throw new Error("Reserva não encontrada");

    const reserva = reservaSnap.data() as any;

    if (reserva.status !== "confirmada") {
      throw new Error("Esta reserva não pode ser cancelada");
    }

    const disponibilidadeId = reserva.disponibilidadeId;
    if (!disponibilidadeId) throw new Error("Reserva sem disponibilidadeId");

    const dispRef = doc(db, "disponibilidades", disponibilidadeId);

    // ✅ 1) cancela reserva
    tx.update(reservaRef, {
  status: "cancelada",
  canceladaEm: serverTimestamp(),
  canceladaPorUid: uid,
  canceladaEBloqueada: true,
});


    // ✅ 2) mantém o slot BLOQUEADO (não volta a ficar disponível)
    // rules: reservadoPorUid precisa ir pra null
    tx.update(dispRef, {
      ativo: false,
      bloqueado: true,
      bloqueadoPorUid: uid,
      liberadoEm: serverTimestamp(),
      reservadoPorUid: null,
    });

    return { ok: true };
  });
}
