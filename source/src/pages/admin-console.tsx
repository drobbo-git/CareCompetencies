import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/data/auth";
import { useData } from "@/data/store";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BookOpen, Layers, ClipboardList, Users, MailQuestion,
  FileBarChart2, ShieldCheck, Sparkles,
} from "lucide-react";

/**
 * Administrator landing page. Not currently routed by default (Home auto-routes
 * admins to a quicklink layout), but kept here as an alternative dashboard
 * view should you want to wire it to a route like /admin.
 *
 * Surfaces health-of-catalog metrics and direct links to the admin workspaces.
 */
export default function AdminConsolePage() {
  const { currentLogin } = useAuth();
  const {
    competencies, groups, units, assignments, changeRequests,
    auditEvents, persons, achievements, observations,
  } = useData();

  const stats = useMemo(() => {
    const pending = changeRequests.filter((cr) => cr.status === "Pending").length;
    const orphanCompetencies = competencies.filter(
      (c) => !assignments.some((a) => a.competencyId === c.id),
    ).length;
    const ungrouped = competencies.filter((c) => !c.groupId).length;
    const auditToday = auditEvents.filter((e) => e.timestamp.startsWith(new Date().toISOString().slice(0, 10))).length;
    return {
      competencyCount: competencies.length,
      groupCount: groups.length,
      unitCount: units.length,
      assignmentCount: assignments.length,
      pending,
      orphanCompetencies,
      ungrouped,
      auditToday,
      personCount: persons.length,
      achievementCount: achievements.length,
      observationCount: observations.length,
    };
  }, [competencies, groups, units, assignments, changeRequests, auditEvents, persons, achievements, observations]);

  if (currentLogin?.systemRole !== "Administrator") {
    return <p className="text-sm text-muted-foreground">Administrator access required.</p>;
  }

  return (
    <>
      <PageHeader
        title="Admin Console"
        description="Catalog health at a glance, plus quick links to the admin workspaces."
        actions={
          <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="h-4 w-4 text-primary" />
            CareCompetencies · DUHS prototype
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Competencies"          value={stats.competencyCount} />
        <Stat label="Groups"                value={stats.groupCount} />
        <Stat label="Units"                 value={stats.unitCount} />
        <Stat label="Assignments"           value={stats.assignmentCount} />
        <Stat label="Pending requests"      value={stats.pending} highlight={stats.pending > 0} />
        <Stat label="Orphan competencies"   value={stats.orphanCompetencies} highlight={stats.orphanCompetencies > 0} />
        <Stat label="Ungrouped"             value={stats.ungrouped} highlight={stats.ungrouped > 0} />
        <Stat label="Audit events today"    value={stats.auditToday} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Persons"               value={stats.personCount} />
        <Stat label="Achievements (total)"  value={stats.achievementCount} />
        <Stat label="Observations (total)"  value={stats.observationCount} />
        <Stat label="—"                     value={0} dimmed />
      </div>

      <h2 className="text-sm uppercase tracking-wider text-muted-foreground mb-2">Workspaces</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <Workspace to="/competencies" icon={BookOpen}       title="Catalog"          desc="Browse and add competencies." />
        <Workspace to="/groups"       icon={Layers}         title="Manage Groups"    desc="Edit the hierarchical taxonomy." />
        <Workspace to="/assignments"  icon={ClipboardList}  title="Assignments"      desc="Map competencies to units + roles." />
        <Workspace to="/people"       icon={Users}          title="People"           desc="System role management." />
        <Workspace to="/requests"     icon={MailQuestion}   title="Change Requests"  desc={stats.pending > 0 ? `${stats.pending} pending` : "Up to date"} />
        <Workspace to="/reports"      icon={FileBarChart2}  title="Reports"          desc="Unit readiness and throughput." />
        <Workspace to="/audit"        icon={ShieldCheck}    title="Audit Log"        desc="Catalog + governance event stream." />
      </div>
    </>
  );
}

function Stat({ label, value, highlight, dimmed }: { label: string; value: number; highlight?: boolean; dimmed?: boolean }) {
  return (
    <Card className={highlight ? "border-primary/40 bg-primary/5" : ""}>
      <CardContent className="pt-4">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className={`text-2xl font-semibold tabular-nums mt-0.5 ${dimmed ? "text-muted-foreground" : ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function Workspace({
  to, icon: Icon, title, desc,
}: {
  to: string;
  icon: typeof BookOpen;
  title: string;
  desc: string;
}) {
  return (
    <Link to={to} className="block group">
      <Card className="h-full transition-colors group-hover:border-primary/40">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Icon className="h-4 w-4 text-primary" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{desc}</p>
          <Button variant="link" className="px-0 mt-1 h-auto">Open →</Button>
        </CardContent>
      </Card>
    </Link>
  );
}