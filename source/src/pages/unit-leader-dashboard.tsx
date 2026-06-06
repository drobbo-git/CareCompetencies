import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/data/auth";
import { useData } from "@/data/store";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StageBadge, STAGE_HEX } from "@/components/common/StageBadge";
import { StageProgressRow } from "@/components/common/StageProgressRow";
import { UnitProgressTrend, type ProgressPoint } from "@/components/dashboard/UnitProgressTrend";
import { STAGES, type Stage, type StageOrFully } from "@/data/types";
import { Users, Grid3x3, Stethoscope, ClipboardCheck } from "lucide-react";

/**
 * Unit Leader landing page. Three layers of information density:
 *   1. Headline KPIs (orientees by stage, unit readiness %)
 *   2. Per-stage progress roll-up across the active orientees
 *   3. Trend chart (achievements cumulative) + watchlist of orientees flagged
 *      for outstanding prior-stage items
 */
export default function UnitLeaderDashboardPage() {
  const { currentLogin } = useAuth();
  const {
    units, persons, assignments, achievements, observations, competencies,
    getPersonStage,
  } = useData();

  const unit = useMemo(
    () => (currentLogin?.unitId ? units.find((u) => u.id === currentLogin.unitId) : undefined),
    [units, currentLogin],
  );

  // Active orientees on this unit (not Fully Oriented).
  const orientees = useMemo(() => {
    if (!unit) return [];
    return persons
      .filter((n) => n.unitId === unit.id && getPersonStage(n.id) !== "FullyOriented")
      .map((n) => ({ person: n, stage: getPersonStage(n.id) as Stage }));
  }, [persons, unit, getPersonStage]);

  // KPIs
  const orienteeCounts = useMemo(() => {
    const counts: Record<StageOrFully, number> = {
      Core: 0, Orientation: 0, Education: 0, FullyOriented: 0, Nonclinical: 0,
    };
    for (const o of orientees) counts[o.stage] += 1;
    return counts;
  }, [orientees]);

  // Unit readiness: across all orientees, what % of their assigned competencies are achieved.
  const readiness = useMemo(() => {
    if (!unit || orientees.length === 0) return { achieved: 0, total: 0, pct: 0 };
    let total = 0;
    let achieved = 0;
    for (const o of orientees) {
      const roleId = o.person.roleId ?? "r-rn";
      const compIds = assignments
        .filter((a) => a.unitId === unit.id && a.roleId === roleId)
        .map((a) => a.competencyId);
      total += compIds.length;
      achieved += compIds.filter((cid) =>
        achievements.some((ach) => ach.personId === o.person.id && ach.competencyId === cid),
      ).length;
    }
    return { achieved, total, pct: total === 0 ? 0 : Math.round((achieved / total) * 100) };
  }, [unit, orientees, assignments, achievements]);

  // Per-stage roll-up across the unit
  const perStage = useMemo(() => {
    if (!unit) return [];
    return STAGES.map((s) => {
      let total = 0;
      let achieved = 0;
      for (const o of orientees) {
        const roleId = o.person.roleId ?? "r-rn";
        const compIds = assignments
          .filter((a) => a.unitId === unit.id && a.roleId === roleId && a.stage === s)
          .map((a) => a.competencyId);
        total += compIds.length;
        achieved += compIds.filter((cid) =>
          achievements.some((ach) => ach.personId === o.person.id && ach.competencyId === cid),
        ).length;
      }
      return { stage: s, total, achieved };
    });
  }, [unit, orientees, assignments, achievements]);

  // Trend: cumulative achievement count by date.
  const trend: ProgressPoint[] = useMemo(() => {
    if (!unit) return [];
    const inScope = achievements.filter((ach) =>
      orientees.some((o) => o.person.id === ach.personId),
    );
    const byDate = new Map<string, number>();
    for (const a of inScope) {
      const d = a.achievedAt.slice(0, 10);
      byDate.set(d, (byDate.get(d) ?? 0) + 1);
    }
    const totalPossible = perStage.reduce((acc, p) => acc + p.total, 0) || 1;
    let cum = 0;
    return Array.from(byDate.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => {
        cum += count;
        return { date, achieved: cum, total: totalPossible };
      });
  }, [unit, achievements, orientees, perStage]);

  // Watchlist: orientees with outstanding prior-stage requirements.
  const watchlist = useMemo(() => {
    if (!unit) return [];
    const STAGE_RANK: Record<Stage, number> = { Core: 0, Orientation: 1, Education: 2 };
    return orientees
      .map((o) => {
        const roleId = o.person.roleId ?? "r-rn";
        const currentIdx = STAGE_RANK[o.stage];
        const priorStages = STAGES.filter((s) => STAGE_RANK[s] < currentIdx);
        let outstanding = 0;
        for (const s of priorStages) {
          const required = assignments
            .filter((a) => a.unitId === unit.id && a.roleId === roleId && a.stage === s)
            .map((a) => a.competencyId);
          outstanding += required.filter((cid) =>
            !achievements.some((ach) => ach.personId === o.person.id && ach.competencyId === cid),
          ).length;
        }
        return { person: o.person, stage: o.stage, outstanding };
      })
      .filter((row) => row.outstanding > 0)
      .sort((a, b) => b.outstanding - a.outstanding)
      .slice(0, 6);
  }, [unit, orientees, assignments, achievements]);

  // Recent activity (last 8 events on this unit)
  const recentActivity = useMemo(() => {
    if (!unit) return [];
    const events: { ts: string; label: string; kind: "achievement" | "observation" }[] = [];
    for (const ach of achievements) {
      const n = persons.find((x) => x.id === ach.personId);
      if (!n || n.unitId !== unit.id) continue;
      const c = competencies.find((x) => x.id === ach.competencyId);
      events.push({
        ts: ach.achievedAt,
        label: `${n.name} signed off on ${c?.name ?? "—"}`,
        kind: "achievement",
      });
    }
    for (const o of observations) {
      const n = persons.find((x) => x.id === o.personId);
      if (!n || n.unitId !== unit.id) continue;
      const c = competencies.find((x) => x.id === o.competencyId);
      events.push({
        ts: o.observedAt,
        label: `Step observed (${o.rating}) on ${c?.name ?? "—"} for ${n.name}`,
        kind: "observation",
      });
    }
    return events.sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 8);
  }, [unit, persons, achievements, observations, competencies]);

  if (!currentLogin) return null;
  if (!unit) {
    return (
      <>
        <PageHeader title="Unit Dashboard" />
        <p className="text-sm text-muted-foreground">
          Your Unit Leader login isn't associated with a unit. Ask your administrator to fix this.
        </p>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={`${unit.name} — Dashboard`}
        description={`${orientees.length} active orientee${orientees.length === 1 ? "" : "s"} · ${readiness.pct}% unit readiness`}
        actions={
          <div className="flex items-center gap-2">
            <Link to="/persons" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
              <Users className="h-3.5 w-3.5" /> Roster
            </Link>
            <Link to="/competency-matrix" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
              <Grid3x3 className="h-3.5 w-3.5" /> Matrix
            </Link>
          </div>
        }
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <Card>
          <CardContent className="pt-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Unit readiness</div>
            <div className="text-2xl font-semibold tabular-nums mt-0.5">{readiness.pct}%</div>
            <div className="text-xs text-muted-foreground">{readiness.achieved} / {readiness.total} signed off</div>
          </CardContent>
        </Card>
        {STAGES.map((s) => (
          <Card key={s}>
            <CardContent className="pt-4">
              <div className="text-[10px] uppercase tracking-wider" style={{ color: STAGE_HEX[s] }}>
                {s}
              </div>
              <div className="text-2xl font-semibold tabular-nums mt-0.5">{orienteeCounts[s] ?? 0}</div>
              <div className="text-xs text-muted-foreground">orientees</div>
            </CardContent>
          </Card>
        ))}
        <Card>
          <CardContent className="pt-4">
            <div className="text-[10px] uppercase tracking-wider text-green-700">Fully Oriented</div>
            <div className="text-2xl font-semibold tabular-nums mt-0.5">{orienteeCounts.FullyOriented ?? 0}</div>
            <div className="text-xs text-muted-foreground">excluded from active scope</div>
          </CardContent>
        </Card>
      </div>

      {/* Progress by stage + trend chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-6">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Progress by stage</CardTitle></CardHeader>
          <CardContent className="space-y-2.5">
            {perStage.map((p) => (
              <StageProgressRow key={p.stage} stage={p.stage} achieved={p.achieved} total={p.total} />
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Achievement trend</CardTitle></CardHeader>
          <CardContent>
            <UnitProgressTrend data={trend} />
          </CardContent>
        </Card>
      </div>

      {/* Watchlist + recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Watchlist</CardTitle>
            <p className="text-xs text-muted-foreground">Orientees with outstanding prior-stage requirements.</p>
          </CardHeader>
          <CardContent className="p-0">
            {watchlist.length === 0 && (
              <div className="px-4 py-6 text-sm text-muted-foreground">Everyone's caught up.</div>
            )}
            <ul className="divide-y">
              {watchlist.map((w) => (
                <li key={w.person.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                  <Link to={`/persons/${w.person.id}`} className="text-sm font-medium hover:underline truncate">
                    {w.person.name}
                  </Link>
                  <div className="flex items-center gap-2">
                    <StageBadge stage={w.stage} size="sm" />
                    <Badge variant="outline" className="text-[10px]">{w.outstanding} prior-stage open</Badge>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Recent activity</CardTitle></CardHeader>
          <CardContent className="p-0">
            {recentActivity.length === 0 && (
              <div className="px-4 py-6 text-sm text-muted-foreground">No recent activity.</div>
            )}
            <ul className="divide-y">
              {recentActivity.map((e, i) => (
                <li key={i} className="px-4 py-2 flex items-start justify-between gap-3 text-sm">
                  <div className="flex items-start gap-2 min-w-0">
                    {e.kind === "achievement"
                      ? <ClipboardCheck className="h-3.5 w-3.5 text-green-700 flex-shrink-0 mt-0.5" />
                      : <Stethoscope className="h-3.5 w-3.5 text-blue-700 flex-shrink-0 mt-0.5" />}
                    <span className="truncate">{e.label}</span>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(e.ts).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}