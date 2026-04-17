import * as admin from "firebase-admin";
import { logger } from "firebase-functions";
import { defineSecret } from "firebase-functions/params";
import { onCall, onRequest, HttpsError, CallableRequest } from "firebase-functions/v2/https";
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import * as functions from "firebase-functions";
import * as crypto from "crypto";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { Resend } from "resend";

const resend = new Resend("re_3V44GGPi_28UoLJNE9Cnsc783CUhxDrMP");

admin.initializeApp();
const db = admin.firestore();

// ✅ Secret (Gen2)
const MERCADOPAGO_TOKEN = defineSecret("MERCADOPAGO_TOKEN");

// ✅ Secret (Gen2) - backfill protegido
const BACKFILL_KEY = defineSecret("BACKFILL_KEY");

const MERCADOPAGO_CLIENT_ID = defineSecret("MERCADOPAGO_CLIENT_ID");
const MERCADOPAGO_CLIENT_SECRET = defineSecret("MERCADOPAGO_CLIENT_SECRET");
const MERCADOPAGO_REDIRECT_URI = defineSecret("MERCADOPAGO_REDIRECT_URI");

/* =======================
   HELPERS
======================= */

function requireAuth(req: CallableRequest<any>) {
  if (!req.auth) {
    throw new HttpsError("unauthenticated", "Faça login novamente.");
  }
  return req.auth.uid;
}

async function requireNotSuspended(uid: string) {
  const snap = await db.collection("users").doc(uid).get();
  const u = snap.exists ? (snap.data() as any) : null;

  const suspensoAte = u?.suspensoAte ?? null;
  if (suspensoAte && typeof suspensoAte?.toMillis === "function") {
    const suspMs = suspensoAte.toMillis();
    const nowMs = Date.now();

    if (suspMs > nowMs) {
      const motivo = String(u?.suspensoMotivo ?? "suspenso");
      throw new HttpsError("failed-precondition", `Conta suspensa. Motivo: ${motivo}`);
    }
  }
}

function roundInt(n: number) {
  return Math.round(Number(n || 0));
}

function asCentavos(valorReais: number) {
  return roundInt(valorReais * 100);
}


/**
 * 🔥 Motor Financeiro v1
 * OBS: tudo em centavos
 */
function calcularFinanceiroV1(args: {
  valorTotalCentavos: number;
  comissaoPercentual: number; // ex: 5
  motivoPolitica:
    | "normal"
    | "noshow"
    | "cancelamento_cliente_menos_1h"
    | "cancelamento_cliente_mais_1h"
    | "cancelamento_dono";
}) {
  const total = roundInt(args.valorTotalCentavos);
  const comissao = Number(args.comissaoPercentual || 0);
  const motivo = args.motivoPolitica;

  let valorClienteCentavos = 0;
  let valorPlataformaCentavos = 0;
  let valorDonoCentavos = 0;

  if (total <= 0) {
    return {
      valorTotalCentavos: total,
      valorClienteCentavos: 0,
      valorPlataformaCentavos: 0,
      valorDonoCentavos: 0,
    };
  }

  if (motivo === "cancelamento_cliente_mais_1h" || motivo === "cancelamento_dono") {
    valorClienteCentavos = total;
    valorPlataformaCentavos = 0;
    valorDonoCentavos = 0;
  } else if (motivo === "cancelamento_cliente_menos_1h") {
    const multa = roundInt(total * 0.1);
    valorClienteCentavos = total - multa;

    const metade = Math.floor(multa / 2);
    valorDonoCentavos = metade;
    valorPlataformaCentavos = multa - metade;
  } else if (motivo === "noshow") {
    const retencao = roundInt(total * 0.8);
    valorClienteCentavos = total - retencao;

    valorPlataformaCentavos = roundInt(retencao * (comissao / 100));
    valorDonoCentavos = retencao - valorPlataformaCentavos;
  } else {
    valorPlataformaCentavos = roundInt(total * (comissao / 100));
    valorDonoCentavos = total - valorPlataformaCentavos;
    valorClienteCentavos = 0;
  }

  const soma = valorClienteCentavos + valorPlataformaCentavos + valorDonoCentavos;
  if (soma !== total) valorDonoCentavos += total - soma;

  return {
    valorTotalCentavos: total,
    valorClienteCentavos,
    valorPlataformaCentavos,
    valorDonoCentavos,
  };
}

/**
 * ✅ Helper: exige CEO OU dono da quadra da reserva
 */
async function requireCeoOrOwnerOfReserva(uid: string, reservaId: string) {
  const userSnap = await db.collection("users").doc(uid).get();
  const roleRaw = (userSnap.data() as any)?.role;
  const role = roleRaw ? String(roleRaw).trim().toLowerCase() : "";

  if (role === "ceo") return;

  if (role !== "dono") {
    throw new HttpsError("permission-denied", "Acesso restrito.");
  }

  const reservaSnap = await db.collection("reservas").doc(reservaId).get();
  if (!reservaSnap.exists) {
    throw new HttpsError("not-found", "Reserva não encontrada.");
  }

  const r = reservaSnap.data() as any;
  const quadraId = String(r.quadraId ?? "");
  if (!quadraId) throw new HttpsError("failed-precondition", "Reserva sem quadraId.");

  const quadraSnap = await db.collection("quadras").doc(quadraId).get();
  if (!quadraSnap.exists) throw new HttpsError("failed-precondition", "Quadra não encontrada.");

  const q = quadraSnap.data() as any;
  const ownerId = String(q.ownerId ?? q.ownerUid ?? "");
  if (!ownerId || ownerId !== uid) {
    throw new HttpsError("permission-denied", "Você não é dono desta quadra.");
  }
}

/* =======================
   1) reserveAndCreatePix (BLINDADO)
======================= */

