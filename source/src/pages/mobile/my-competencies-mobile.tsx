import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/data/auth";
import { useData } from "@/data/store";
import { StageBadge } from "@/components/common/StageBadge";
import { STAGES, getStageDays, type Stage } from "@/data/types";
import { CheckCircle2, AlertTriangle, Clock, CalendarDays } from "lucide-react";

function fmt(iso: string | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso.includes("T") ? iso : iso + "T12:00:00")
      .toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch { return "—"; }
}

export default function MyCompetenciesMobile() {
  const { currentLogin } = useAuth();
  const {
    persons, units, competencies, assignments, achievements, observations,
    getPersonStage, getDaysSinceStart, getCompetencyProgress,
  } = useData();

  const person = useMemo(() => persons.find((n) => n.id === currentLogin?.id), [persons, currentLogin]);
  const unit   = person ? units.find((u) => u.id === person.unitId) : undefined;
  const primaryPreceptor = person?.primaryPreceptorId
    ? persons.find((n) => n.id === person.primaryPreceptorId)
    : undefined;

  const stage     = person ? getPersonStage(person.id) : "Core";
  const daysSince = person ? getDaysSinceStart(person.id) : 0;
  const stageDays = getStageDays(unit);

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

  const daysLeft = stageWindow ? Math.max(0, stageWindow.endDay - daysSince) : 0;
  const stagePct = stageWindow
    ? Math.min(100, Math.max(0, ((daysSince - stageWindow.startDay) / (stageWindow.endDay - stageWindow.startDay)) * 100))
    : 0;

  const myAssignments = useMemo(() => {
    if (!person) return [];
    return assignments.filter(
      (a) => a.unitId === person.unitId && a.roleId === (person.roleId ?? "r-rn"),
    );
  }, [assignments, person]);

  const totalAchieved = myAssignments.filter(
    (a) => person && getCompetencyProgress(person.id, a.competencyId) === "Achieved",
  ).length;

  const currentStageIdx = stage === "FullyOriented" || stage === "Nonclinical"
    ? STAGES.length
    : STAGES.indexOf(stage as Stage);

  const overdueItems = useMemo(() => {
    if (!person || currentStageIdx <= 0) return [];
    return myAssignments
      .filter((a) =>
        STAGES.indexOf(a.stage as Stage) < currentStageIdx &&
        getCompetencyProgress(person.id, a.competencyId) !== "Achieved",
      )
      .map((a) => competencies.find((c) => c.id === a.competencyId))
      .filter((c): c is NonNullable<typeof c> => !!c);
  }, [myAssignments, person, currentStageIdx, competencies, getCompetencyProgress]);

  const dueNow = useMemo(() => {
    if (!person || stage === "FullyOriented" || stage === "Nonclinical") return [];
    return myAssignments
      .filter((a) =>
        a.stage === stage &&
        getCompetencyProgress(person.id, a.competencyId) !== "Achieved",
      )
      .map((a) => {
        const comp = competencies.find((c) => c.id === a.competencyId);
        if (!comp) return null;
        const progress = getCompetencyProgress(person.id, a.competencyId);
        const lastObs = [...observations]
          .filter((o) => o.personId === person.id && o.competencyId === comp.id)
          .sort((x, y) => y.observedAt.localeCompare(x.observedAt))[0];
        return { comp, progress, lastObs };
      })
      .filter((x): x is NonNullable<typeof x> => !!x)
      .sort((a, b) => {
        if (a.progress !== b.progress) return a.progress === "InProgress" ? -1 : 1;
        return a.comp.name.localeCompare(b.comp.name);
      });
  }, [myAssignments, person, stage, competencies, observations, getCompetencyProgress]);

  const recentAchievements = useMemo(() => {
    if (!person) return [];
    return [...achievements]
      .filter((a) => a.personId === person.id)
      .sort((a, b) => b.achievedAt.localeCompare(a.achievedAt))
      .slice(0, 3)
      .map((ach) => ({ ach, comp: competencies.find((c) => c.id === ach.competencyId) }))
      .filter((x) => !!x.comp);
  }, [achievements, person, competencies]);

  if (!currentLogin || !person) return null;

  const firstName = person.name.split(/\s/)[0];
  const totalRequired = myAssignments.length;
  const overallPct = totalRequired === 0 ? 0 : Math.round((totalAchieved / totalRequired) * 100);

  return (
    <div className="space-y-4">

      {/* Welcome + stage status */}
      <div className="rounded-2xl border bg-card p-5 space-y-4">
        <div>
          <h1 className="text-xl font-bold">Hi, {firstName}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {unit?.name ?? "—"}
            {primaryPreceptor && <> · Preceptor: {primaryPreceptor.name}</>}
          </p>
        </div>

        {stage !== "FullyOriented" && stage !== "Nonclinical" && stageWindow ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <StageBadge stage={stage as Stage} />
                <span className="text-sm font-semibold flex items-center gap-1 text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Day {daysSince}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">{daysLeft} day{daysLeft !== 1 ? "s" : ""} left</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${stagePct}%` }} />
            </div>
          </div>
        ) : (
          <StageBadge stage={stage} />
        )}

        <div className="flex items-center justify-between pt-1 border-t">
          <span className="text-xs text-muted-foreground">Overall progress</span>
          <span className="text-sm font-bold text-emerald-600">
            {totalAchieved} / {totalRequired} achieved · {overallPct}%
          </span>
        </div>
      </div>

      {/* Overdue */}
      {overdueItems.length > 0 && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
            <p className="text-sm font-semibold text-red-800">
              {overdueItems.length} overdue competenc{overdueItems.length === 1 ? "y" : "ies"}
            </p>
          </div>
          <ul className="space-y-1.5">
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

      {/* Due in current stage */}
      {dueNow.length > 0 && (
        <div className="rounded-2xl border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <p className="text-sm font-semibold">
              {stage !== "FullyOriented" && stage !== "Nonclinical" ? `${stage} stage` : "Up next"}
            </p>
            <span className="text-xs text-muted-foreground">{dueNow.length} remaining</span>
          </div>
          <ul className="divide-y">
            {dueNow.map(({ comp, progress, lastObs }) => (
              <li key={comp.id} className="px-4 py-3.5 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link to={`/competencies/${comp.id}`} className="text-sm font-medium hover:underline block truncate">
                    {comp.name}
                  </Link>
                  {lastObs && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Last observed {fmt(lastObs.observedAt)}
                    </p>
                  )}
                </div>
                {progress === "InProgress" ? (
                  <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5 shrink-0 flex items-center gap-1 whitespace-nowrap">
                    <Clock className="h-2.5 w-2.5" /> In Progress
                  </span>
                ) : (
                  <span className="text-[10px] text-muted-foreground border border-dashed rounded-full px-2 py-0.5 shrink-0 whitespace-nowrap">
                    Not Started
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* All done for current stage */}
      {dueNow.length === 0 && overdueItems.length === 0 && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 flex items-center gap-3">
          <CheckCircle2 className="h-6 w-6 text-emerald-500 shrink-0" />
          <p className="text-sm font-medium text-emerald-800">
            {stage === "FullyOriented"
              ? "All competencies complete — you're in continuous learning!"
              : "All current-stage competencies are on track. Great work!"}
          </p>
        </div>
      )}

      {/* Recent achievements */}
      {recentAchievements.length > 0 && (
        <div className="rounded-2xl border bg-card overflow-hidden">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-4 py-3 border-b">
            Recently achieved
          </p>
          <ul className="divide-y">
            {recentAchievements.map(({ ach, comp }) => (
              <li key={ach.id} className="px-4 py-3 flex items-center justify-between gap-2">
                <Link to={`/competencies/${comp!.id}`} className="text-sm font-medium hover:underline truncate">
                  {comp!.name}
                </Link>
                <span className="text-xs text-muted-foreground shrink-0">{fmt(ach.achievedAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

    </div>
  );
}
