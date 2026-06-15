import { useLocation, Link } from "react-router-dom";
import { useAuth } from "@/data/auth";
import { Users, Eye, Award, LogOut } from "lucide-react";

function Tab({
  to, icon: Icon, label, active,
}: { to: string; icon: typeof Users; label: string; active: boolean }) {
  return (
    <Link
      to={to}
      className={`flex flex-col items-center justify-center gap-1 flex-1 py-2 min-h-[56px] transition-colors ${
        active ? "text-primary" : "text-muted-foreground"
      }`}
    >
      <Icon className={`h-5 w-5 ${active ? "stroke-[2.5px]" : ""}`} />
      <span className="text-[10px] font-medium leading-none">{label}</span>
    </Link>
  );
}

export function MobileChrome() {
  const { currentLogin, signOut } = useAuth();
  const { pathname } = useLocation();

  const role = currentLogin?.systemRole;
  const isPreceptor = role === "Preceptor" || role === "UnitLeader";

  const onObserve  = pathname.includes("/observe");
  const onSignOff  = pathname.includes("/sign-off");
  const onLearners = !onObserve && !onSignOff;

  const firstName = currentLogin?.displayName.split(/[\s,]/)[0] ?? "";

  return (
    <>
      {/* Top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 px-4 h-14 border-b bg-background shrink-0">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-md insight-gradient flex items-center justify-center text-white text-xs font-bold shrink-0">
            ✦
          </div>
          <span className="text-sm font-semibold">
            Care<span className="text-primary">Competencies</span>
          </span>
        </div>
        <div className="flex items-center gap-3 min-w-0">
          {firstName && (
            <span className="text-xs text-muted-foreground truncate">{firstName}</span>
          )}
          <button
            type="button"
            onClick={signOut}
            aria-label="Sign out"
            className="text-muted-foreground hover:text-foreground shrink-0"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Bottom tab bar — preceptors only; RN gets single header per plan */}
      {isPreceptor && (
        <nav className="fixed bottom-0 left-0 right-0 z-30 flex border-t bg-background">
          <Tab to="/my-orientees" icon={Users}  label="My Learners" active={onLearners} />
          <Tab to="/my-orientees" icon={Eye}    label="Observe"     active={onObserve} />
          <Tab to="/my-orientees" icon={Award}  label="Sign Off"    active={onSignOff} />
        </nav>
      )}
    </>
  );
}
