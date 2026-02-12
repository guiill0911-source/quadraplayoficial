// src/services/authContext.tsx
import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { observarAuth, getMeuPerfil, type AppUser } from "./authService";

type AuthState = {
  loading: boolean;
  user: AppUser | null;
};

const AuthCtx = createContext<AuthState>({ loading: true, user: null });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ loading: true, user: null });

  useEffect(() => {
    const unsub = observarAuth(async (fbUser) => {
      try {
        if (!fbUser) {
          setState({ loading: false, user: null });
          return;
        }
        const perfil = await getMeuPerfil(fbUser.uid);
        // se não existir perfil ainda, deixa nulo (evita quebra)
        setState({ loading: false, user: perfil });
      } catch {
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