export const reserveAndCreatePix = onCall(
  {
    region: "us-central1",
  },
  async (
  req: CallableRequest<{
    disponibilidadeId?: string;
    nomeCliente?: string;
    telefoneCliente?: string;
  }>
) => {
    const uid = requireAuth(req);
    // 🚫 BLOQUEIO SE MULTA PENDENTE
const userSnap = await db.collection("users").doc(uid).get();
const userData = userSnap.exists ? userSnap.data() as any : null;

const multaPendente = Number(userData?.multaPendenteCentavos ?? 0);

if (multaPendente > 0) {
  throw new HttpsError(
    "failed-precondition",
    "Você possui multa pendente. Quite antes de realizar nova reserva."
  );
}
    await requireNotSuspended(uid);

    const disponibilidadeId = String(req.data?.disponibilidadeId ?? "").trim();
    const nomeCliente = String(req.data?.nomeCliente ?? "").trim();
    const telefoneCliente = String(req.data?.telefoneCliente ?? "").trim();

    if (!disponibilidadeId) throw new HttpsError("invalid-argument", "disponibilidadeId é obrigatório.");
    if (!nomeCliente) throw new HttpsError("invalid-argument", "Informe seu nome.");
    if (!telefoneCliente) throw new HttpsError("invalid-argument", "Informe seu telefone.");

    const MP_TOKEN = MERCADOPAGO_TOKEN.value();
    if (!MP_TOKEN) throw new HttpsError("failed-precondition", "Secret MERCADOPAGO_TOKEN não configurada.");

    const dispRef = db.collection("disponibilidades").doc(disponibilidadeId);
    const reservaRef = db.collection("reservas").doc();

    let reservaCriada: any = null;
let mpAccessTokenDono = "";
let donoUidReserva = "";

    await db.runTransaction(async (tx) => {
      const dispSnap = await tx.get(dispRef);
      if (!dispSnap.exists) throw new HttpsError("not-found", "Horário não encontrado.");

      const disp = dispSnap.data() as any;

      // comissão definida pela quadra (seguro no backend)
    const comissaoPercentual = Math.max(0, Math.min(100, Number(disp.comissaoPercentual ?? 5)));

    const quadraId = String(disp.quadraId ?? "").trim();
if (!quadraId) {
  throw new HttpsError("failed-precondition", "Slot sem quadraId.");
}

const quadraRef = db.collection("quadras").doc(quadraId);
const quadraSnap = await tx.get(quadraRef);
if (!quadraSnap.exists) {
  throw new HttpsError("failed-precondition", "Quadra não encontrada.");
}

const quadraData = quadraSnap.data() as any;
const donoUid = String(quadraData?.ownerId ?? quadraData?.ownerUid ?? "").trim();
if (!donoUid) {
  throw new HttpsError("failed-precondition", "Quadra sem ownerId.");
}

donoUidReserva = donoUid;

const donoRef = db.collection("users").doc(donoUid);
const donoSnap = await tx.get(donoRef);
if (!donoSnap.exists) {
  throw new HttpsError("failed-precondition", "Dono da quadra não encontrado.");
}

const donoData = donoSnap.data() as any;
const mpConnectionStatus = String(donoData?.mpConnectionStatus ?? "").trim();
const mpAccessToken = String(donoData?.mpAccessToken ?? "").trim();
const mpUserId = String(donoData?.mpUserId ?? "").trim();

if (mpConnectionStatus !== "connected" || !mpAccessToken || !mpUserId) {
  throw new HttpsError(
    "failed-precondition",
    "Esta quadra ainda não está habilitada para Pix online."
  );
}

mpAccessTokenDono = mpAccessToken;


      if (disp.ativo === false) throw new HttpsError("failed-precondition", "Horário indisponível.");
      if (disp.bloqueado === true) throw new HttpsError("failed-precondition", "Horário bloqueado.");
      if (disp.reservadoPorUid) throw new HttpsError("failed-precondition", "Horário já reservado.");

     const promocaoAtiva = disp.promocaoAtiva === true;
const valorBase = Number(disp.valor ?? 0);
const valorPromo = Number(disp.valorPromocional ?? 0);

const valor =
  promocaoAtiva && valorPromo > 0
    ? valorPromo
    : valorBase;
      if (!valor || valor <= 0) throw new HttpsError("failed-precondition", "Horário sem valor válido.");

      const valorTotalCentavos = asCentavos(valor);
      const financeiro = calcularFinanceiroV1({
        valorTotalCentavos,
        comissaoPercentual,
        motivoPolitica: "normal",
      });

      reservaCriada = {
        disponibilidadeId,
        quadraId: String(disp.quadraId ?? ""),
        donoUid: donoUidReserva,
        esporte: String(disp.esporte ?? ""),
        data: String(disp.data ?? ""),
        horaInicio: String(disp.horaInicio ?? ""),
        horaFim: String(disp.horaFim ?? ""),
valor,

        status: "aguardando_pagamento",

        startAt: disp.startAt ?? null,
        endAt: disp.endAt ?? null,

        clienteUid: uid,
        cliente: { nome: nomeCliente, telefone: telefoneCliente },

       pagamentoTipo: "online",
pagamentoStatus: "pendente",
pagoEm: null,
valorPago: null,
registradoPorUid: null,
mpCollectorUserId: mpUserId,
mpContaRecebedoraStatus: "connected",
expiraPagamentoEm: admin.firestore.Timestamp.fromMillis(Date.now() + 10 * 60 * 1000),

        statusRepasse: "pendente",
        repassadoEm: null,

        politicaVersao: "v1",
        motivoPolitica: "normal",
        comissaoPercentualAplicada: comissaoPercentual,
        ...financeiro,
        calculadoEm: admin.firestore.FieldValue.serverTimestamp(),

        naoCompareceu: false,
        naoCompareceuMarcadoEm: null,
        naoCompareceuMarcadoPorUid: null,
        avaliadaEm: null,

        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        canceladaEm: null,
        canceladaPorUid: null,
        finalizadaEm: null,
        finalizadaPorTipo: null,
        finalizadaPorUid: null,
      };

      tx.set(reservaRef, reservaCriada);
      

      tx.update(dispRef, {
        reservadoPorUid: uid,
        reservadoEm: admin.firestore.FieldValue.serverTimestamp(),
        ativo: false,
      });
    });

    const reservaId = reservaRef.id;

    try {
      const email = (req.auth?.token.email as string | undefined) || "teste@quadraplay.app";
      const notificationUrl = "https://us-central1-quadraplayoficial.cloudfunctions.net/mpWebhook";

      const valorReserva = Number(reservaCriada?.valor ?? 0);

const body = {
  transaction_amount: valorReserva,
  description: `Quadra Play - Reserva ${reservaId}`,
  payment_method_id: "pix",
  payer: { email },
  external_reference: reservaId,
  notification_url: notificationUrl,
};

const resp = await fetch("https://api.mercadopago.com/v1/payments", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${mpAccessTokenDono}`,
    "Content-Type": "application/json",
    "X-Idempotency-Key": `reserva-${reservaId}`,
  },
  body: JSON.stringify(body),
});

      const mp: any = await resp.json();

      if (!resp.ok) {
        logger.error("MP create payment error:", mp);
        throw new Error(mp?.message || "Falha ao criar pagamento PIX.");
      }

      const copiaCola = mp?.point_of_interaction?.transaction_data?.qr_code || "";
      const qrBase64 = mp?.point_of_interaction?.transaction_data?.qr_code_base64 || "";
      const paymentId = String(mp?.id || "");

      if (!copiaCola || !qrBase64 || !paymentId) {
        logger.error("MP resposta sem dados PIX:", mp);
        throw new Error("MP não retornou dados do PIX.");
      }

      await reservaRef.update({
        pagamentoStatus: "pendente",
        mpPaymentId: paymentId,
        pixCopiaECola: copiaCola,
        pixQrBase64: qrBase64,
        pixCriadoEm: admin.firestore.FieldValue.serverTimestamp(),
        mpStatus: mp?.status ?? "pending",
        mpUltimaNotificacaoEm: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { reservaId, paymentId, copiaCola, qrBase64, status: "pendente" };
    } catch (e: any) {
      logger.error("reserveAndCreatePix error -> rollback", e);

      await db.runTransaction(async (tx) => {
  const rSnap = await tx.get(reservaRef);
  const dSnap = await tx.get(dispRef);

    if (rSnap.exists) {
    tx.update(reservaRef, {
      status: "cancelada",
      pagamentoStatus: "cancelado",
      mpStatus: "erro_criacao_pix",
      canceladaEm: admin.firestore.FieldValue.serverTimestamp(),
      canceladaPorUid: null,
      canceladaPorSistema: true,
      canceladaMotivo: "falha_criacao_pix",
      motivoPolitica: "falha_criacao_pix",
      calculadoEm: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  if (dSnap.exists) {
    tx.update(dispRef, {
      ativo: true,
      reservadoPorUid: null,
      reservadoEm: null,
    });
  }
});

      throw new HttpsError("internal", e?.message || "Falha ao gerar PIX. Tente novamente.");
    }
  }
);

/* =======================
   2) createPixPayment (mantido)
======================= */

export const createPixPayment = onCall(
  { region: "us-central1", secrets: [MERCADOPAGO_TOKEN] },
  async (req: CallableRequest<{ reservaId?: string }>) => {
    const uid = requireAuth(req);
    await requireNotSuspended(uid);

    const reservaId = String(req.data?.reservaId ?? "").trim();
    if (!reservaId) throw new HttpsError("invalid-argument", "reservaId é obrigatório.");

    const email = (req.auth?.token.email as string | undefined) || "teste@quadraplay.app";

    const reservaRef = db.collection("reservas").doc(reservaId);
    const snap = await reservaRef.get();
    if (!snap.exists) throw new HttpsError("not-found", "Reserva não encontrada.");

    const r = snap.data() as any;

    if (String(r.clienteUid ?? "") !== uid) {
      throw new HttpsError("permission-denied", "Reserva não pertence a você.");
    }

    if (String(r.pagamentoTipo ?? "") !== "online") {
      throw new HttpsError("failed-precondition", "Reserva não é pagamento online.");
    }

    if (r.mpPaymentId && r.pixCopiaECola && r.pixQrBase64) {
      return {
        paymentId: r.mpPaymentId,
        copiaCola: r.pixCopiaECola,
        qrBase64: r.pixQrBase64,
        status: r.pagamentoStatus || "pendente",
      };
    }

    const valor = Number(r.valor ?? r.preco ?? r.valorHora ?? 0);
    if (!valor || valor <= 0) {
      throw new HttpsError("failed-precondition", "Reserva sem valor. Garanta que a reserva tenha campo valor/preco.");
    }

    const MP_TOKEN = MERCADOPAGO_TOKEN.value();
    if (!MP_TOKEN) throw new HttpsError("failed-precondition", "Secret MERCADOPAGO_TOKEN não configurada.");

    const notificationUrl = "https://us-central1-quadraplayoficial.cloudfunctions.net/mpWebhook";

    const body = {
      transaction_amount: valor,
      description: `Quadra Play - Reserva ${reservaId}`,
      payment_method_id: "pix",
      payer: { email },
      external_reference: reservaId,
      notification_url: notificationUrl,
    };

    const resp = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MP_TOKEN}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": `reserva-${reservaId}`,
      },
      body: JSON.stringify(body),
    });

    const mp: any = await resp.json();

    if (!resp.ok) {
      logger.error("MP create payment error:", mp);
      throw new HttpsError("internal", mp?.message || "Falha ao criar pagamento PIX.");
    }

    const copiaCola = mp?.point_of_interaction?.transaction_data?.qr_code || "";
    const qrBase64 = mp?.point_of_interaction?.transaction_data?.qr_code_base64 || "";
    const paymentId = String(mp?.id || "");

    if (!copiaCola || !qrBase64 || !paymentId) {
      logger.error("MP resposta sem dados PIX:", mp);
      throw new HttpsError("internal", "MP não retornou dados do PIX.");
    }

    await reservaRef.update({
      pagamentoStatus: "pendente",
      mpPaymentId: paymentId,
      pixCopiaECola: copiaCola,
      pixQrBase64: qrBase64,
      pixCriadoEm: admin.firestore.FieldValue.serverTimestamp(),
      mpStatus: mp?.status ?? "pending",
      mpUltimaNotificacaoEm: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { paymentId, copiaCola, qrBase64, status: "pendente" };
  }
);

/* =======================
   PIX MULTA (NOVO)
   - Pode pagar mesmo suspenso (NÃO chama requireNotSuspended)
======================= */

export const createPixMulta = onCall(
  { region: "us-central1", secrets: [MERCADOPAGO_TOKEN] },
  async (req: CallableRequest<{}>) => {
    const uid = requireAuth(req);

    const email = (req.auth?.token.email as string | undefined) || "teste@quadraplay.app";

    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    const userData = userSnap.exists ? (userSnap.data() as any) : {};

    const multaCentavos = Number(userData?.multaPendenteCentavos ?? 0);
    if (!multaCentavos || multaCentavos <= 0) {
      throw new HttpsError("failed-precondition", "Você não possui multa pendente.");
    }

    const valor = Math.max(0.01, Math.round(multaCentavos / 100));
    if (!valor || valor <= 0) throw new HttpsError("failed-precondition", "Valor de multa inválido.");

    const MP_TOKEN = MERCADOPAGO_TOKEN.value();
    if (!MP_TOKEN) throw new HttpsError("failed-precondition", "Secret MERCADOPAGO_TOKEN não configurada.");

    const multaRef = db.collection("multas").doc(uid);
    const multaSnap = await multaRef.get();
    const m = multaSnap.exists ? (multaSnap.data() as any) : null;

    if (
      m?.mpPaymentId &&
      m?.pixCopiaECola &&
      m?.pixQrBase64 &&
      String(m?.status ?? "") === "pendente"
    ) {
      return {
        multaId: uid,
        paymentId: m.mpPaymentId,
        copiaCola: m.pixCopiaECola,
        qrBase64: m.pixQrBase64,
        status: "pendente",
        valorCentavos: multaCentavos,
      };
    }

    const notificationUrl = "https://us-central1-quadraplayoficial.cloudfunctions.net/mpWebhook";

    const body = {
      transaction_amount: valor,
      description: `Quadra Play - Multa (${uid})`,
      payment_method_id: "pix",
      payer: { email },
      external_reference: `multa-${uid}`,
      notification_url: notificationUrl,
    };

    const resp = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MP_TOKEN}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": `multa-${uid}-${multaCentavos}`,
      },
      body: JSON.stringify(body),
    });

    const mp: any = await resp.json();

    if (!resp.ok) {
      logger.error("MP create multa payment error:", mp);
      throw new HttpsError("internal", mp?.message || "Falha ao criar PIX da multa.");
    }

    const copiaCola = mp?.point_of_interaction?.transaction_data?.qr_code || "";
    const qrBase64 = mp?.point_of_interaction?.transaction_data?.qr_code_base64 || "";
    const paymentId = String(mp?.id || "");

    if (!copiaCola || !qrBase64 || !paymentId) {
      logger.error("MP resposta sem dados PIX (multa):", mp);
      throw new HttpsError("internal", "MP não retornou dados do PIX da multa.");
    }

    await multaRef.set(
      {
        uid,
        status: "pendente",
        valorCentavos: multaCentavos,

        mpPaymentId: paymentId,
        pixCopiaECola: copiaCola,
        pixQrBase64: qrBase64,

        pixCriadoEm: admin.firestore.FieldValue.serverTimestamp(),
        mpStatus: mp?.status ?? "pending",
        mpUltimaNotificacaoEm: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return { multaId: uid, paymentId, copiaCola, qrBase64, status: "pendente", valorCentavos: multaCentavos };
  }
);

/* =======================
   3) Webhook MP -> pagamentoStatus automático (RESERVA + MULTA)
======================= */

export const mpWebhook = onRequest(
  { region: "us-central1", secrets: [MERCADOPAGO_TOKEN] },
  async (req, res) => {
    try {
      const platformToken = MERCADOPAGO_TOKEN.value();
      if (!platformToken) {
        res.status(200).send("ok");
        return;
      }

      const q: any = req.query;
      const b: any = req.body;

      const paymentId: string | undefined =
        (q?.["data.id"] as string | undefined) ||
        (q?.id as string | undefined) ||
        (b?.data?.id ? String(b.data.id) : undefined) ||
        (b?.id ? String(b.id) : undefined);

      const topicOrType = String(q?.topic ?? q?.type ?? b?.type ?? b?.topic ?? "")
        .toLowerCase()
        .trim();

      logger.info("mpWebhook hit", {
        method: req.method,
        topicOrType,
        paymentId: paymentId ?? null,
      });

      if (!paymentId) {
        res.status(200).send("ok");
        return;
      }

      // 1) tenta achar reserva por mpPaymentId
      const reservaPorPaymentSnap = await db
        .collection("reservas")
        .where("mpPaymentId", "==", String(paymentId))
        .limit(1)
        .get();

      let accessTokenParaConsulta = platformToken;
      let reservaDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;

      if (!reservaPorPaymentSnap.empty) {
        reservaDoc = reservaPorPaymentSnap.docs[0];

        const r = reservaDoc.data() as any;
        const donoUid = String(r?.donoUid ?? "").trim();

        if (donoUid) {
          const donoSnap = await db.collection("users").doc(donoUid).get();
          const donoData = donoSnap.exists ? (donoSnap.data() as any) : null;
          const mpAccessTokenDono = String(donoData?.mpAccessToken ?? "").trim();

          if (mpAccessTokenDono) {
            accessTokenParaConsulta = mpAccessTokenDono;
          }
        }
      }

      // 2) consulta pagamento com o token correto
      const pr = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { Authorization: `Bearer ${accessTokenParaConsulta}` },
      });

      const payment: any = await pr.json();

      if (!pr.ok) {
        logger.error("MP get payment error:", payment);
        res.status(200).send("ok");
        return;
      }

      const externalRef = String(payment?.external_reference ?? "");
      const status = String(payment?.status ?? "").toLowerCase();
      const transactionAmount = payment?.transaction_amount ?? null;

      logger.info("mpWebhook payment fetched", {
        paymentId,
        externalRef,
        status,
        transactionAmount,
      });

      // multa continua igual
      if (externalRef.startsWith("multa-")) {
        const uid = externalRef.replace("multa-", "").trim();
        if (!uid) {
          res.status(200).send("ok");
          return;
        }

        const multaRef = db.collection("multas").doc(uid);
        const patch: any = {
          mpPaymentId: String(paymentId),
          mpStatus: status || null,
          mpUltimaNotificacaoEm: admin.firestore.FieldValue.serverTimestamp(),
        };

        if (status === "approved") {
          const nowTs = admin.firestore.FieldValue.serverTimestamp();

          patch.status = "pago";
          patch.pagoEm = nowTs;
          patch.valorPago = transactionAmount;

          await db.collection("users").doc(uid).set(
            {
              multaPendenteCentavos: 0,
              multaQuitadaEm: nowTs,
              suspensoAte: null,
              suspensoMotivo: null,
              noshowCount90d: 0,
              multaUltimaGeradaEm: null,
              penalidadesResetadasEm: nowTs,
              reputacao: {
                score: 100,
                nivel: "excelente",
                updatedAt: nowTs,
              },
              penalidades: {
                noShows: 0,
                cancelamentosUltimaHora: 0,
                penalidadesAtualizadoEm: nowTs,
              },
            },
            { merge: true }
          );
        } else {
          patch.status = "pendente";
        }

        await multaRef.set(patch, { merge: true });
        res.status(200).send("ok");
        return;
      }

      // 3) usa a reserva já encontrada por mpPaymentId, se tiver
      let reservaRef: FirebaseFirestore.DocumentReference | null = null;
      let r: any = null;

      if (reservaDoc) {
        reservaRef = reservaDoc.ref;
        r = reservaDoc.data();
      } else if (externalRef) {
        reservaRef = db.collection("reservas").doc(externalRef);
        const snap = await reservaRef.get();
        if (!snap.exists) {
          logger.warn("Reserva não encontrada para external_reference", { externalRef });
          res.status(200).send("ok");
          return;
        }
        r = snap.data() as any;
      } else {
        res.status(200).send("ok");
        return;
      }

      const statusReservaAtual = String(r?.status ?? "").toLowerCase();
      const pagamentoStatusAtual = String(r?.pagamentoStatus ?? "").toLowerCase();
      const canceladaMotivoAtual = String(r?.canceladaMotivo ?? "").toLowerCase();

      const patch: any = {
        mpPaymentId: String(paymentId),
        mpStatus: status || null,
        mpUltimaNotificacaoEm: admin.firestore.FieldValue.serverTimestamp(),
        mpWebhookUltimoPayload: {
          receivedAt: admin.firestore.FieldValue.serverTimestamp(),
          topicOrType,
          paymentId: String(paymentId),
          status: status || null,
        },
      };

      if (pagamentoStatusAtual === "pago") {
        res.status(200).send("ok");
        return;
      }

      if (
        statusReservaAtual === "cancelada" &&
        canceladaMotivoAtual === "pix_expirado"
      ) {
        patch.pagamentoStatus = "expirado";
        await reservaRef!.update(patch);
        res.status(200).send("ok");
        return;
      }

      if (status === "approved" || status === "accredited") {
        patch.status = "confirmada";
        patch.pagamentoStatus = "pago";
        patch.pagoEm = admin.firestore.FieldValue.serverTimestamp();
        patch.valorPago = transactionAmount;
        patch.registradoPorUid = null;
        patch.statusRepasse = "repassado";
        patch.repassadoEm = admin.firestore.FieldValue.serverTimestamp();
      } else if (status === "cancelled" || status === "rejected") {
        patch.pagamentoStatus = "cancelado";
      } else if (status === "expired") {
        patch.pagamentoStatus = "expirado";
      } else {
        patch.pagamentoStatus = "pendente";
      }

      await reservaRef!.update(patch);

      res.status(200).send("ok");
      return;
    } catch (e) {
      logger.error("mpWebhook error:", e);
      res.status(200).send("ok");
      return;
    }
  }
);

/* =======================
   4) DEV ONLY: Simula approved
======================= */

export const devApprovePix = onCall(
  { region: "us-central1" },
  async (req: CallableRequest<{ reservaId?: string; valorPago?: number }>) => {
    const uid = requireAuth(req);

    const reservaId = String(req.data?.reservaId ?? "").trim();
    if (!reservaId) throw new HttpsError("invalid-argument", "reservaId é obrigatório.");


    await requireCeoOrOwnerOfReserva(uid, reservaId);

    const reservaRef = db.collection("reservas").doc(reservaId);
    const snap = await reservaRef.get();
    if (!snap.exists) throw new HttpsError("not-found", "Reserva não encontrada.");

    const r = snap.data() as any;

    if (String(r.pagamentoTipo ?? "") !== "online") {
      throw new HttpsError("failed-precondition", "Essa reserva não é online/PIX.");
    }

    const valor = Number(req.data?.valorPago ?? r.valor ?? r.preco ?? r.valorHora ?? 0) || null;

await reservaRef.update({
  status: "confirmada",
  mpStatus: "approved",
  pagamentoStatus: "pago",
  pagoEm: admin.firestore.FieldValue.serverTimestamp(),
  valorPago: valor,
  mpUltimaNotificacaoEm: admin.firestore.FieldValue.serverTimestamp(),
  mpAprovadoEmDev: true,
  mpAprovadoPorUid: uid,
  statusRepasse: "repassado",
  repassadoEm: admin.firestore.FieldValue.serverTimestamp(),
});

    return { ok: true, reservaId, valorPago: valor };
  }
);

/* =======================
   5) BACKFILL FINANCEIRO
======================= */

function toNumber(v: any): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function reaisParaCentavosSafe(valorReais: any): number | null {
  const n = toNumber(valorReais);
  if (n === null) return null;
  return Math.round(n * 100);
}

function pickValorTotalCentavosFromReserva(data: any): number | null {
  const vtc = toNumber(data?.valorTotalCentavos);
  if (vtc !== null) return Math.round(vtc);

  const candidatosReais = [
    data?.valorTotal,
    data?.valor,
    data?.preco,
    data?.price,
    data?.valorReais,
    data?.precoReais,
    data?.valorHora,
  ];

  for (const c of candidatosReais) {
    const cent = reaisParaCentavosSafe(c);
    if (cent !== null) return cent;
  }

  return null;
}

function percentToFeeCentavos(totalCentavos: number, percent: number): number {
  return Math.round((totalCentavos * percent) / 100);
}

export const backfillFinanceiroReservas = onRequest(
  { region: "us-central1", secrets: [BACKFILL_KEY] },
  async (req, res) => {
    try {
      if (req.method !== "POST") {
        res.status(405).json({ ok: false, error: "Use POST" });
        return;
      }

      const key = req.header("x-backfill-key");
      if (!key || key !== BACKFILL_KEY.value()) {
        res.status(401).json({ ok: false, error: "Unauthorized" });
        return;
      }

      const quadraId = (req.body?.quadraId ?? "").toString().trim() || null;
      const limit = Math.min(Math.max(Number(req.body?.limit ?? 500), 1), 2000);
      const dryRun = Boolean(req.body?.dryRun ?? false);

      let q = db.collection("reservas") as FirebaseFirestore.Query;
      if (quadraId) q = q.where("quadraId", "==", quadraId);
      q = q.orderBy("createdAt", "desc").limit(limit);

      const snap = await q.get();

      const quadraCache = new Map<string, { comissaoPercentual: number }>();

      let analisadas = 0;
      let puladasJaTinha = 0;
      let semValor = 0;
      let atualizadas = 0;

      let batch = db.batch();
      let batchOps = 0;

      for (const docSnap of snap.docs) {
        analisadas++;
        const data = docSnap.data();

        if (data?.valorTotalCentavos !== undefined && data?.valorTotalCentavos !== null) {
          puladasJaTinha++;
          continue;
        }

        const totalCentavos = pickValorTotalCentavosFromReserva(data);
        if (totalCentavos === null) {
          semValor++;
          continue;
        }

        const qid = (data?.quadraId ?? "").toString().trim();
        let comissaoPercentual = 5;

        if (qid) {
          const cached = quadraCache.get(qid);
          if (cached) {
            comissaoPercentual = cached.comissaoPercentual;
          } else {
            const quadraDoc = await db.collection("quadras").doc(qid).get();
            const qData = quadraDoc.exists ? quadraDoc.data() : null;
            const c = toNumber((qData as any)?.comissaoPercentual);
            comissaoPercentual = c !== null ? c : 5;
            quadraCache.set(qid, { comissaoPercentual });
          }
        }

        const valorPlataformaCentavos = percentToFeeCentavos(totalCentavos, comissaoPercentual);
        const valorDonoCentavos = totalCentavos - valorPlataformaCentavos;

        const patch = {
          politicaVersao: "v1",
          motivoPolitica: "normal",
          comissaoPercentualAplicada: comissaoPercentual,
          valorTotalCentavos: totalCentavos,
          valorPlataformaCentavos,
          valorDonoCentavos,
          valorClienteCentavos: 0,
          calculadoEm: admin.firestore.FieldValue.serverTimestamp(),
        };

        if (!dryRun) {
          batch.update(docSnap.ref, patch);
          batchOps++;
          if (batchOps >= 450) {
            await batch.commit();
            batch = db.batch();
            batchOps = 0;
          }
        }

        atualizadas++;
      }

      if (!dryRun && batchOps > 0) await batch.commit();

      res.json({
        ok: true,
        quadraId,
        limit,
        dryRun,
        analisadas,
        puladasJaTinha,
        semValor,
        atualizadas,
      });
    } catch (e: any) {
      logger.error("backfillFinanceiroReservas error:", e);
      res.status(500).json({ ok: false, error: e?.message ?? String(e) });
    }
  }
);

/* =======================
   6) BACKFILL REPASSE
======================= */

export const backfillRepasseReservas = onRequest(
  { region: "us-central1", secrets: [BACKFILL_KEY] },
  async (req, res) => {
    try {
      if (req.method !== "POST") {
        res.status(405).json({ ok: false, error: "Use POST" });
        return;
      }

      const key = req.header("x-backfill-key");
      if (!key || key !== BACKFILL_KEY.value()) {
        res.status(401).json({ ok: false, error: "Unauthorized" });
        return;
      }

      const quadraId = (req.body?.quadraId ?? "").toString().trim() || null;
      const limit = Math.min(Math.max(Number(req.body?.limit ?? 500), 1), 2000);
      const dryRun = Boolean(req.body?.dryRun ?? false);

      let q = db.collection("reservas") as FirebaseFirestore.Query;
      if (quadraId) q = q.where("quadraId", "==", quadraId);

      q = q.where("pagamentoStatus", "==", "pago").orderBy("createdAt", "desc").limit(limit);

      const snap = await q.get();

      let analisadas = 0;
      let puladasJaTinha = 0;
      let atualizadas = 0;

      let batch = db.batch();
      let batchOps = 0;

      for (const docSnap of snap.docs) {
        analisadas++;
        const data = docSnap.data() as any;

        if (data?.statusRepasse) {
          puladasJaTinha++;
          continue;
        }

        const pagoEm = data?.pagoEm ?? null;

        const patch: any = {
          statusRepasse: "repassado",
          repassadoEm: pagoEm ? pagoEm : admin.firestore.FieldValue.serverTimestamp(),
        };

        if (!dryRun) {
          batch.update(docSnap.ref, patch);
          batchOps++;
          if (batchOps >= 450) {
            await batch.commit();
            batch = db.batch();
            batchOps = 0;
          }
        }

        atualizadas++;
      }

      if (!dryRun && batchOps > 0) await batch.commit();

      res.json({ ok: true, quadraId, limit, dryRun, analisadas, puladasJaTinha, atualizadas });
    } catch (e: any) {
      logger.error("backfillRepasseReservas error:", e);
      res.status(500).json({ ok: false, error: e?.message ?? String(e) });
    }
  }
);

export const processarReembolsoReserva = onCall(
  { region: "us-central1", secrets: [MERCADOPAGO_TOKEN] },
  async (req: CallableRequest<{ reservaId?: string }>) => {
    const uid = requireAuth(req);

    const reservaId = String(req.data?.reservaId ?? "").trim();
    if (!reservaId) {
      throw new HttpsError("invalid-argument", "reservaId é obrigatório.");
    }

    const reservaRef = db.collection("reservas").doc(reservaId);
    const snap = await reservaRef.get();

    if (!snap.exists) {
      throw new HttpsError("not-found", "Reserva não encontrada.");
    }

    const r = snap.data() as any;
        const clienteUid = String(r.clienteUid ?? "");

    const userSnap = await db.collection("users").doc(uid).get();
    const userData = userSnap.exists ? (userSnap.data() as any) : null;
    const role = String(userData?.role ?? "").trim().toLowerCase();

    if (clienteUid !== uid) {
      if (role === "ceo") {
        // ok
      } else if (role === "dono") {
        await requireCeoOrOwnerOfReserva(uid, reservaId);
      } else {
        throw new HttpsError(
          "permission-denied",
          "Você não tem permissão para processar este reembolso."
        );
      }
    }

    if (String(r.reembolsoStatus ?? "") === "feito") {
      return {
        ok: true,
        jaProcessado: true,
        refundId: r.refundId ?? null,
        valorReembolsoCentavos: Number(r.reembolsoValorCentavos ?? 0),
      };
    }

    if (String(r.reembolsoStatus ?? "") === "pendente") {
      throw new HttpsError(
        "failed-precondition",
        "Este reembolso já está em processamento."
      );
    }

    const mpPaymentId = String(r.mpPaymentId ?? "");
    const valorReembolsoCentavos = Number(r.valorClienteCentavos ?? 0);
    const clienteUidReserva = String(r.clienteUid ?? "");

    if (valorReembolsoCentavos <= 0) {
      await reservaRef.update({
        reembolsoStatus: "credito",
        reembolsoValorCentavos: 0,
        reembolsadoEm: admin.firestore.FieldValue.serverTimestamp(),
      });

      return { ok: true, tipo: "credito_zero" };
    }

    if (!mpPaymentId) {
      if (!clienteUidReserva) {
        throw new HttpsError(
          "failed-precondition",
          "Reserva sem clienteUid para crédito interno."
        );
      }

      await db.collection("users").doc(clienteUidReserva).set(
        {
          walletCentavos: admin.firestore.FieldValue.increment(valorReembolsoCentavos),
          walletAtualizadaEm: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      await reservaRef.update({
        reembolsoStatus: "credito",
        reembolsoValorCentavos: valorReembolsoCentavos,
        reembolsadoEm: admin.firestore.FieldValue.serverTimestamp(),
        reembolsoErro: null,
      });

      return {
        ok: true,
        tipo: "wallet",
        valorCentavos: valorReembolsoCentavos,
      };
    }

    await reservaRef.update({
      reembolsoStatus: "pendente",
      reembolsoValorCentavos: valorReembolsoCentavos,
    });

    const MP_TOKEN = MERCADOPAGO_TOKEN.value();
    if (!MP_TOKEN) {
      await reservaRef.update({
        reembolsoStatus: "falhou",
        reembolsoErro: "Secret MERCADOPAGO_TOKEN não configurada.",
      });
      throw new HttpsError(
        "failed-precondition",
        "Secret MERCADOPAGO_TOKEN não configurada."
      );
    }

    const valorReais = valorReembolsoCentavos / 100;

    const resp = await fetch(
      `https://api.mercadopago.com/v1/payments/${mpPaymentId}/refunds`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${MP_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: valorReais,
        }),
      }
    );

    const refund = await resp.json();

    if (!resp.ok) {
      await reservaRef.update({
        reembolsoStatus: "falhou",
        reembolsoErro: refund,
      });

      throw new HttpsError("internal", "Falha ao processar reembolso.");
    }

    await reservaRef.update({
      reembolsoStatus: "feito",
      refundId: String(refund?.id ?? ""),
      reembolsoValorCentavos: valorReembolsoCentavos,
      reembolsadoEm: admin.firestore.FieldValue.serverTimestamp(),
      reembolsoErro: null,
    });

    return {
      ok: true,
      refundId: String(refund?.id ?? ""),
      valorReais,
    };
  }
);

