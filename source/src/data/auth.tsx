import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Login, SystemRole } from "./types";
import { api } from "@/lib/api";

const TOKEN_KEY = "carecompetencies.auth.token";
const LOGIN_KEY  = "carecompetencies.auth.login";

const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000;
const WARN_BEFORE_MS     =  2 * 60 * 1000;

const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"] as const;

function readStoredLogin(): Login | null {
  try {
    const raw = localStorage.getItem(LOGIN_KEY);
    return raw ? (JSON.parse(raw) as Login) : null;
  } catch { return null; }
}

interface AuthCtx {
  currentLogin: Login | null;
  currentRole: SystemRole | null;
  timeoutWarning: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => void;
  stayActive: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentLogin, setCurrentLogin] = useState<Login | null>(readStoredLogin);
  const [timeoutWarning, setTimeoutWarning] = useState(false);
  const [timeoutMs, setTimeoutMs] = useState(DEFAULT_TIMEOUT_MS);

  const idleTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);

  const signOut = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(LOGIN_KEY);
    setCurrentLogin(null);
    setTimeoutWarning(false);
  }, []);

  const clearTimers = useCallback(() => {
    if (idleTimer.current)  { clearTimeout(idleTimer.current);  idleTimer.current  = null; }
    if (warnTimer.current)  { clearTimeout(warnTimer.current);  warnTimer.current  = null; }
  }, []);

  const resetTimers = useCallback(() => {
    clearTimers();
    setTimeoutWarning(false);
    const warnDelay = timeoutMs - WARN_BEFORE_MS;
    if (warnDelay > 0) {
      warnTimer.current = setTimeout(() => setTimeoutWarning(true), warnDelay);
    }
    idleTimer.current = setTimeout(() => signOut(), timeoutMs);
  }, [clearTimers, signOut, timeoutMs]);

  const stayActive = useCallback(() => resetTimers(), [resetTimers]);

  // Fetch timeout config once on mount
  useEffect(() => {
    api.getConfig()
      .then(({ sessionTimeoutMinutes }) => {
        setTimeoutMs(sessionTimeoutMinutes * 60 * 1000);
      })
      .catch(() => { /* keep default */ });
  }, []);

  // Start/stop inactivity tracking whenever login state or timeout changes
  useEffect(() => {
    if (!currentLogin) { clearTimers(); return; }
    ACTIVITY_EVENTS.forEach((e) => document.addEventListener(e, resetTimers, { passive: true }));
    resetTimers();
    return () => {
      ACTIVITY_EVENTS.forEach((e) => document.removeEventListener(e, resetTimers));
      clearTimers();
    };
  }, [currentLogin, resetTimers, clearTimers]);

  const signIn = useCallback(async (username: string, password: string) => {
    const { token, login } = await api.login(username, password);
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(LOGIN_KEY, JSON.stringify(login));
    setCurrentLogin(login);
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({ currentLogin, currentRole: currentLogin?.systemRole ?? null, timeoutWarning, signIn, signOut, stayActive }),
    [currentLogin, timeoutWarning, signIn, signOut, stayActive],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within <AuthProvider>");
  return v;
}
