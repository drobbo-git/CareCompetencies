import type { ReactNode } from "react";
import { AuthProvider, useAuth } from "@/data/auth";
import { DataProvider } from "@/data/store";

function SessionTimeoutWarning() {
  const { timeoutWarning, stayActive, signOut } = useAuth();
  if (!timeoutWarning) return null;
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 shadow-lg text-sm">
      <span className="text-amber-800">Your session will expire in 2 minutes due to inactivity.</span>
      <button
        onClick={stayActive}
        className="rounded-md bg-amber-600 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-700 transition-colors"
      >
        Stay signed in
      </button>
      <button
        onClick={signOut}
        className="rounded-md border border-amber-300 px-3 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100 transition-colors"
      >
        Sign out
      </button>
    </div>
  );
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <DataProvider>{children}</DataProvider>
      <SessionTimeoutWarning />
    </AuthProvider>
  );
}