/* =======================
   7) CPF: Verificar e vincular CPF ao user (1 conta = 1 CPF)
======================= */

function onlyDigits(s: string) {
  return String(s ?? "").replace(/\D/g, "");
}

function isCpfValid(cpfRaw: string) {
  const cpf = onlyDigits(cpfRaw);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const nums = cpf.split("").map((c) => parseInt(c, 10));

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += nums[i] * (10 - i);
  let d1 = (sum * 10) % 11;
  if (d1 === 10) d1 = 0;
  if (d1 !== nums[9]) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += nums[i] * (11 - i);
  let d2 = (sum * 10) % 11;
  if (d2 === 10) d2 = 0;
  if (d2 !== nums[10]) return false;

  return true;
}

function sha256Hex(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export const verifyAndBindCpf = onCall(
  { region: "us-central1" },
  async (req: CallableRequest<{ cpf?: string; consent?: boolean }>) => {
    const uid = requireAuth(req);

    const cpf = String(req.data?.cpf ?? "").trim();
    const consent = Boolean(req.data?.consent ?? false);

    if (!consent) {
      throw new HttpsError(
        "failed-precondition",
        "Você precisa autorizar o uso do CPF para validação de identidade e prevenção de fraude."
      );
    }

    if (!cpf) throw new HttpsError("invalid-argument", "CPF é obrigatório.");
    if (!isCpfValid(cpf)) throw new HttpsError("invalid-argument", "CPF inválido.");

    const cpfDigits = onlyDigits(cpf);
    const cpfHash = sha256Hex(cpfDigits);
    const cpfUltimos4 = cpfDigits.slice(-4);

    const userRef = db.collection("users").doc(uid);
    const userSnap = await userRef.get();
    const userData = userSnap.exists ? (userSnap.data() as any) : null;

    if (userData?.cpfHash && userData.cpfHash === cpfHash) {
  return { ok: true, alreadyBound: true, cpfUltimos4: String(userData?.cpfUltimos4 ?? "****") };
}

    const dupSnap = await db.collection("users").where("cpfHash", "==", cpfHash).limit(1).get();
    if (!dupSnap.empty) {
      const otherUid = dupSnap.docs[0].id;
      if (otherUid !== uid) throw new HttpsError("already-exists", "Este CPF já está vinculado a outra conta.");
    }

    await userRef.set(
      {
        cpfHash,
        cpfUltimos4,
        cpfConsentidoEm: admin.firestore.FieldValue.serverTimestamp(),
        cpfVerificadoEm: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return { ok: true, alreadyBound: false, cpfUltimos4 };
  }
);

/* =======================
   8) Penalidades automáticas (NO-SHOW) — Janela 90 dias
======================= */

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function calcNivel(score: number) {
  if (score >= 90) return "excelente";
  if (score >= 75) return "bom";
  if (score >= 60) return "regular";
  return "ruim";
}

function daysAgoTs(days: number) {
  const ms = days * 24 * 60 * 60 * 1000;
  return admin.firestore.Timestamp.fromMillis(Date.now() - ms);
}

function toCentavosFromReais(reais: any) {
  const v = Number(reais ?? 0);
  return Math.round(v * 100);
}

async function recomputeUserNoShowState(clienteUid: string) {
  const userRef = db.collection("users").doc(clienteUid);
  const userSnap = await userRef.get();
  const userData = userSnap.exists ? (userSnap.data() as any) : {};

  const resetTs = userData?.penalidadesResetadasEm ?? null;
  const since90d = daysAgoTs(90);

  const q = db
    .collection("infractions")
    .where("uid", "==", clienteUid)
    .where("type", "==", "noshow")
    .where("createdAt", ">=", since90d)
    .orderBy("createdAt", "asc");

  const snap = await q.get();

  const docs = snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as any) }))
    .filter((d: any) => {
      if (!resetTs || typeof resetTs?.toMillis !== "function") return true;

      const createdAt = d?.createdAt;
      if (!createdAt || typeof createdAt?.toMillis !== "function") return false;

      return createdAt.toMillis() >= resetTs.toMillis();
    });

  const count90d = docs.length;

  // ✅ Regra oficial Quadra Play:
  // 3 no-shows ativos em 90 dias => bloqueia até pagar multa fixa de R$ 20
  const deveBloquear = count90d >= 3;
  const multaFixaCentavos = deveBloquear ? 2000 : 0;

  const score = clamp(100 - count90d * 10, 0, 100);
  const nivel = calcNivel(score);

  const nowTs = admin.firestore.FieldValue.serverTimestamp();

  const patch: any = {
    noshowCount90d: count90d,

    reputacao: {
      score,
      nivel,
      updatedAt: nowTs,
    },

    penalidades: {
      ...(userData?.penalidades ?? {}),
      noShows: count90d,
      penalidadesAtualizadoEm: nowTs,
    },

    multaPendenteCentavos: multaFixaCentavos,
    multaUltimaGeradaEm: deveBloquear ? nowTs : null,
  };

  if (deveBloquear) {
    patch.suspensoAte = admin.firestore.Timestamp.fromMillis(
      Date.now() + 1000 * 60 * 60 * 24 * 365 * 10
    );
    patch.suspensoMotivo = "noshow_3_90d_multa_pendente";
  } else {
    patch.suspensoAte = null;
    patch.suspensoMotivo = null;
  }

  await userRef.set(patch, { merge: true });
}

