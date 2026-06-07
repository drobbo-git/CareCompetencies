import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { Login, SystemRole } from "./types";
import { api } from "@/lib/api";

const TOKEN_KEY = "carecompetencies.auth.token";
const LOGIN_KEY  = "carecompetencies.auth.login";

function readStoredLogin(): Login | null {
  try {
    const raw = localStorage.getItem(LOGIN_KEY);
    return raw ? (JSON.parse(raw) as Login) : null;
  } catch { return null; }
}

interface AuthCtx {
  currentLogin: Login | null;
  currentRole: SystemRole | null;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentLogin, setCurrentLogin] = useState<Login | null>(readStoredLogin);

  const signIn = useCallback(async (username: string, password: string) => {
    const { token, login } = await api.login(username, password);
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(LOGIN_KEY, JSON.stringify(login));
    setCurrentLogin(login);
  }, []);

  const signOut = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(LOGIN_KEY);
    setCurrentLogin(null);
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({ currentLogin, currentRole: currentLogin?.systemRole ?? null, signIn, signOut }),
    [currentLogin, signIn, signOut],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within <AuthProvider>");
  return v;
}
