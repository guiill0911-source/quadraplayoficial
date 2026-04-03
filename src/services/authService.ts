import { auth, db, app } from "./firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  linkWithPhoneNumber,
  getAuth,
  type ConfirmationResult,
  type User,
} from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  setDoc,
  serverTimestamp,
  where,
} from "firebase/firestore";

const functions = getFunctions(app, "us-central1");

const enviarEmailVerificacaoCustom = httpsCallable<
  { email: string; nome: string },
  { ok: boolean }
>(functions, "enviarEmailVerificacaoCustom");

export type UserRole = "atleta" | "dono";

export type AppUser = {
  uid: string;
  email: string;
  nome: string;
  sobrenome?: string;
  cpf?: string;
  telefone?: string;
  telefoneNormalizado?: string;
  role: UserRole;
  emailVerificado?: boolean;
  telefoneVerificado?: boolean;

  mpOAuthConnected?: boolean;
  mpConnectionStatus?: "not_connected" | "pending" | "connected" | "error";
  mpConnectedAt?: any;
};

declare global {
  interface Window {
    recaptchaVerifier?: RecaptchaVerifier;
    confirmationResultQP?: ConfirmationResult;
  }
}

function normalizarTelefoneBR(telefone?: string) {
  const numeros = String(telefone ?? "").replace(/\D/g, "");
  return numeros || "";
}

function telefoneParaE164Brasil(telefone: string) {
  const numeros = normalizarTelefoneBR(telefone);

  if (numeros.length < 10 || numeros.length > 11) {
    throw new Error("Informe um celular válido com DDD.");
  }

  return `+55${numeros}`;
}

export async function cadastrarComEmail(params: {
  email: string;
  senha: string;
  nome: string;
  sobrenome: string;
  cpf?: string;
  telefone: string;
  role: UserRole;
}) {
  const email = params.email.trim();
  const nome = params.nome.trim();
  const sobrenome = params.sobrenome.trim();
  const cpf = params.cpf?.trim() ? params.cpf.trim() : null;

  const telefoneNormalizado = normalizarTelefoneBR(params.telefone);

  if (!telefoneNormalizado) {
    throw new Error("Informe seu celular.");
  }

  if (telefoneNormalizado.length < 10 || telefoneNormalizado.length > 11) {
    throw new Error("Informe um celular válido com DDD.");
  }

  const cred = await createUserWithEmailAndPassword(auth, email, params.senha);

  if (cred.user && !cred.user.emailVerified) {
    await enviarEmailVerificacaoCustom({
      email,
      nome,
    });
  }

  await setDoc(doc(db, "users", cred.user.uid), {
    nome,
    sobrenome,
    cpf,
    telefone: telefoneNormalizado,
    telefoneNormalizado,
    telefoneVerificado: false,
    emailVerificado: !!cred.user.emailVerified,
    role: params.role,
    email,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),

    // 🔥 BASE MERCADO PAGO
    mpOAuthConnected: false,
    mpConnectionStatus: "not_connected",
    mpConnectedAt: null,
  });

  return cred.user;
}

export async function loginComEmail(email: string, senha: string) {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), senha);
  return cred.user;
}

export function criarRecaptcha(containerId: string) {
  if (window.recaptchaVerifier) {
    try {
      window.recaptchaVerifier.clear();
    } catch {}
  }

  window.recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
    size: "normal",
  });

  return window.recaptchaVerifier;
}

export async function enviarCodigoCelular(
  telefone: string,
  recaptchaVerifier: RecaptchaVerifier
) {
  const telefoneE164 = telefoneParaE164Brasil(telefone);

  const confirmationResult = await signInWithPhoneNumber(
    auth,
    telefoneE164,
    recaptchaVerifier
  );

  window.confirmationResultQP = confirmationResult;
  return confirmationResult;
}

