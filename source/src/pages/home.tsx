import { useMemo } from "react";
import { Link, Navigate } from "react-router-dom";
import MyCompetenciesPage from "./my-competencies";
import { useAuth } from "@/data/auth";
import { useData } from "@/data/store";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users, Stethoscope, ClipboardCheck, BookOpen, MailQuestion,
  FileBarChart2, Grid3x3, UserCircle2,
} from "lucide-react";

/**
 * Role-aware home page. Each role sees a different welcome layout:
 *   - Administrator → quick links to catalog, requests, audit, reports
 *   - UnitLeader   → redirect to /unit-leader-dashboard (their real home)
 *   - Preceptor    → quick links to orientees, observe, sign-off
 *   - Person       → redirect to /my-competencies
 */
export default function Home() {
  const { currentLogin } = useAuth();
  const { changeRequests, persons } = useData();

  const pendingRequests = useMemo(
    () => changeRequests.filter((cr) => cr.status === "Pending").length,
    [changeRequests],
  );

  if (!currentLogin) return null;

  if (currentLogin.systemRole === "UnitLeader") {
    return <Navigate to="/unit-leader-dashboard" replace />;
  }
  if (currentLogin.systemRole === "Preceptor") {
    return <Navigate to="/my-orientees" replace />;
  }
  if (currentLogin.systemRole === "Person") {
    return <MyCompetenciesPage />;
  }

  if (currentLogin.systemRole === "Administrator") {
    return (
      <>
        <PageHeader
          title={`Welcome, ${displayFirstName(currentLogin.displayName)}`}
          description="Catalog, change requests, and governance at a glance."
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <QuickLink to="/competencies"  icon={BookOpen}      title="Catalog"          desc="Review the competency library." />
          <QuickLink to="/groups"        icon={Grid3x3}       title="Manage Groups"    desc="Hierarchical taxonomy." />
          <QuickLink to="/assignments"   icon={ClipboardCheck} title="Assignments"      desc="Map competencies to units + roles." />
          <QuickLink to="/people"        icon={Users}         title="People"           desc="System role management." />
          <QuickLink
            to="/requests"
            icon={MailQuestion}
            title="Change Requests"
            desc={pendingRequests > 0 ? `${pendingRequests} pending` : "No pending requests"}
            highlight={pendingRequests > 0}
          />
          <QuickLink to="/reports"       icon={FileBarChart2} title="Reports"          desc="Unit readiness and throughput." />
        </div>
      </>
    );
  }

  // Preceptor home
  const myOrientees = persons.filter((n) => n.primaryPreceptorId === currentLogin.id);
  return (
    <>
      <PageHeader
        title={`Welcome, ${displayFirstName(currentLogin.displayName)}`}
        description={`You have ${myOrientees.length} paired learner${myOrientees.length === 1 ? "" : "s"}.`}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <QuickLink to="/my-orientees" icon={UserCircle2}    title="My Learners" desc="Your paired learners and their progress." />
        <QuickLink to="/observe"      icon={Stethoscope}    title="Observe"      desc="Record a step observation." />
        <QuickLink to="/sign-off"     icon={ClipboardCheck} title="Sign off"     desc="Mark a competency as achieved." />
        <QuickLink to="/competencies" icon={BookOpen}       title="Catalog"      desc="Look up any competency." />
        <QuickLink to="/requests"     icon={MailQuestion}   title="Change Requests" desc="Suggest a catalog change." />
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
  // "Tiffany Burnham (Administrator)" → "Tiffany"
  // "Stacy Hester, RN (Preceptor — DN 4100)" → "Stacy"
  return displayName.split(/[, (]/)[0] || "there";
}