export const onReservaNoShowPenalty = onDocumentUpdated(
  { region: "us-central1", document: "reservas/{reservaId}" },
  async (event) => {
    try {
      const before = event.data?.before?.data() as any;
      const after = event.data?.after?.data() as any;
      if (!before || !after) return;

      const reservaId = String(event.params.reservaId ?? "");
      const clienteUid = String(after?.clienteUid ?? "");
      if (!reservaId || !clienteUid) return;

      const beforeNoShow = Boolean(before?.naoCompareceu);
      const afterNoShow = Boolean(after?.naoCompareceu);
      if (beforeNoShow === afterNoShow) return;

      const infRef = db.collection("infractions");

      const existing = await infRef
        .where("uid", "==", clienteUid)
        .where("type", "==", "noshow")
        .where("reservaId", "==", reservaId)
        .limit(5)
        .get();

      if (beforeNoShow === false && afterNoShow === true) {
        if (existing.empty) {
          const valorBaseReais = Number(after?.valorPago ?? after?.valor ?? 0) || 0;
          const valorBaseCentavos = toCentavosFromReais(valorBaseReais);
          const multaCentavos = Math.round(valorBaseCentavos * 0.05);

          await infRef.add({
            uid: clienteUid,
            type: "noshow",
            reservaId,
            quadraId: String(after?.quadraId ?? ""),
            valorBaseCentavos,
            multaGeradaCentavos: multaCentavos,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }

        await recomputeUserNoShowState(clienteUid);
        return;
      }

      if (beforeNoShow === true && afterNoShow === false) {
        if (!existing.empty) {
          const batch = db.batch();
          for (const d of existing.docs) batch.delete(d.ref);
          await batch.commit();
        }

        await recomputeUserNoShowState(clienteUid);
        return;
      }
    } catch (e) {
      logger.error("onReservaNoShowPenalty error", e);
      return;
    }
  }
);
export const autoMarcarPagamentoPresencial = onSchedule(
  {
    region: "us-central1",
    schedule: "every 10 minutes",
    timeZone: "America/Sao_Paulo",
  },
  async () => {
    try {
      const agoraMs = Date.now();

      // olha só reservas recentes para não varrer histórico inteiro
      const d = new Date(agoraMs - 1000 * 60 * 60 * 24 * 2); // últimos 2 dias
      const desdeISO = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate()
      ).padStart(2, "0")}`;

      const snap = await db
        .collection("reservas")
        .where("pagamentoTipo", "==", "presencial")
        .where("pagamentoStatus", "in", ["pendente", "pago"])
        .where("data", ">=", desdeISO)
        .get();

      if (snap.empty) {
        logger.info("autoMarcarPagamentoPresencial: nenhuma reserva pendente encontrada.");
        return;
      }

      let batch = db.batch();
      let ops = 0;
      let atualizadas = 0;

      for (const docSnap of snap.docs) {
        const r = docSnap.data() as any;

        const status = String(r?.status ?? "");
        if (status !== "confirmada" && status !== "agendada" && status !== "finalizada") {
          continue;
        }

        // se já foi marcado no-show, não auto paga
        if (Boolean(r?.naoCompareceu)) {
          continue;
        }

        const data = String(r?.data ?? "");
        const horaFim = String(r?.horaFim ?? "");
        if (!data || !horaFim) continue;

        let endAt: admin.firestore.Timestamp | null = null;

        if (r?.endAt && typeof r.endAt?.toMillis === "function") {
          endAt = r.endAt as admin.firestore.Timestamp;
        } else {
          const [y, mo, d2] = data.split("-").map(Number);
          const [hh, mm] = horaFim.split(":").map(Number);
          if (!y || !mo || !d2) continue;

          const js = new Date(y, mo - 1, d2, hh || 0, mm || 0, 0, 0);
          endAt = admin.firestore.Timestamp.fromDate(js);
        }

        // regra oficial: horaFim + 20 min
        const liberarPagamentoMs = endAt.toMillis() + 20 * 60 * 1000;
        if (agoraMs < liberarPagamentoMs) {
          continue;
        }

        const valor = Number(r?.valorPago ?? r?.valor ?? 0);
        if (!Number.isFinite(valor) || valor <= 0) {
          continue;
        }

      // comissão da quadra com trial grátis de 30 dias
let comissaoPercentual = 5;
const quadraId = String(r?.quadraId ?? "").trim();

if (quadraId) {
  const quadraSnap = await db.collection("quadras").doc(quadraId).get();
  const quadraData = quadraSnap.exists ? (quadraSnap.data() as any) : null;

  const donoUid = String(quadraData?.ownerId ?? quadraData?.ownerUid ?? "").trim();

  let trialAtivo = false;

  if (donoUid) {
    const donoSnap = await db.collection("users").doc(donoUid).get();
    const donoData = donoSnap.exists ? (donoSnap.data() as any) : null;

    const trialGratisAte = donoData?.trialGratisAte ?? null;
    trialAtivo =
      trialGratisAte &&
      typeof trialGratisAte?.toMillis === "function" &&
      trialGratisAte.toMillis() > Date.now();
  }

  if (trialAtivo) {
    comissaoPercentual = 0;
  } else {
    const raw = Number(quadraData?.comissaoPercentual ?? 5);
    if (Number.isFinite(raw)) {
      comissaoPercentual = Math.max(0, Math.min(100, raw));
    }
  }
}

        const financeiro = calcularFinanceiroV1({
          valorTotalCentavos: asCentavos(valor),
          comissaoPercentual,
          motivoPolitica: "normal",
        });

        batch.update(docSnap.ref, {
          pagamentoStatus: "pago",
          pagoEm: admin.firestore.FieldValue.serverTimestamp(),
          valorPago: valor,
          registradoPorUid: null,

          politicaVersao: "v1",
          motivoPolitica: "normal",
          comissaoPercentualAplicada: comissaoPercentual,
          ...financeiro,
          calculadoEm: admin.firestore.FieldValue.serverTimestamp(),

          autoPagoPresencialEm: admin.firestore.FieldValue.serverTimestamp(),
        });

        ops++;
        atualizadas++;

        if (ops >= 400) {
          await batch.commit();
          batch = db.batch();
          ops = 0;
        }
      }

      if (ops > 0) {
        await batch.commit();
      }

      logger.info("autoMarcarPagamentoPresencial finalizado", { atualizadas });
    } catch (e) {
      logger.error("autoMarcarPagamentoPresencial error", e);
    }
  }
);

export const createReservaSegura = onCall(
  { region: "us-central1" },
  async (
    req: CallableRequest<{
      disponibilidadeId?: string;
      nomeCliente?: string;
      telefoneCliente?: string;
      pagamentoTipo?: "presencial" | "pix";
    }>
  ) => {
    const uid = requireAuth(req);

    const disponibilidadeId = String(req.data?.disponibilidadeId ?? "").trim();
    const nomeCliente = String(req.data?.nomeCliente ?? "").trim();
    const telefoneCliente = String(req.data?.telefoneCliente ?? "").trim();
    const pagamentoTipoApp = (req.data?.pagamentoTipo ?? "presencial") as "presencial" | "pix";
    const pagamentoTipo = pagamentoTipoApp === "pix" ? "online" : "presencial";

    const telDigits = telefoneCliente.replace(/\D/g, "");
    if (!telDigits || !(telDigits.length === 10 || telDigits.length === 11)) {
      throw new HttpsError(
        "invalid-argument",
        "Informe um telefone válido com DDD (10 ou 11 dígitos)."
      );
    }

    if (!disponibilidadeId) {
      throw new HttpsError("invalid-argument", "disponibilidadeId inválido.");
    }
    if (!nomeCliente) {
      throw new HttpsError("invalid-argument", "Informe seu nome.");
    }
    if (!telefoneCliente) {
      throw new HttpsError("invalid-argument", "Informe seu telefone para contato.");
    }

    await requireNotSuspended(uid);

    const dispRef = db.collection("disponibilidades").doc(disponibilidadeId);
    const reservaRef = db.collection("reservas").doc();
    const MAX_RESERVAS_DIA = 3;
    const userSnap = await db.collection("users").doc(uid).get();
const userData = userSnap.exists ? (userSnap.data() as any) : null;
const isDonoOuCeo = userData?.role === "dono" || userData?.role === "ceo";

const primeiraReservaDescontoUsado = userData?.primeiraReservaDescontoUsado === true;
const atletaPrimeiraReservaComDesconto =
  userData?.role === "atleta" && !primeiraReservaDescontoUsado;

    const dispSnapPreview = await dispRef.get();
    if (!dispSnapPreview.exists) {
      throw new HttpsError("not-found", "Horário não encontrado.");
    }

    const dispPreview = dispSnapPreview.data() as any;
    const dataPreview = String(dispPreview?.data ?? "");
    const horaInicioPreview = String(dispPreview?.horaInicio ?? "");

    if (!dataPreview || !horaInicioPreview) {
      throw new HttpsError("failed-precondition", "Slot inválido.");
    }

    const previewStartAtMs =
      dispPreview?.startAt && typeof dispPreview.startAt?.toMillis === "function"
        ? dispPreview.startAt.toMillis()
        : (() => {
            const iso = `${dataPreview}T${horaInicioPreview}:00-03:00`;
            const ms = new Date(iso).getTime();
            return Number.isFinite(ms) ? ms : null;
          })();

    if (previewStartAtMs === null) {
      throw new HttpsError("failed-precondition", "Slot inválido.");
    }

    if (previewStartAtMs <= Date.now()) {
      throw new HttpsError("failed-precondition", "Este horário já passou.");
    }

    const reservasDoDiaSnap = await db
      .collection("reservas")
      .where("clienteUid", "==", uid)
      .where("data", "==", dataPreview)
      .where("status", "in", ["confirmada", "agendada"])
      .get();

    const agoraMs = Date.now();

    const reservasAtivasReais = reservasDoDiaSnap.docs.filter((docSnap) => {
      const r = docSnap.data() as any;

      let endAtMs: number | null = null;

      if (r?.endAt && typeof r.endAt?.toMillis === "function") {
        endAtMs = r.endAt.toMillis();
      } else {
        const data = String(r?.data ?? "");
        const horaFim = String(r?.horaFim ?? "");
        if (!data || !horaFim) return true;

        const [y, mo, d] = data.split("-").map(Number);
        const [hh, mm] = horaFim.split(":").map(Number);
        if (!y || !mo || !d) return true;

        endAtMs = new Date(y, mo - 1, d, hh || 0, mm || 0, 0, 0).getTime();
      }

      return endAtMs !== null && endAtMs > agoraMs;
    });

    const ativasHojeReais = reservasAtivasReais.length;

    if (!isDonoOuCeo && ativasHojeReais >= MAX_RESERVAS_DIA) {
  throw new HttpsError("failed-precondition", "Você já atingiu o limite de 3 reservas hoje.");
}

    await db.runTransaction(async (tx) => {
      const dispSnap = await tx.get(dispRef);
      if (!dispSnap.exists) {
        throw new HttpsError("not-found", "Horário não encontrado.");
      }

      const disp = dispSnap.data() as any;

      if (disp.ativo === false) {
        throw new HttpsError("failed-precondition", "Horário indisponível.");
      }
      if (disp.bloqueado === true) {
        throw new HttpsError("failed-precondition", "Horário bloqueado.");
      }
      if (disp.reservadoPorUid) {
        throw new HttpsError("failed-precondition", "Horário já reservado.");
      }

      const data = String(disp.data ?? "");
      const horaInicio = String(disp.horaInicio ?? "");
      const horaFim = String(disp.horaFim ?? "");

      const promocaoAtiva = disp.promocaoAtiva === true;
      const valorBase = Number(disp.valor ?? 0);
      const valorPromo = Number(disp.valorPromocional ?? 0);

    let valor =
  promocaoAtiva && valorPromo > 0
    ? valorPromo
    : valorBase;

// ✅ DESCONTO PRIMEIRA RESERVA
if (atletaPrimeiraReservaComDesconto) {
  valor = Number((valor * 0.95).toFixed(2));
}

      if (!data || !horaInicio || !horaFim) {
        throw new HttpsError("failed-precondition", "Slot inválido.");
      }

      const quadraId = String(disp.quadraId ?? "").trim();
      if (!quadraId) {
        throw new HttpsError("failed-precondition", "Slot inválido (sem quadraId).");
      }

      const quadraRef = db.collection("quadras").doc(quadraId);
      const quadraSnap = await tx.get(quadraRef);
      if (!quadraSnap.exists) {
        throw new HttpsError("failed-precondition", "Quadra não encontrada.");
      }

      const quadraData = quadraSnap.data() as any;
const donoUid = String(quadraData?.ownerId ?? quadraData?.ownerUid ?? "").trim();
if (!donoUid) {
  throw new HttpsError("failed-precondition", "Quadra sem ownerId.");
}

const donoRef = db.collection("users").doc(donoUid);
const donoSnap = await tx.get(donoRef);
const donoData = donoSnap.exists ? (donoSnap.data() as any) : null;

const trialGratisAte = donoData?.trialGratisAte ?? null;
const trialAtivo =
  trialGratisAte &&
  typeof trialGratisAte?.toMillis === "function" &&
  trialGratisAte.toMillis() > Date.now();

const comissaoPercentual = trialAtivo
  ? 0
  : Math.max(
      0,
      Math.min(100, Number(quadraData?.comissaoPercentual ?? disp?.comissaoPercentual ?? 5))
    );

      const financeiro = calcularFinanceiroV1({
        valorTotalCentavos: asCentavos(valor),
        comissaoPercentual,
        motivoPolitica: "normal",
      });

      const startAt =
        disp.startAt ??
        admin.firestore.Timestamp.fromDate(
          new Date(
            ...(() => {
              const [y, mo, d] = data.split("-").map(Number);
              const [hh, mm] = horaInicio.split(":").map(Number);
              return [y, mo - 1, d, hh || 0, mm || 0, 0, 0] as const;
            })()
          )
        );

      const endAt =
        disp.endAt ??
        admin.firestore.Timestamp.fromDate(
          new Date(
            ...(() => {
              const [y, mo, d] = data.split("-").map(Number);
              const [hh, mm] = horaFim.split(":").map(Number);
              return [y, mo - 1, d, hh || 0, mm || 0, 0, 0] as const;
            })()
          )
        );

      tx.set(reservaRef, {
        quadraId,
        donoUid,
        esporte: String(disp.esporte ?? ""),
        disponibilidadeId,
        data,
        horaInicio,
        horaFim,
        valor,

        status: "confirmada",

        startAt,
        endAt,

        clienteUid: uid,
        cliente: {
          nome: nomeCliente,
          telefone: telefoneCliente,
        },


        descontoAplicado: atletaPrimeiraReservaComDesconto,
        percentualDesconto: atletaPrimeiraReservaComDesconto ? 5 : 0,
        valorOriginal:
  promocaoAtiva && valorPromo > 0
    ? valorPromo
    : valorBase,
        pagamentoTipo,
        pagamentoStatus: "pendente",
        pagoEm: null,
        valorPago: null,
        registradoPorUid: null,

        politicaVersao: "v1",
        motivoPolitica: "normal",
        comissaoPercentualAplicada: comissaoPercentual,
        ...financeiro,
        calculadoEm: admin.firestore.FieldValue.serverTimestamp(),

        naoCompareceu: false,
        naoCompareceuMarcadoEm: null,
        naoCompareceuMarcadoPorUid: null,

        avaliadaEm: null,

        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        canceladaEm: null,

        finalizadaEm: null,
        finalizadaPorTipo: null,
        finalizadaPorUid: null,
      });


      tx.update(dispRef, {
        reservadoPorUid: uid,
        reservadoEm: admin.firestore.FieldValue.serverTimestamp(),
        ativo: false,
      });

      if (atletaPrimeiraReservaComDesconto) {
  const userRef = db.collection("users").doc(uid);
  tx.set(
    userRef,
    {
      primeiraReservaDescontoUsado: true,
    },
    { merge: true }
  );
}

      const limiteRef = db.collection("users").doc(uid).collection("limitesReservasDia").doc(data);
      tx.set(
        limiteRef,
        {
          ativas: ativasHojeReais + 1,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });

    return { ok: true, reservaId: reservaRef.id };
  }
);
export const autoCancelarPixExpirado = onSchedule(
  {
    region: "us-central1",
    schedule: "every 10 minutes",
    timeZone: "America/Sao_Paulo",
  },
  async () => {
    try {
      const agora = admin.firestore.Timestamp.now();

      const snap = await db
  .collection("reservas")
  .where("pagamentoTipo", "==", "online")
  .where("pagamentoStatus", "==", "pendente")
  .where("status", "==", "aguardando_pagamento")
  .get();

      if (snap.empty) {
        logger.info("autoCancelarPixExpirado: nenhuma reserva vencida encontrada.");
        return;
      }

      let batch = db.batch();
      let ops = 0;
      let canceladas = 0;

     for (const docSnap of snap.docs) {
  const r = docSnap.data() as any;

  const expiraPagamentoEm = r?.expiraPagamentoEm;
  const expirou =
    expiraPagamentoEm &&
    typeof expiraPagamentoEm.toMillis === "function" &&
    expiraPagamentoEm.toMillis() <= agora.toMillis();

  if (!expirou) continue;
        const disponibilidadeId = String(r?.disponibilidadeId ?? "").trim();

                batch.update(docSnap.ref, {
          status: "cancelada",
          pagamentoStatus: "expirado",
          mpStatus: "expired",
          canceladaEm: admin.firestore.FieldValue.serverTimestamp(),
          canceladaPorUid: null,
          motivoPolitica: "pix_expirado",
          canceladaPorSistema: true,
          canceladaMotivo: "pix_expirado",
          calculadoEm: admin.firestore.FieldValue.serverTimestamp(),
        });

        if (disponibilidadeId) {
          const dispRef = db.collection("disponibilidades").doc(disponibilidadeId);
          batch.update(dispRef, {
            ativo: true,
            reservadoPorUid: null,
            reservadoEm: null,
          });
        }

        ops++;
        canceladas++;

        if (ops >= 400) {
          await batch.commit();
          batch = db.batch();
          ops = 0;
        }
      }

      if (ops > 0) {
        await batch.commit();
      }

      logger.info("autoCancelarPixExpirado finalizado", { canceladas });
    } catch (e) {
      logger.error("autoCancelarPixExpirado error", e);
    }
  }
);
export const adicionarCredito = onCall(
  { region: "us-central1" },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "Usuário não autenticado.");
    }

    const valorCentavos = Number(req.data?.valorCentavos ?? 0);
    const tipo = String(req.data?.tipo ?? "saldo"); // saldo | bonus

    if (valorCentavos <= 0) {
      throw new HttpsError("invalid-argument", "Valor inválido.");
    }

    const userRef = db.collection("users").doc(uid);

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(userRef);
      if (!snap.exists) {
        throw new HttpsError("not-found", "Usuário não encontrado.");
      }

      const data = snap.data() as any;

      const saldoAtual = Number(data?.saldo ?? 0);
      const bonusAtual = Number(data?.saldoBonus ?? 0);

      if (tipo === "bonus") {
        tx.update(userRef, {
          saldoBonus: bonusAtual + valorCentavos,
        });
      } else {
        tx.update(userRef, {
          saldo: saldoAtual + valorCentavos,
        });
      }
    });

    return { ok: true };
  }
);
export const creditarSaldoCancelamentoDono = onCall(
  { region: "us-central1" },
  async (req) => {
    const uid = req.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "Usuário não autenticado.");
    }

    const reservaId = String(req.data?.reservaId ?? "").trim();
    if (!reservaId) {
      throw new HttpsError("invalid-argument", "reservaId inválido.");
    }

    const reservaRef = db.collection("reservas").doc(reservaId);

    await db.runTransaction(async (tx) => {
      const reservaSnap = await tx.get(reservaRef);
      if (!reservaSnap.exists) {
        throw new HttpsError("not-found", "Reserva não encontrada.");
      }

      const r = reservaSnap.data() as any;

      const status = String(r?.status ?? "");
      const clienteUid = String(r?.clienteUid ?? "");
      const canceladaPorUid = String(r?.canceladaPorUid ?? "");
      const valorClienteCentavos = Number(r?.valorClienteCentavos ?? 0);
      const motivoPolitica = String(r?.motivoPolitica ?? "");
      const creditoJaGerado = Boolean(r?.creditoCancelamentoGerado ?? false);

      if (status !== "cancelada") {
        throw new HttpsError(
          "failed-precondition",
          "A reserva precisa estar cancelada."
        );
      }

      if (!clienteUid) {
        throw new HttpsError(
          "failed-precondition",
          "Reserva sem clienteUid."
        );
      }

      if (creditoJaGerado) {
        return;
      }

      if (valorClienteCentavos <= 0) {
        throw new HttpsError(
          "failed-precondition",
          "Esta reserva não possui valor para creditar ao atleta."
        );
      }

      // segurança extra: crédito real só em cancelamento do dono
      const ehCancelamentoDono =
        motivoPolitica === "cancelamento_dono" ||
        (canceladaPorUid && canceladaPorUid !== clienteUid);

      if (!ehCancelamentoDono) {
        throw new HttpsError(
          "failed-precondition",
          "Crédito disponível apenas para cancelamento do dono."
        );
      }

      const userRef = db.collection("users").doc(clienteUid);
      const userSnap = await tx.get(userRef);

      if (!userSnap.exists) {
        throw new HttpsError("not-found", "Usuário do cliente não encontrado.");
      }

      const userData = userSnap.data() as any;
      const saldoAtual = Number(userData?.saldo ?? 0);

      tx.update(userRef, {
        saldo: saldoAtual + valorClienteCentavos,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      tx.update(reservaRef, {
        creditoCancelamentoGerado: true,
        creditoCancelamentoGeradoEm: admin.firestore.FieldValue.serverTimestamp(),
        creditoCancelamentoValorCentavos: valorClienteCentavos,
      });
    });

    return { ok: true };
  }
);
export const enviarEmailTeste = functions.https.onRequest(async (req, res) => {
  try {
  await resend.emails.send({
  from: "onboarding@resend.dev",
  to: "quadraplayoficial@gmail.com",
  subject: "Confirme seu e-mail no Quadra Play 🚀",
  html: `
    <div style="margin:0;padding:0;background:#f4f7fb;">
      <div style="max-width:600px;margin:0 auto;padding:32px 20px;">
        <div style="
          background:linear-gradient(135deg,#0f172a 0%,#1d4ed8 55%,#38bdf8 100%);
          border-radius:24px 24px 0 0;
          padding:32px 32px 28px 32px;
          color:#ffffff;
          font-family:Arial,Helvetica,sans-serif;
        ">
          <div style="
            display:inline-block;
            background:rgba(255,255,255,0.14);
            border:1px solid rgba(255,255,255,0.18);
            border-radius:999px;
            padding:8px 14px;
            font-size:12px;
            font-weight:700;
            letter-spacing:0.3px;
            margin-bottom:18px;
          ">
            QUADRA PLAY
          </div>

          <h1 style="
            margin:0;
            font-size:34px;
            line-height:1.1;
            font-weight:800;
          ">
            Sua conta está quase pronta.
          </h1>

          <p style="
            margin:16px 0 0 0;
            font-size:16px;
            line-height:1.7;
            color:rgba(255,255,255,0.92);
          ">
            Falta só confirmar seu e-mail para liberar sua experiência completa
            no Quadra Play.
          </p>
        </div>

        <div style="
          background:#ffffff;
          border:1px solid #e2e8f0;
          border-top:none;
          border-radius:0 0 24px 24px;
          padding:32px;
          font-family:Arial,Helvetica,sans-serif;
          color:#0f172a;
        ">
          <p style="
            margin:0 0 14px 0;
            font-size:16px;
            line-height:1.7;
            color:#334155;
          ">
            A partir daqui, você vai poder reservar horários, organizar seus jogos
            e usar o app com mais segurança.
          </p>

          <div style="
            margin:26px 0;
            padding:18px 20px;
            border:1px solid #dbeafe;
            background:#eff6ff;
            border-radius:16px;
            color:#1e3a8a;
            font-size:14px;
            line-height:1.6;
            font-weight:700;
          ">
            Este é um email de teste visual do novo padrão profissional do Quadra Play.
          </div>

          <a href="https://quadraplayoficial.web.app/login" style="
            display:inline-block;
            background:linear-gradient(135deg,#111827 0%,#0f172a 100%);
            color:#ffffff;
            text-decoration:none;
            padding:14px 22px;
            border-radius:14px;
            font-size:15px;
            font-weight:800;
          ">
            Confirmar e-mail
          </a>

          <p style="
            margin:26px 0 0 0;
            font-size:14px;
            line-height:1.7;
            color:#64748b;
          ">
            Se você não criou essa conta, pode ignorar este email.
          </p>

          <div style="
            margin-top:28px;
            padding-top:20px;
            border-top:1px solid #e2e8f0;
            font-size:13px;
            line-height:1.6;
            color:#94a3b8;
          ">
            Quadra Play • Reservas, gestão e experiência profissional para quadras e atletas.
          </div>
        </div>
      </div>
    </div>
  `,
});

    res.send("Email enviado com sucesso!");
  } catch (error) {
    console.error(error);
    res.status(500).send("Erro ao enviar email");
  }
});
export const enviarEmailVerificacaoCustom = onCall(
  { region: "us-central1" },
  async (req: CallableRequest<{ email?: string; nome?: string }>) => {
    const email = String(req.data?.email ?? "").trim();
    const nome = String(req.data?.nome ?? "").trim();

    if (!email) {
      throw new HttpsError("invalid-argument", "Email é obrigatório.");
    }

    const link = await admin.auth().generateEmailVerificationLink(email, {
      url: "https://quadraplayoficial.web.app/email-verificado",
      handleCodeInApp: false,
    });

    const resultado = await resend.emails.send({
      from: "Quadra Play <noreply@quadraplayoficial.com.br>",
      to: email,
      subject: "Confirme seu e-mail no Quadra Play 🚀",
      html: `
        <div style="margin:0;padding:0;background:#f4f7fb;">
          <div style="max-width:600px;margin:0 auto;padding:32px 20px;">
            <div style="
              background:linear-gradient(135deg,#0f172a 0%,#1d4ed8 55%,#38bdf8 100%);
              border-radius:24px 24px 0 0;
              padding:32px 32px 28px 32px;
              color:#ffffff;
              font-family:Arial,Helvetica,sans-serif;
            ">
              <div style="
                display:inline-block;
                background:rgba(255,255,255,0.14);
                border:1px solid rgba(255,255,255,0.18);
                border-radius:999px;
                padding:8px 14px;
                font-size:12px;
                font-weight:700;
                letter-spacing:0.3px;
                margin-bottom:18px;
              ">
                QUADRA PLAY
              </div>

              <h1 style="
                margin:0;
                font-size:34px;
                line-height:1.1;
                font-weight:800;
              ">
                Sua conta está quase pronta.
              </h1>

              <p style="
                margin:16px 0 0 0;
                font-size:16px;
                line-height:1.7;
                color:rgba(255,255,255,0.92);
              ">
                ${nome ? `Fala, ${nome}. ` : ""}Falta só confirmar seu e-mail para liberar sua experiência completa no Quadra Play.
              </p>
            </div>

            <div style="
              background:#ffffff;
              border:1px solid #e2e8f0;
              border-top:none;
              border-radius:0 0 24px 24px;
              padding:32px;
              font-family:Arial,Helvetica,sans-serif;
              color:#0f172a;
            ">
              <p style="
                margin:0 0 14px 0;
                font-size:16px;
                line-height:1.7;
                color:#334155;
              ">
                A partir daqui, você vai poder reservar horários, organizar seus jogos e usar o app com mais segurança.
              </p>

              <div style="
                margin:26px 0;
                padding:18px 20px;
                border:1px solid #dbeafe;
                background:#eff6ff;
                border-radius:16px;
                color:#1e3a8a;
                font-size:14px;
                line-height:1.6;
                font-weight:700;
              ">
                Clique no botão abaixo para confirmar seu e-mail.
              </div>

              <a href="${link}" style="
                display:inline-block;
                background:#053ff9;
                color:#ffffff;
                text-decoration:none;
                padding:14px 22px;
                border-radius:14px;
                font-size:15px;
                font-weight:800;
              ">
                Confirmar e-mail
              </a>

              <p style="
                margin:26px 0 0 0;
                font-size:14px;
                line-height:1.7;
                color:#64748b;
              ">
                Se você não criou essa conta, pode ignorar este email.
              </p>

              <div style="
                margin-top:28px;
                padding-top:20px;
                border-top:1px solid #e2e8f0;
                font-size:13px;
                line-height:1.6;
                color:#94a3b8;
              ">
                Quadra Play • Reservas, gestão e experiência profissional para quadras e atletas.
              </div>
            </div>
          </div>
        </div>
      `,
    });

    logger.info("Resultado Resend enviarEmailVerificacaoCustom", { resultado });

    const erroResend = (resultado as any)?.error;
    if (erroResend) {
      logger.error("Resend retornou erro em enviarEmailVerificacaoCustom", {
        erroResend,
      });
      throw new HttpsError("internal", "Falha ao enviar email de verificação.");
    }

    return { ok: true, resendId: (resultado as any)?.data?.id ?? null };
  }
);
// ===============================
// CONECTAR DONO AO MERCADO PAGO
// ===============================
export const criarLinkConectarMercadoPago = onCall(
  {
    region: "us-central1",
    secrets: [MERCADOPAGO_CLIENT_ID, MERCADOPAGO_REDIRECT_URI],
  },
  async (req) => {
    const uid = req.auth?.uid;

    if (!uid) {
      throw new HttpsError("unauthenticated", "Usuário não autenticado.");
    }

    // URL para onde o MP vai redirecionar depois
    const redirectUrl = MERCADOPAGO_REDIRECT_URI.value();

    const url = `https://auth.mercadopago.com.br/authorization?client_id=${MERCADOPAGO_CLIENT_ID.value()}&response_type=code&platform_id=mp&redirect_uri=${redirectUrl}&state=${uid}`;

    return { url };
  }
);
export const mpOAuthCallback = onRequest(
  {
    region: "us-central1",
    secrets: [
      MERCADOPAGO_CLIENT_ID,
      MERCADOPAGO_CLIENT_SECRET,
      MERCADOPAGO_REDIRECT_URI,
    ],
  },
  async (req, res) => {
    try {
      const code = String(req.query.code ?? "").trim();
      const state = String(req.query.state ?? "").trim(); // uid do dono

      if (!code || !state) {
        res.status(400).send("Parâmetros inválidos.");
        return;
      }

      const clientId = MERCADOPAGO_CLIENT_ID.value();
      const clientSecret = MERCADOPAGO_CLIENT_SECRET.value();
      const redirectUri = MERCADOPAGO_REDIRECT_URI.value();

      const response = await fetch("https://api.mercadopago.com/oauth/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          grant_type: "authorization_code",
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: redirectUri,
        }),
      });

      const data: any = await response.json();

      if (!response.ok) {
        logger.error("Erro OAuth Mercado Pago", data);
        res.status(500).send("Erro ao conectar Mercado Pago.");
        return;
      }

      const userIdMP = String(data.user_id ?? "").trim();
      const accessToken = String(data.access_token ?? "").trim();
      const refreshToken = String(data.refresh_token ?? "").trim();

      await db.collection("users").doc(state).set(
        {
          mpOAuthConnected: true,
          mpConnectionStatus: "connected",
          mpUserId: userIdMP,
          mpAccessToken: accessToken,
          mpRefreshToken: refreshToken,
          mpConnectedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      res.redirect("https://quadraplayoficial.web.app/central-proprietario");
    } catch (e) {
      logger.error("mpOAuthCallback error", e);
      res.status(500).send("Erro interno ao conectar Mercado Pago.");
    }
  }
);