export async function enviarCodigoVinculacaoCelular(
  telefone: string,
  recaptchaVerifier: RecaptchaVerifier
) {
  const authAtual = getAuth();
  const user = authAtual.currentUser;

  if (!user) {
    throw new Error("Você precisa estar logado para vincular um celular.");
  }

  const telefoneE164 = telefoneParaE164Brasil(telefone);

  const confirmationResult = await linkWithPhoneNumber(
    user,
    telefoneE164,
    recaptchaVerifier
  );

  window.confirmationResultQP = confirmationResult;
  return confirmationResult;
}

export async function confirmarCodigoCelular(codigo: string) {
  const confirmationResult = window.confirmationResultQP;

  if (!confirmationResult) {
    throw new Error(
      "Nenhum código pendente foi encontrado. Solicite um novo código."
    );
  }

  const cred = await confirmationResult.confirm(codigo.trim());
  return cred.user;
}

function validarMpStatus(status: any) {
  if (
    status === "not_connected" ||
    status === "pending" ||
    status === "connected" ||
    status === "error"
  ) {
    return status;
  }
  return undefined;
}

export async function getMeuPerfil(uid: string): Promise<AppUser | null> {
  const snap = await getDoc(doc(db, "users", uid));

  if (!snap.exists()) return null;

  const x = snap.data() as any;

  return {
    uid,
    email: String(x.email ?? ""),
    nome: String(x.nome ?? ""),
    sobrenome: x.sobrenome ? String(x.sobrenome) : undefined,
    cpf: x.cpf ? String(x.cpf) : undefined,
    telefone: x.telefone ? String(x.telefone) : undefined,
    telefoneNormalizado: x.telefoneNormalizado
      ? String(x.telefoneNormalizado)
      : undefined,
    role: (x.role === "dono" ? "dono" : "atleta") as UserRole,
    emailVerificado:
      typeof x.emailVerificado === "boolean" ? x.emailVerificado : undefined,
    telefoneVerificado:
      typeof x.telefoneVerificado === "boolean"
        ? x.telefoneVerificado
        : undefined,

    mpOAuthConnected:
      typeof x.mpOAuthConnected === "boolean"
        ? x.mpOAuthConnected
        : undefined,
    mpConnectionStatus: validarMpStatus(x.mpConnectionStatus),
    mpConnectedAt: x.mpConnectedAt ?? undefined,
  };
}

export async function buscarPerfilPorTelefone(
  telefone: string
): Promise<AppUser | null> {
  const telefoneNormalizado = normalizarTelefoneBR(telefone);

  if (!telefoneNormalizado) return null;

  const q = query(
    collection(db, "users"),
    where("telefoneNormalizado", "==", telefoneNormalizado),
    limit(1)
  );

  const snap = await getDocs(q);

  if (snap.empty) return null;

  const docSnap = snap.docs[0];
  const x = docSnap.data() as any;

  return {
    uid: docSnap.id,
    email: String(x.email ?? ""),
    nome: String(x.nome ?? ""),
    sobrenome: x.sobrenome ? String(x.sobrenome) : undefined,
    cpf: x.cpf ? String(x.cpf) : undefined,
    telefone: x.telefone ? String(x.telefone) : undefined,
    telefoneNormalizado: x.telefoneNormalizado
      ? String(x.telefoneNormalizado)
      : undefined,
    role: (x.role === "dono" ? "dono" : "atleta") as UserRole,
    emailVerificado:
      typeof x.emailVerificado === "boolean" ? x.emailVerificado : undefined,
    telefoneVerificado:
      typeof x.telefoneVerificado === "boolean"
        ? x.telefoneVerificado
        : undefined,

    mpOAuthConnected:
      typeof x.mpOAuthConnected === "boolean"
        ? x.mpOAuthConnected
        : undefined,
    mpConnectionStatus: validarMpStatus(x.mpConnectionStatus),
    mpConnectedAt: x.mpConnectedAt ?? undefined,
  };
}

export async function enviarRecuperacaoSenha(email: string) {
  const e = email.trim();

  if (!e) {
    throw new Error("Informe seu email.");
  }

  await sendPasswordResetEmail(auth, e);
}

export async function logout() {
  await signOut(auth);
}

export function observarAuth(cb: (u: User | null) => void) {
  return onAuthStateChanged(auth, cb);
}