import { useAuth } from "@/data/auth";
import { LogOut } from "lucide-react";

/**
 * Mobile-visible header with the app wordmark and a small Sign Out affordance.
 * Desktop layouts use the sidebar for navigation; this header is for narrow
 * viewports where the sidebar is hidden behind a drawer.
 */
export function Header() {
  const { currentLogin, signOut } = useAuth();
  return (
    <header className="md:hidden sticky top-0 z-30 flex items-center justify-between gap-3 px-4 py-3 border-b border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2">
        <div className="h-7 w-7 rounded-md insight-gradient flex items-center justify-center text-white text-xs font-bold">
          ✦
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold">
            <span className="text-sidebar-foreground">Care</span>
            <span className="text-primary">Competencies</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {currentLogin && (
          <button
            type="button"
            onClick={signOut}
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            aria-label="Sign out"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        )}
      </div>
    </header>
  );
}