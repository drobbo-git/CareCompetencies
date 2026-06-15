import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/data/auth";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { Monitor } from "lucide-react";
import { useData } from "@/data/store";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen, MailQuestion, Sparkles, HardDrive,
} from "lucide-react";
import { CR_STATUS_LABEL } from "@/data/types";

export default function AdminConsolePage() {
  const { currentLogin, signOut } = useAuth();
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6 gap-6">
        <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center">
          <Monitor className="h-8 w-8 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold">Administrator console</h1>
          <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
            The admin tools — competency editing, change requests, audit log, and people management —
            are designed for a full-size screen. Please open CareCompetencies on your computer to
            access them.
          </p>
        </div>
        <button
          type="button"
          onClick={signOut}
          className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4"
        >
          Sign out
        </button>
      </div>
    );
  }
  const {
    competencies, groups, changeRequests, auditEvents,
  } = useData();

  const stats = useMemo(() => {
    const crOpen        = changeRequests.filter((cr) => cr.status === "Pending").length;
    const crUnderReview = changeRequests.filter((cr) => cr.status === "UnderReview").length;
    const crSolved      = changeRequests.filter((cr) => cr.status === "Approved" || cr.status === "Rejected").length;

    const oldestCR = [...changeRequests]
      .filter((cr) => cr.status === "Pending" || cr.status === "UnderReview")
      .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))[0] ?? null;

    const ungrouped = competencies.filter((c) => !c.groupId).length;

    const recentAudit = [...auditEvents]
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, 6);

    return { crOpen, crUnderReview, crSolved, oldestCR, competencyCount: competencies.length, groupCount: groups.length, ungrouped, recentAudit };
  }, [competencies, groups, changeRequests, auditEvents]);

  if (currentLogin?.systemRole !== "Administrator") {
    return <p className="text-sm text-muted-foreground">Administrator access required.</p>;
  }

  const oldestDays = stats.oldestCR
    ? Math.floor((Date.now() - new Date(stats.oldestCR.submittedAt).getTime()) / 86_400_000)
    : null;

  return (
    <>
      <PageHeader
        title="Admin Console"
        description="System health, governance, and catalog at a glance"
      />

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* Change Requests */}
        <Link to="/requests" className="block group">
        <Card className="h-full transition-colors group-hover:border-primary/40">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                <MailQuestion className="h-4 w-4 text-primary" />
              </div>
              <div>
                <div className="text-sm font-semibold">Change Requests</div>
                <div className="text-[11px] text-muted-foreground">Competency amendment proposals</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <StatCell label="Open"         value={stats.crOpen}        highlight={stats.crOpen > 0} />
              <StatCell label="Under Review" value={stats.crUnderReview} />
              <StatCell label="Solved"       value={stats.crSolved} />
            </div>
            {oldestDays !== null && (
              <p className="text-[11px] text-muted-foreground mt-2 pt-2 border-t">
                Oldest waiting {oldestDays} {oldestDays === 1 ? "day" : "days"} · {CR_STATUS_LABEL[stats.oldestCR!.status]}
              </p>
            )}
          </CardContent>
        </Card>
        </Link>

        {/* Competency Library */}
        <Link to="/competencies" className="block group">
        <Card className="h-full transition-colors group-hover:border-primary/40">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                <BookOpen className="h-4 w-4 text-primary" />
              </div>
              <div>
                <div className="text-sm font-semibold">Competency Library</div>
                <div className="text-[11px] text-muted-foreground">Competencies &amp; groups</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <StatCell label="Competencies" value={stats.competencyCount} />
              <StatCell label="Groups"       value={stats.groupCount} />
              <StatCell label="Ungrouped"    value={stats.ungrouped} highlight={stats.ungrouped > 0} />
            </div>
            {stats.ungrouped > 0 && (
              <p className="text-[11px] text-amber-600 mt-2 pt-2 border-t">
                {stats.ungrouped} ungrouped → needs group assignment
              </p>
            )}
            {stats.ungrouped === 0 && (
              <p className="text-[11px] text-muted-foreground mt-2 pt-2 border-t">
                All competencies are grouped
              </p>
            )}
          </CardContent>
        </Card>
        </Link>
      </div>

      {/* Recent governance activity */}
      <Card className="mb-6">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-semibold">Recent governance activity</div>
            <Link to="/audit" className="text-xs text-primary hover:underline">
              View audit log →
            </Link>
          </div>
          {stats.recentAudit.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent activity.</p>
          ) : (
            <div className="divide-y">
              {stats.recentAudit.map((event) => (
                <div key={event.id} className="flex items-start gap-3 py-2">
                  <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-[9px] font-semibold text-muted-foreground uppercase">
                      {event.actorRole?.[0] ?? "?"}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground leading-snug">{event.summary}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {new Date(event.timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Data Retention Policy */}
      <Card className="mb-6">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
              <HardDrive className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-semibold">Data Retention Policy</span>
                <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 text-[10px] font-normal">
                  Pending DHTS confirmation
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Step observations and competency achievements are retained for{" "}
                <strong className="text-foreground">7 years</strong>. Superseded records (older
                observations on the same step) are purged after the retention window; the{" "}
                <em>most current</em> rating per step and all achievement records are always
                preserved. Records linked to an active dispute or remediation hold are exempt
                from purge.
              </p>
              <p className="text-[11px] text-muted-foreground mt-2 italic">
                Note: this is illustrative in the prototype. The production system will run this
                as a scheduled backend job; the policy value above must be confirmed against Duke
                retention requirements before pilot.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="pt-4 border-t text-center text-[11px] text-muted-foreground flex items-center justify-center gap-1.5">
        <Sparkles className="h-3 w-3" />
        CareCompetencies · Administrator console
      </div>
    </>
  );
}

function StatCell({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-2xl font-semibold tabular-nums mt-0.5 ${highlight ? "text-amber-600" : ""}`}>
        {value}
      </div>
    </div>
  );
}

