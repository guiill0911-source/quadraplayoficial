import { auth, db } from "./firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  type User,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

export type UserRole = "atleta" | "dono";

export type AppUser = {
  uid: string;
  email: string;
  nome: string;
  sobrenome?: string;
  cpf?: string;
  role: UserRole;
};

export async function cadastrarComEmail(params: {
  email: string;
  senha: string;
  nome: string;
  sobrenome: string;
  cpf?: string;
  role: UserRole;
}) {
  const cred = await createUserWithEmailAndPassword(auth, params.email, params.senha);

  await setDoc(doc(db, "users", cred.user.uid), {
    nome: params.nome,
    sobrenome: params.sobrenome,
    cpf: params.cpf ?? null,
    role: params.role,
    email: params.email,
    createdAt: serverTimestamp(),
  });

  return cred.user;
}

export async function loginComEmail(email: string, senha: string) {
  const cred = await signInWithEmailAndPassword(auth, email, senha);
  return cred.user;
}

export async function logout() {
  await signOut(auth);
}

export function observarAuth(cb: (u: User | null) => void) {
  return onAuthStateChanged(auth, cb);
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
    role: (x.role === "dono" ? "dono" : "atleta") as UserRole,
  };
}

export async function enviarRecuperacaoSenha(email: string) {
  const e = email.trim();
  if (!e) throw new Error("Informe seu email.");
  await sendPasswordResetEmail(auth, e);
}
