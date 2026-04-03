import { getAuth } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";

export async function verifyAndBindCpf(args: { cpf: string; consent: boolean }) {
  const user = getAuth().currentUser;
  if (!user?.uid) throw new Error("Você precisa estar logado.");

  const fn = httpsCallable(getFunctions(), "verifyAndBindCpf");

  const resp = await fn({
    cpf: String(args.cpf ?? "").trim(),
    consent: Boolean(args.consent),
  });

  return resp.data as {
    ok: boolean;
    alreadyBound: boolean;
    cpfUltimos4?: string;
  };
}