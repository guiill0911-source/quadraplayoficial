// src/services/authContext.tsx
import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { observarAuth, getMeuPerfil, type AppUser } from "./authService";

type AuthState = {
  loading: boolean;
  user: AppUser | null;
};

const AuthCtx = createContext<AuthState>({ loading: true, user: null });

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ loading: true, user: null });

  // ✅ evita “atualização atrasada” do perfil de uma conta antiga sobrescrever a nova
  const seqRef = useRef(0);

  useEffect(() => {
    const unsub = observarAuth(async (fbUser) => {
      const mySeq = ++seqRef.current;

      // sempre entra em loading quando troca o auth-state
      setState((prev) => ({ ...prev, loading: true }));

      try {
        if (!fbUser) {
          // usuário deslogado
          if (seqRef.current !== mySeq) return;
          setState({ loading: false, user: null });
          return;
        }

        // ✅ tenta buscar perfil; se falhar por timing, tenta de novo rapidinho
        let perfil: AppUser | null = null;

        try {
          perfil = await getMeuPerfil(fbUser.uid);
        } catch {
          // retry curto (às vezes o token/estado ainda está “assentando” logo após login)
          await sleep(250);
          perfil = await getMeuPerfil(fbUser.uid);
        }

        // se ficou “stale”, ignora
        if (seqRef.current !== mySeq) return;

        // se não existir perfil ainda, mantém user null mas NÃO derruba em loop (RequireAuth/Role vão lidar)
        setState({
  loading: false,
  user: perfil ?? {
    uid: fbUser.uid,
    email: fbUser.email ?? "",
    nome: "",
    sobrenome: "",
    role: "atleta",
    emailVerificado: !!fbUser.emailVerified,
    telefoneVerificado: false,
  },
});
      } catch {
        if (seqRef.current !== mySeq) return;
        setState({ loading: false, user: null });
      }
    });

    return () => unsub();
  }, []);

  return <AuthCtx.Provider value={state}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  return useContext(AuthCtx);
}
