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

const PENDING_PROFILE_KEY = "qp_pending_profile";

type PendingProfile = {
  email: string;
  nome: string;
  sobrenome: string;
  cpf?: string | null;
  telefone: string;
  role: UserRole;
};

function salvarPendingProfile(data: PendingProfile) {
  localStorage.setItem(PENDING_PROFILE_KEY, JSON.stringify(data));
}

export function lerPendingProfile(): PendingProfile | null {
  try {
    const raw = localStorage.getItem(PENDING_PROFILE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PendingProfile;
  } catch {
    return null;
  }
}

export function limparPendingProfile() {
  localStorage.removeItem(PENDING_PROFILE_KEY);
}

async function criarDocUsuarioBase(
  user: User,
  params: {
    email: string;
    nome: string;
    sobrenome: string;
    cpf?: string | null;
    telefone: string;
    role: UserRole;
  }
) {
  const telefoneNormalizado = normalizarTelefoneBR(params.telefone);

  await setDoc(
    doc(db, "users", user.uid),
    {
      nome: params.nome,
      sobrenome: params.sobrenome,
      cpf: params.cpf ?? null,
      telefone: telefoneNormalizado,
      telefoneNormalizado,
      telefoneVerificado: false,
      emailVerificado: !!user.emailVerified,
      role: params.role,
      email: params.email,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),

      trialGratisAte:
  params.role === "dono"
    ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    : null,

      mpOAuthConnected: false,
      mpConnectionStatus: "not_connected",
      mpConnectedAt: null,
    },
    { merge: true }
  );
}

const enviarEmailVerificacaoCustom = httpsCallable<
  { email: string; nome: string },
  { ok: boolean }
>(functions, "enviarEmailVerificacaoCustom");

export async function reenviarEmailVerificacao() {
  const user = auth.currentUser;

  if (!user || !user.email) {
    throw new Error("Nenhum usuário logado foi encontrado para reenviar o e-mail.");
  }

  let nome = "Quadra Play";

  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (snap.exists()) {
      const data = snap.data() as any;
      nome = String(data?.nome ?? "Quadra Play");
    }
  } catch {
    // se falhar ler o perfil, segue com nome padrão
  }

  await enviarEmailVerificacaoCustom({
    email: user.email,
    nome,
  });
}

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

  termosDonoAceitosEm?: any;
versaoTermosDonoAceitos?: string | null;

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

  salvarPendingProfile({
    email,
    nome,
    sobrenome,
    cpf,
    telefone: telefoneNormalizado,
    role: params.role,
  });

  const cred = await createUserWithEmailAndPassword(auth, email, params.senha);

  await criarDocUsuarioBase(cred.user, {
    email,
    nome,
    sobrenome,
    cpf,
    telefone: telefoneNormalizado,
    role: params.role,
  });

  if (cred.user && !cred.user.emailVerified) {
    await enviarEmailVerificacaoCustom({
      email,
      nome,
    });
  }

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

            termosDonoAceitosEm: x.termosDonoAceitosEm ?? null,
    versaoTermosDonoAceitos:
      x.versaoTermosDonoAceitos != null
        ? String(x.versaoTermosDonoAceitos)
        : null,

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

            termosDonoAceitosEm: x.termosDonoAceitosEm ?? null,
    versaoTermosDonoAceitos:
      x.versaoTermosDonoAceitos != null
        ? String(x.versaoTermosDonoAceitos)
        : null,

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