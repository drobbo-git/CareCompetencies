import { Link, Navigate } from "react-router-dom";
import MyCompetenciesPage from "./my-competencies";
import { useAuth } from "@/data/auth";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { useData } from "@/data/store";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users, Stethoscope, ClipboardCheck, BookOpen, MailQuestion, UserCircle2,
} from "lucide-react";

/**
 * Role-aware home page:
 *   - Administrator → redirect to /admin
 *   - UnitLeader   → redirect to /dashboard
 *   - Preceptor    → quick links to orientees, observe, sign-off
 *   - Person       → redirect to /my-competencies
 */
export default function Home() {
  const { currentLogin } = useAuth();
  const { persons } = useData();

  const isMobile = useIsMobile();

  if (!currentLogin) return null;

  if (currentLogin.systemRole === "Administrator") return <Navigate to="/admin" replace />;
  if (currentLogin.systemRole === "UnitLeader")    return <Navigate to={isMobile ? "/my-orientees" : "/dashboard"} replace />;
  if (currentLogin.systemRole === "Preceptor")     return <Navigate to="/my-orientees" replace />;
  if (currentLogin.systemRole === "Person")        return <MyCompetenciesPage />;

  // Preceptor home — rendered directly (non-redirect fallback)
  const myOrientees = persons.filter((n) => n.primaryPreceptorId === currentLogin.id);
  return (
    <>
      <PageHeader
        title={`Welcome, ${displayFirstName(currentLogin.displayName)}`}
        description={`You have ${myOrientees.length} paired learner${myOrientees.length === 1 ? "" : "s"}.`}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <QuickLink to="/my-orientees" icon={UserCircle2}    title="My Learners"        desc="Your paired learners and their progress." />
        <QuickLink to="/observe"      icon={Stethoscope}    title="Observe"            desc="Record a step observation." />
        <QuickLink to="/sign-off"     icon={ClipboardCheck} title="Sign off"           desc="Mark a competency as achieved." />
        <QuickLink to="/competencies" icon={BookOpen}       title="Competency Library" desc="Look up any competency." />
        <QuickLink to="/requests"     icon={MailQuestion}   title="Change Requests"    desc="Suggest a catalog change." />
      </div>
    </>
  );
}

function QuickLink({
  to, icon: Icon, title, desc, highlight,
}: {
  to: string;
  icon: typeof Users;
  title: string;
  desc: string;
  highlight?: boolean;
}) {
  return (
    <Link to={to} className="block group">
      <Card className={`transition-colors group-hover:border-primary/40 ${highlight ? "border-primary/60 bg-primary/5" : ""}`}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Icon className="h-4 w-4 text-primary" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{desc}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

function displayFirstName(displayName: string): string {
  return displayName.split(/[, (]/)[0] || "there";
}
