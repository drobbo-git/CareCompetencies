import type { ReactNode } from "react";
import { useLocation, Navigate } from "react-router-dom";
import { useAuth } from "@/data/auth";
import LoginPage from "@/pages/login";

/**
 * Renders the Login page if no user is signed in. Otherwise renders children.
 *
 * NOTE: This is *client-side only*. When real auth replaces the stub, server-
 * side route guards must also be added (see deploy/README.md "Authorization
 * notes") — at minimum for /admin/*, /persons, /competency-matrix, and any
 * route a Unit Leader / Administrator can see that a Preceptor or Person
 * cannot.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { currentLogin } = useAuth();
  const location = useLocation();

  if (!currentLogin) {
    // Render the login page in place; we don't navigate so the user keeps
    // their requested URL and we return to it after signing in.
    void location;
    return <LoginPage />;
  }

  // If the URL accidentally points to /login while signed in, bounce home.
  if (location.pathname === "/login") return <Navigate to="/" replace />;

  return <>{children}</>;
}