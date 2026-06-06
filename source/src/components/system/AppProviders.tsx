import type { ReactNode } from "react";
import { AuthProvider } from "@/data/auth";
import { DataProvider } from "@/data/store";

/**
 * Wraps the app in the providers it depends on at runtime.
 * Order matters: Auth wraps Data so DataProvider can react to user context
 * if/when we add it (today the store is global).
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <DataProvider>{children}</DataProvider>
    </AuthProvider>
  );
}