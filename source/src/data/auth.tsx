import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
  logins: Login[];
  loginsLoading: boolean;
  currentLogin: Login | null;
  currentRole: SystemRole | null;
  signIn: (loginId: string) => Promise<void>;
  signOut: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentLogin, setCurrentLogin] = useState<Login | null>(readStoredLogin);

  const loginsQuery = useQuery({
    queryKey: ['logins'],
    queryFn: api.getLogins,
    staleTime: Infinity,
  });

  const signIn = useCallback(async (loginId: string) => {
    const { token, login } = await api.login(loginId);
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
    () => ({
      logins: loginsQuery.data ?? [],
      loginsLoading: loginsQuery.isPending,
      currentLogin,
      currentRole: currentLogin?.systemRole ?? null,
      signIn,
      signOut,
    }),
    [loginsQuery.data, loginsQuery.isPending, currentLogin, signIn, signOut],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within <AuthProvider>");
  return v;
}
