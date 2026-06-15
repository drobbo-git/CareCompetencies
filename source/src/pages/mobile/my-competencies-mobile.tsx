import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/data/auth";
import { useData } from "@/data/store";
import { StageBadge } from "@/components/common/StageBadge";
import { STAGES, getStageDays, type Stage } from "@/data/types";
import {
  CalendarClock, CheckCircle2, AlertTriangle, Clock, ExternalLink,
} from "lucide-react";

function fmt(iso: string | undefined) {
  if (!iso) return "—";
  try { return new Date(iso.includes("T") ? iso : iso + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); }
  catch { return "—"; }
}

export default function MyCompetenciesMobile() {
  const { currentLogin } = useAuth();
  const {
    persons, units, personRoles, competencies, assignments, achievements, observations,
    getPersonStage, getDaysSinceStart, getCompetencyProgress,
  } = useData();

  const person = useMemo(() => persons.find((n) => n.id === currentLogin?.id), [persons, currentLogin]);
  const unit   = person ? units.find((u) => u.id === person.unitId) : undefined;
  const role   = person ? personRoles.find((r) => r.id === (person.roleId ?? "r-rn")) : undefined;
  const primaryPreceptor = person?.primaryPreceptorId ? persons.find((n) => n.id === person.primaryPreceptorId) : undefined;

  const stage        = person ? getPersonStage(person.id) : "Core";
  const daysSince    = person ? getDaysSinceStart(person.id) : 0;
  const stageDays    = getStageDays(unit);

  const stageWindow = useMemo(() => {
    if (stage === "FullyOriented" || stage === "Nonclinical") return null;
    let start = 0;
    for (const s of STAGES) {
      const dur = stageDays[s];
      if (s === stage) return { startDay: start, endDay: start + dur };
      start += dur;
    }
    return null;
  }, [stage, stageDays]);

  const stagePct = stageWindow
    ? Math.min(100, Math.max(0, ((daysSince - stageWindow.startDay) / (stageWindow.endDay - stageWindow.startDay)) * 100))
    : 0;
  const daysLeft = stageWindow ? Math.max(0, stageWindow.endDay - daysSince) : 0;
  const stageEndDate = useMemo(() => {
    if (!person || !stageWindow) return undefined;
    const d = new Date(person.startDate + "T12:00:00");
    d.setDate(d.getDate() + stageWindow.endDay);
    return d;
  }, [person, stageWindow]);

  const myAssignments = useMemo(() => {
    if (!person) return [];
    return assignments.filter((a) => a.unitId === person.unitId && a.roleId === (person.roleId ?? "r-rn"));
  }, [assignments, person]);

  const totalAchieved = myAssignments.filter((a) => person && getCompetencyProgress(person.id, a.competencyId) === "Achieved").length;
  const totalRequired = myAssignments.length;
  const overallPct    = totalRequired === 0 ? 0 : Math.round((totalAchieved / totalRequired) * 100);

  const currentStageIdx = stage === "FullyOriented" || stage === "Nonclinical" ? STAGES.length : STAGES.indexOf(stage as Stage);

  const overdueItems = useMemo(() => {
    if (!person || currentStageIdx <= 0) return [];
    return myAssignments
      .filter((a) => STAGES.indexOf(a.stage as Stage) < currentStageIdx && getCompetencyProgress(person.id, a.competencyId) !== "Achieved")
      .map((a) => competencies.find((c) => c.id === a.competencyId))
      .filter((c): c is NonNullable<typeof c> => !!c);
  }, [myAssignments, person, currentStageIdx, competencies, getCompetencyProgress]);

  const upNext = useMemo(() => {
    if (!person || stage === "FullyOriented" || stage === "Nonclinical") return [];
    return myAssignments
      .filter((a) => a.stage === stage && getCompetencyProgress(person.id, a.competencyId) !== "Achieved")
      .map((a) => {
        const comp = competencies.find((c) => c.id === a.competencyId);
        if (!comp) return null;
        const progress = getCompetencyProgress(person.id, a.competencyId);
        const lastObs = [...observations]
          .filter((o) => o.personId === person.id && o.competencyId === a.competencyId)
          .sort((x, y) => y.observedAt.localeCompare(x.observedAt))[0];
        return { comp, progress, lastObs };
      })
      .filter((x): x is NonNullable<typeof x> => !!x)
      .sort((a, b) => {
        if (a.progress !== b.progress) return a.progress === "InProgress" ? -1 : 1;
        return a.comp.name.localeCompare(b.comp.name);
      });
  }, [myAssignments, person, stage, competencies, observations, getCompetencyProgress]);

  const recentActivity = useMemo(() => {
    if (!person) return [];
    return [...achievements]
      .filter((a) => a.personId === person.id)
      .sort((a, b) => b.achievedAt.localeCompare(a.achievedAt))
      .slice(0, 5)
      .map((ach) => ({ ach, comp: competencies.find((c) => c.id === ach.competencyId) }))
      .filter((x) => !!x.comp);
  }, [achievements, person, competencies]);

  const perStage = useMemo(() => STAGES.map((s) => {
    const inStage = myAssignments.filter((a) => a.stage === s);
    const achieved = inStage.filter((a) => person && getCompetencyProgress(person.id, a.competencyId) === "Achieved").length;
    return { stage: s, total: inStage.length, achieved };
  }), [myAssignments, person, getCompetencyProgress]);

  if (!currentLogin || !person) return null;

  const firstName = person.name.split(/\s/)[0];

  return (
    <div className="space-y-5">

      {/* Welcome */}
      <div>
        <h1 className="text-xl font-bold">Welcome, {firstName}</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          {role?.name} · {unit?.name ?? "—"}
          {primaryPreceptor && <> · Preceptor: {primaryPreceptor.name}</>}
        </p>
      </div>

      {/* Stage timeline */}
      {stageWindow && (
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <CalendarClock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Current Stage</p>
              <div className="flex items-center gap-2 mt-0.5">
                <StageBadge stage={stage as Stage} />
                <span className="text-sm font-semibold">Day {daysSince}</span>
                <span className="text-xs text-muted-foreground">· {daysLeft} day{daysLeft !== 1 ? "s" : ""} left</span>
              </div>
            </div>
          </div>
          <div className="space-y-1">
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${stagePct}%` }} />
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Started {fmt(person.startDate)}</span>
              <span>Stage ends ~{stageEndDate ? fmt(stageEndDate.toISOString()) : "—"}</span>
            </div>
          </div>
        </div>
      )}

      {/* Progress summary */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span className="text-sm font-medium">Competencies Achieved</span>
          </div>
          <span className="text-sm font-bold text-emerald-600">{totalAchieved}/{totalRequired} · {overallPct}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${overallPct}%` }} />
        </div>
        <div className="space-y-2">
          {perStage.map(({ stage: s, total, achieved }) => {
            const pct = total > 0 ? Math.round((achieved / total) * 100) : 0;
            return (
              <div key={s} className="flex items-center gap-3">
                <StageBadge stage={s} size="sm" />
                {s === stage && <span className="text-[10px] text-primary font-semibold uppercase">Current</span>}
                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs text-muted-foreground tabular-nums shrink-0">{achieved}/{total}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Overdue */}
      {overdueItems.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50/50 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <span className="text-sm font-semibold text-red-800">{overdueItems.length} Overdue</span>
          </div>
          <ul className="space-y-1">
            {overdueItems.map((comp) => (
              <li key={comp.id}>
                <Link to={`/competencies/${comp.id}`} className="text-sm text-red-700 hover:underline">
                  {comp.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Up Next */}
      {upNext.length > 0 && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <p className="text-sm font-semibold">Up Next</p>
            <span className="text-xs text-muted-foreground">
              {stage !== "FullyOriented" && stage !== "Nonclinical" ? `${stage} stage · ` : ""}
              {upNext.length} remaining
            </span>
          </div>
          <ul className="divide-y">
            {upNext.map(({ comp, progress, lastObs }) => (
              <li key={comp.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link to={`/competencies/${comp.id}`} className="text-sm font-medium hover:underline truncate block">
                      {comp.name}
                    </Link>
                    {lastObs && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Last observed {fmt(lastObs.observedAt)}
                      </p>
                    )}
                  </div>
                  {progress === "InProgress" ? (
                    <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5 shrink-0 flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" /> In Progress
                    </span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground border border-dashed rounded-full px-2 py-0.5 shrink-0">Not Started</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recent Activity */}
      {recentActivity.length > 0 && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <p className="text-sm font-semibold">Recent Activity</p>
            <Link to="/audit" className="text-xs text-primary hover:underline flex items-center gap-0.5">
              Audit trail <ExternalLink className="h-3 w-3 ml-0.5" />
            </Link>
          </div>
          <ul className="divide-y">
            {recentActivity.map(({ ach, comp }) => (
              <li key={ach.id} className="px-4 py-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link to={`/competencies/${comp!.id}`} className="text-sm font-medium hover:underline truncate block">
                    {comp!.name}
                  </Link>
                  <p className="text-xs text-muted-foreground mt-0.5">{fmt(ach.achievedAt)}</p>
                </div>
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 shrink-0">
                  Achieved
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

    </div>
  );
}
