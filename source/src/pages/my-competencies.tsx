import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-is-mobile";
import MyCompetenciesMobile from "@/pages/mobile/my-competencies-mobile";
import { HoverCard } from "radix-ui";
import { useAuth } from "@/data/auth";
import { useData } from "@/data/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StageBadge } from "@/components/common/StageBadge";
import { STAGES, getStageDays, type Stage, type SelfAssessmentRating } from "@/data/types";
import type { Competency, CompetencyCategory } from "@/data/types";

const SA_BADGE: Record<SelfAssessmentRating, { label: string; cls: string }> = {
  ReadyForAssessment: { label: "Ready",      cls: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  NeedPractice:       { label: "Practice",   cls: "bg-amber-100 text-amber-800 border-amber-300" },
  NeedInstruction:    { label: "Needs help", cls: "bg-rose-100 text-rose-800 border-rose-300" },
};
import { openCompetencySummaryWindow } from "@/lib/competency-summary";
import { getOtherCompetencyAchievements } from "@/lib/other-competencies";
import {
  CalendarClock, CheckCircle2, Clock, AlertTriangle,
  FileText, ClipboardList,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------
function fmtDate(d: Date | undefined): string {
  if (!d) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function fmtISO(iso: string | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso.includes("T") ? iso : iso + "T12:00:00");
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch { return "—"; }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function MyCompetenciesPage() {
  const isMobile = useIsMobile();
  if (isMobile) return <MyCompetenciesMobile />;

  const navigate = useNavigate();
  const { currentLogin } = useAuth();
  const {
    persons, units, personRoles, categories, groups,
    competencies, steps, assignments, achievements, observations, selfAssessments,
    getPersonStage, getDaysSinceStart, getCompetencyProgress,
  } = useData();

  const person = useMemo(
    () => persons.find((n) => n.id === currentLogin?.id),
    [persons, currentLogin],
  );
  const unit = person ? units.find((u) => u.id === person.unitId) : undefined;
  const role = person ? personRoles.find((r) => r.id === (person.roleId ?? "r-rn")) : undefined;
  const primaryPreceptor = person?.primaryPreceptorId
    ? persons.find((n) => n.id === person.primaryPreceptorId)
    : undefined;

  const stage = person ? getPersonStage(person.id) : "Core";
  const daysSinceStart = person ? getDaysSinceStart(person.id) : 0;
  const stageDays = getStageDays(unit);

  // Stage window boundaries (in days from startDate)
  const stageWindow = useMemo(() => {
    if (stage === "FullyOriented" || stage === "Nonclinical") return null;
    let startDay = 0;
    for (const s of STAGES) {
      const dur = stageDays[s];
      if (s === stage) return { startDay, endDay: startDay + dur };
      startDay += dur;
    }
    return null;
  }, [stage, stageDays]);

  const stageProgress = stageWindow
    ? Math.min(100, Math.max(0,
        ((daysSinceStart - stageWindow.startDay) / (stageWindow.endDay - stageWindow.startDay)) * 100,
      ))
    : 0;

  const daysRemaining = stageWindow ? Math.max(0, stageWindow.endDay - daysSinceStart) : 0;

  const stageEndDate = useMemo(() => {
    if (!person || !stageWindow) return undefined;
    const d = new Date(person.startDate + "T12:00:00");
    d.setDate(d.getDate() + stageWindow.endDay);
    return d;
  }, [person, stageWindow]);

  // My required assignments (current unit + role)
  const myAssignments = useMemo(() => {
    if (!person) return [];
    return assignments.filter(
      (a) => a.unitId === person.unitId && a.roleId === (person.roleId ?? "r-rn"),
    );
  }, [assignments, person]);

  const currentStageIdx = stage === "FullyOriented" || stage === "Nonclinical"
    ? STAGES.length
    : STAGES.indexOf(stage as Stage);

  // Per-stage rollup (includes competency detail for hover popover)
  const perStage = useMemo(() => {
    if (!person) return [];
    return STAGES.map((s, sIdx) => {
      const isOverdue = sIdx < currentStageIdx;
      const inStage = myAssignments.filter((a) => a.stage === s);
      const withComp = inStage
        .map((a) => {
          const comp = competencies.find((c) => c.id === a.competencyId);
          const cat = comp ? categories.find((c) => c.id === comp.categoryId) : undefined;
          const progress = getCompetencyProgress(person.id, a.competencyId);
          const overdue = isOverdue && progress !== "Achieved";
          return comp ? { comp, cat, progress, overdue } : null;
        })
        .filter((x): x is { comp: Competency; cat: CompetencyCategory | undefined; progress: "Achieved" | "InProgress" | "NotStarted"; overdue: boolean } => !!x)
        .sort((a, b) => {
          if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
          if (a.progress === "Achieved" && b.progress !== "Achieved") return 1;
          if (a.progress !== "Achieved" && b.progress === "Achieved") return -1;
          return a.comp.name.localeCompare(b.comp.name);
        });
      const achieved = withComp.filter((x) => x.progress === "Achieved");
      const remaining = withComp.filter((x) => x.progress !== "Achieved");
      return { stage: s, total: inStage.length, achieved: achieved.length, inProgress: remaining.filter(x => x.progress === "InProgress").length, achievedItems: achieved, remainingItems: remaining, items: withComp };
    });
  }, [myAssignments, person, competencies, categories, getCompetencyProgress, currentStageIdx]);

  const totalAchieved = perStage.reduce((s, r) => s + r.achieved, 0);
  const totalRequired = myAssignments.length;
  const overallPct = totalRequired === 0 ? 0 : Math.round((totalAchieved / totalRequired) * 100);

  // Overdue: prior-stage competencies not yet achieved
  const overdueItems = useMemo(() => {
    if (!person || currentStageIdx <= 0) return [];
    const priorStages = STAGES.slice(0, currentStageIdx);
    return myAssignments
      .filter((a) => priorStages.includes(a.stage as Stage) && getCompetencyProgress(person.id, a.competencyId) !== "Achieved")
      .map((a) => {
        const comp = competencies.find((c) => c.id === a.competencyId);
        const cat = comp ? categories.find((c) => c.id === comp.categoryId) : undefined;
        return comp ? { comp, cat, stageLabel: a.stage as Stage } : null;
      })
      .filter((x): x is NonNullable<typeof x> => !!x)
      .sort((a, b) => a.comp.name.localeCompare(b.comp.name));
  }, [myAssignments, person, currentStageIdx, competencies, categories, getCompetencyProgress]);

  const overdueCount = overdueItems.length;

  const inProgressItems = useMemo(() => {
    if (!person) return [];
    return myAssignments
      .filter((a) => getCompetencyProgress(person.id, a.competencyId) === "InProgress")
      .map((a) => {
        const comp = competencies.find((c) => c.id === a.competencyId);
        const cat = comp ? categories.find((c) => c.id === comp.categoryId) : undefined;
        return comp ? { comp, cat, stageLabel: a.stage as Stage } : null;
      })
      .filter((x): x is NonNullable<typeof x> => !!x)
      .sort((a, b) => a.comp.name.localeCompare(b.comp.name));
  }, [myAssignments, person, competencies, categories, getCompetencyProgress]);

  // Other: achievements not required in current unit/role
  const otherItems = useMemo(
    () => getOtherCompetencyAchievements(person, achievements, assignments, competencies, units),
    [person, achievements, assignments, competencies, units],
  );


  // Competency Summary window
  function handleSummary() {
    if (!person) return;
    openCompetencySummaryWindow({
      person, unit, role,
      primaryPreceptorName: primaryPreceptor?.name,
      persons, competencies, steps, categories, groups,
      assignments, observations, achievements, units,
      currentStage: stage,
      daysSinceStart,
    });
  }

  if (!currentLogin) return null;
  if (!person) {
    return (
      <p className="text-sm text-muted-foreground">
        No matching person record. Ask your administrator to link your sign-in to a person record.
      </p>
    );
  }

  const firstName = person.name.split(/\s/)[0];

  return (
    <div className="space-y-5">

      {/* ── Welcome header ──────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold tracking-tight">Welcome, {firstName}</h1>
            <Badge variant="outline" className="text-xs text-amber-600 border-amber-300 bg-amber-50">
              Demo prototype
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {unit?.name ?? "—"}
            {primaryPreceptor && (
              <> · Primary preceptor: {primaryPreceptor.name}</>
            )}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleSummary} className="shrink-0 gap-1.5">
          <FileText className="h-4 w-4" />
          Competency Summary
        </Button>
      </div>

      {/* ── Stage timeline card ─────────────────────────────────────── */}
      {stageWindow && (
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex items-center gap-3 shrink-0">
                <div className="h-11 w-11 rounded-lg bg-primary/10 flex items-center justify-center">
                  <CalendarClock className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                    Current Stage
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <StageBadge stage={stage as Stage} />
                    <span className="text-sm font-semibold text-foreground">Day {daysSinceStart}</span>
                  </div>
                </div>
              </div>

              <div className="flex-1 w-full">
                <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                  <span>Days {stageWindow.startDay}–{stageWindow.endDay}</span>
                  <span className="font-medium text-foreground">
                    {daysRemaining} day{daysRemaining !== 1 ? "s" : ""} remaining
                  </span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${stageProgress}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-1.5">
                  <span>Started {fmtISO(person.startDate)}</span>
                  <span>Stage ends ~{fmtDate(stageEndDate)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Stat cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">

        {/* Competencies Achieved */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Competencies Achieved
              </span>
            </div>
            <div className="flex items-baseline gap-1.5 mb-1">
              <span className="text-3xl font-bold">{totalAchieved}</span>
              <span className="text-sm text-muted-foreground">/ {totalRequired}</span>
              <span className="ml-auto text-sm font-semibold text-emerald-600">{overallPct}%</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-3">
              <div
                className="h-full bg-emerald-500 rounded-full"
                style={{ width: `${overallPct}%` }}
              />
            </div>
            <div className="space-y-2">
              {perStage.map((ps, sIdx) => {
                const pct = ps.total > 0 ? Math.round((ps.achieved / ps.total) * 100) : 0;
                const isPrior = sIdx < currentStageIdx;
                const isComplete = isPrior && ps.total > 0 && ps.achieved === ps.total;
                const isIncomplete = isPrior && ps.total > 0 && ps.achieved < ps.total;
                return (
                  <HoverCard.Root key={ps.stage} openDelay={150} closeDelay={100}>
                    <HoverCard.Trigger asChild>
                      <button className={`w-full text-left group cursor-default rounded-md px-1.5 py-1 transition-colors -mx-1.5 ${isComplete ? "bg-emerald-50 hover:bg-emerald-100" : isIncomplete ? "bg-amber-50 hover:bg-amber-100" : "hover:bg-accent"}`}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <div className="flex items-center gap-1.5">
                            <StageBadge stage={ps.stage} size="sm" />
                            {stage === ps.stage && (
                              <span className="text-primary font-semibold text-[10px] uppercase">Current</span>
                            )}
                          </div>
                          <span className="text-muted-foreground tabular-nums">
                            {ps.achieved}/{ps.total}
                            {ps.total > 0 && (
                              <span className="ml-1 text-[10px]">({pct}%)</span>
                            )}
                          </span>
                        </div>
                        <div className="h-1 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${isComplete ? "bg-emerald-500" : isIncomplete ? "bg-amber-500" : "bg-primary"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </button>
                    </HoverCard.Trigger>
                    <HoverCard.Portal>
                      <HoverCard.Content
                        side="bottom"
                        align="start"
                        sideOffset={6}
                        className="z-50 w-72 rounded-lg border bg-popover shadow-lg outline-none animate-in fade-in-0 zoom-in-95"
                      >
                        {/* Popover header */}
                        <div className="flex items-center gap-2 px-3 py-2 border-b">
                          <StageBadge stage={ps.stage} size="sm" />
                          <span className="text-xs text-muted-foreground">
                            {ps.achieved} achieved · {ps.remainingItems.length} remaining
                          </span>
                        </div>
                        {/* Scrollable list */}
                        <div className="max-h-64 overflow-y-auto">
                          {ps.achievedItems.map(({ comp, cat }) => (
                            <div key={comp.id} className="flex items-start gap-2.5 px-3 py-2 hover:bg-muted/50">
                              <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{comp.name}</p>
                                {cat && <p className="text-[11px] text-muted-foreground">{cat.name}</p>}
                              </div>
                            </div>
                          ))}
                          {ps.remainingItems.length > 0 && (
                            <>
                              <div className="px-3 py-1.5 border-t">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                  Remaining
                                </span>
                              </div>
                              {ps.remainingItems.map(({ comp, cat }) => (
                                <div key={comp.id} className="flex items-start gap-2.5 px-3 py-2 hover:bg-muted/50">
                                  <div className="h-4 w-4 mt-0.5 shrink-0 rounded-full border-2 border-muted-foreground/30" />
                                  <div className="min-w-0">
                                    <p className="text-sm truncate">{comp.name}</p>
                                    {cat && <p className="text-[11px] text-muted-foreground">{cat.name}</p>}
                                  </div>
                                </div>
                              ))}
                            </>
                          )}
                        </div>
                      </HoverCard.Content>
                    </HoverCard.Portal>
                  </HoverCard.Root>
                );
              })}

              {/* Other competencies stripe */}
              {otherItems.length > 0 && (
                <>
                  <div className="my-2 border-t border-border" />
                  <HoverCard.Root openDelay={150} closeDelay={100}>
                    <HoverCard.Trigger asChild>
                      <button className="w-full text-left cursor-default rounded-md px-1.5 py-1 hover:bg-accent transition-colors -mx-1.5">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <Badge variant="secondary" className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0 font-medium text-muted-foreground">
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            Other
                          </Badge>
                          <span className="text-muted-foreground tabular-nums">{otherItems.length}</span>
                        </div>
                        <div className="h-1 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-slate-400 rounded-full w-full" />
                        </div>
                      </button>
                    </HoverCard.Trigger>
                    <HoverCard.Portal>
                      <HoverCard.Content
                        side="bottom"
                        align="start"
                        sideOffset={6}
                        className="z-50 w-72 rounded-lg border bg-popover shadow-lg outline-none animate-in fade-in-0 zoom-in-95"
                      >
                        <div className="flex items-center gap-2 px-3 py-2 border-b">
                          <Badge variant="secondary" className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0 font-medium text-muted-foreground">
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            Other
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {otherItems.length} competenc{otherItems.length === 1 ? "y" : "ies"} earned elsewhere
                          </span>
                        </div>
                        <div className="max-h-64 overflow-y-auto">
                          {otherItems.map(({ achievement, competency, earnedAtUnit, earnedAtStage }) => (
                            <div key={achievement.id} className="flex items-start gap-2.5 px-3 py-2 hover:bg-muted/50">
                              <CheckCircle2 className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{competency.name}</p>
                                <p className="text-[11px] text-muted-foreground">
                                  {earnedAtUnit ? `Earned at ${earnedAtUnit.name}` : "Prior unit"}
                                  {earnedAtStage ? ` · ${earnedAtStage}` : ""}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </HoverCard.Content>
                    </HoverCard.Portal>
                  </HoverCard.Root>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Overdue */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className={`h-4 w-4 ${overdueCount > 0 ? "text-red-500" : "text-muted-foreground"}`} />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Overdue
              </span>
            </div>
            <div className={`text-3xl font-bold mb-3 ${overdueCount > 0 ? "text-red-600" : ""}`}>
              {overdueCount}
            </div>
            {overdueItems.length === 0 ? (
              <p className="text-xs text-muted-foreground">No overdue competencies.</p>
            ) : (
              <ul className="space-y-2">
                {overdueItems.map(({ comp, cat, stageLabel }) => (
                  <li key={comp.id} className="flex items-start gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-red-400 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <Link to={`/competencies/${comp.id}`} className="text-xs font-medium hover:underline truncate block">
                        {comp.name}
                      </Link>
                      <p className="text-[11px] text-muted-foreground">
                        {cat?.name ?? "—"} · <StageBadge stage={stageLabel} size="sm" />
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* In Progress */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-4 w-4 text-blue-500" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                In Progress
              </span>
            </div>
            <div className="text-3xl font-bold mb-3">{inProgressItems.length}</div>
            {inProgressItems.length === 0 ? (
              <p className="text-xs text-muted-foreground">No competencies in progress.</p>
            ) : (
              <ul className="space-y-2">
                {inProgressItems.map(({ comp, cat, stageLabel }) => (
                  <li key={comp.id} className="flex items-start gap-2">
                    <Clock className="h-3.5 w-3.5 text-blue-400 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <Link to={`/competencies/${comp.id}`} className="text-xs font-medium hover:underline truncate block">
                        {comp.name}
                      </Link>
                      <p className="text-[11px] text-muted-foreground">
                        {cat?.name ?? "—"} · <StageBadge stage={stageLabel} size="sm" />
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

      </div>

      {/* ── Required Competencies ────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Required Competencies</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {perStage.every((ps) => ps.total === 0) ? (
            <p className="px-4 pb-4 text-sm text-muted-foreground">No competency assignments found.</p>
          ) : (
            <div>
              {perStage.map(({ stage: s, total, achieved, items }, sIdx) => {
                if (total === 0) return null;
                const isCurrentStage = s === stage;
                const isPriorStage   = sIdx < currentStageIdx;
                const overdueCount   = items.filter((i) => i.overdue).length;
                return (
                  <div key={s}>
                    <div className={`flex items-center gap-2 px-4 py-2 border-t first:border-t-0 ${isPriorStage && overdueCount > 0 ? "bg-red-50" : "bg-muted/40"}`}>
                      <StageBadge stage={s} size="sm" />
                      {isCurrentStage && (
                        <span className="text-[10px] font-semibold text-primary uppercase tracking-wide">Current</span>
                      )}
                      {overdueCount > 0 && (
                        <span className="flex items-center gap-1 text-[10px] font-semibold text-red-600">
                          <AlertTriangle className="h-3 w-3" />
                          {overdueCount} overdue
                        </span>
                      )}
                      <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                        {achieved}/{total} achieved
                      </span>
                    </div>
                    <ul className="divide-y">
                      {items.map(({ comp, progress, overdue }) => {
                        const latestSA = [...selfAssessments]
                          .filter((sa) => sa.personId === person.id && sa.competencyId === comp.id)
                          .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))[0];
                        return (
                          <li
                            key={comp.id}
                            className={`px-4 py-2.5 flex items-center justify-between gap-3 ${overdue ? "bg-red-50/50" : ""}`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              {progress === "Achieved" ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                              ) : overdue ? (
                                <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
                              ) : progress === "InProgress" ? (
                                <Clock className="h-4 w-4 text-blue-400 shrink-0" />
                              ) : (
                                <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />
                              )}
                              <Link
                                to={`/competencies/${comp.id}`}
                                className={`text-sm font-medium hover:underline truncate ${overdue ? "text-red-800" : ""}`}
                              >
                                {comp.name}
                              </Link>
                            </div>
                            {progress !== "Achieved" && (
                              <div className="flex items-center gap-2 shrink-0">
                                {latestSA && (
                                  <span className={`text-[10px] font-medium border rounded-full px-2 py-0.5 ${SA_BADGE[latestSA.overallRating].cls}`}>
                                    {SA_BADGE[latestSA.overallRating].label}
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => navigate(`/my-competencies/self-assess/${comp.id}`)}
                                  className="flex items-center gap-1 px-2.5 py-1 rounded-md border text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                                >
                                  <ClipboardList className="h-3 w-3" />
                                  {latestSA ? "Re-assess" : "Self-assess"}
                                </button>
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
