import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useAuth } from "@/data/auth";
import { useData } from "@/data/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StageBadge } from "@/components/common/StageBadge";
import { getStageDays, STAGES, type Stage, type StageOrFully } from "@/data/types";
import {
  AlertTriangle, ArrowRight, CalendarClock, GitPullRequestArrow,
  Sparkles, Users, TrendingUp, ClipboardList, TimerOff,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Chart colors — indigo/amber for observations, blue for achievements,
// stage-matched for completions
// ---------------------------------------------------------------------------
const OBS_SAT   = "#6366f1";   // indigo
const OBS_UNSAT = "#f59e0b";   // amber
const ACH_COLOR = "#3b82f6";   // blue
const STAGE_CHART_COLOR: Record<Stage, string> = {
  Core:        "#dc2626",
  Orientation: "#b45309",
  Education:   "#3b82f6",
};

// ---------------------------------------------------------------------------
// Week helpers
// ---------------------------------------------------------------------------
function mondayOf(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getUTCDay();
  const diff = (day === 0 ? -6 : 1 - day);
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

function lastNWeekStarts(n: number): string[] {
  const today = new Date();
  const thisMonday = mondayOf(today.toISOString());
  const weeks: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(thisMonday);
    d.setUTCDate(d.getUTCDate() - i * 7);
    weeks.push(d.toISOString().slice(0, 10));
  }
  return weeks;
}

function shortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${parseInt(m)}/${parseInt(d)}`;
}

function addDays(dateStr: string, days: number): Date {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d;
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / 86400000);
}

const TODAY = new Date(new Date().toDateString()); // midnight local

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function UnitLeaderDashboardPage() {
  const navigate = useNavigate();
  const { currentLogin } = useAuth();
  const {
    units, persons, personRoles, privileges, assignments,
    observations, achievements, getPersonStage, getDaysSinceStart,
  } = useData();

  const unit = useMemo(
    () => currentLogin?.unitIds?.[0] ? units.find((u) => u.id === currentLogin.unitIds![0]) : undefined,
    [units, currentLogin],
  );

  const stageDays = useMemo(() => getStageDays(unit), [unit]);

  // All persons on this unit
  const unitPersons = useMemo(
    () => (unit ? persons.filter((p) => p.unitId === unit.id) : []),
    [persons, unit],
  );

  // Active learners (not FullyOriented / Nonclinical)
  const orientees = useMemo(
    () => unitPersons.filter((p) => {
      const s = getPersonStage(p.id);
      return s !== "FullyOriented" && s !== "Nonclinical";
    }),
    [unitPersons, getPersonStage],
  );

  // ── Staff profile ──────────────────────────────────────────────────────────
  const staffProfile = useMemo(() => {
    const counts: Record<StageOrFully, number> = {
      Core: 0, Orientation: 0, Education: 0, FullyOriented: 0, Nonclinical: 0,
    };
    for (const p of unitPersons) counts[getPersonStage(p.id)]++;
    return counts;
  }, [unitPersons, getPersonStage]);

  // ── Health check (overdue) ─────────────────────────────────────────────────
  const healthFlags = useMemo(() => {
    if (!unit) return [];
    const cumDays: Record<Stage, number> = {
      Core:        stageDays.Core,
      Orientation: stageDays.Core + stageDays.Orientation,
      Education:   stageDays.Core + stageDays.Orientation + stageDays.Education,
    };
    return orientees.flatMap((p) => {
      const stage = getPersonStage(p.id) as Stage;
      const stageEndDate = addDays(p.startDate, cumDays[stage]);
      const daysOverdue = daysBetween(stageEndDate, TODAY);
      if (daysOverdue <= 0) return [];
      const roleId = p.roleId ?? "r-rn";
      const stageCompIds = assignments
        .filter((a) => a.unitId === unit.id && a.roleId === roleId && a.stage === stage)
        .map((a) => a.competencyId);
      const achieved = stageCompIds.filter((cid) =>
        achievements.some((a) => a.personId === p.id && a.competencyId === cid),
      ).length;
      const unachieved = stageCompIds.length - achieved;
      if (unachieved === 0) return [];
      const role = personRoles.find((r) => r.id === roleId);
      return [{
        person: p,
        roleName: role?.name ?? "",
        stage,
        stageEndDate,
        daysOverdue,
        unachieved,
        total: stageCompIds.length,
      }];
    }).sort((a, b) => b.daysOverdue - a.daysOverdue);
  }, [unit, orientees, stageDays, assignments, achievements, getPersonStage, personRoles]);

  // ── Planner (path to independence) ────────────────────────────────────────
  const plannerBuckets = useMemo(() => {
    const totalDays = stageDays.Core + stageDays.Orientation + stageDays.Education;
    const items = orientees.map((p) => {
      const projected = addDays(p.startDate, totalDays);
      const daysUntil = daysBetween(TODAY, projected);
      const stage = getPersonStage(p.id) as Stage;
      return { person: p, stage, projected, daysUntil };
    }).sort((a, b) => a.daysUntil - b.daysUntil);

    const buckets = [
      { key: "behind",  label: "Behind",    sub: "projected past today", max: 0,  min: -Infinity, items: [] as typeof items },
      { key: "2w",      label: "≤ 2 weeks", sub: "due soon",             max: 14, min: 1,         items: [] as typeof items },
      { key: "4w",      label: "≤ 4 weeks", sub: "4w window",            max: 28, min: 15,        items: [] as typeof items },
      { key: "8w",      label: "≤ 8 weeks", sub: "2 months out",         max: 56, min: 29,        items: [] as typeof items },
      { key: "3mo",     label: "≤ 3 months",sub: "q-out",                max: 91, min: 57,        items: [] as typeof items },
      { key: "later",   label: "Later",     sub: "longer",               max: Infinity, min: 92,  items: [] as typeof items },
    ];
    for (const item of items) {
      const bucket = buckets.find((b) => item.daysUntil >= b.min && item.daysUntil <= b.max)
        ?? (item.daysUntil < 0 ? buckets[0] : buckets[buckets.length - 1]);
      bucket.items.push(item);
    }
    return buckets;
  }, [orientees, stageDays, getPersonStage]);

  // ── Unit Progress Trend (last 12 weeks) ───────────────────────────────────
  const trendData = useMemo(() => {
    if (!unit) return [];
    const weeks = lastNWeekStarts(12);
    const weekSet = new Set(weeks);

    const obsByWeek = new Map<string, { sat: number; unsat: number }>();
    const achByWeek = new Map<string, number>();
    const stageCompByWeek = new Map<string, Record<Stage, number>>();

    for (const w of weeks) {
      obsByWeek.set(w, { sat: 0, unsat: 0 });
      achByWeek.set(w, 0);
      stageCompByWeek.set(w, { Core: 0, Orientation: 0, Education: 0 });
    }

    // Step observations for unit orientees
    const unitPersonIds = new Set(unitPersons.map((p) => p.id));
    for (const o of observations) {
      if (!unitPersonIds.has(o.personId)) continue;
      const w = mondayOf(o.observedAt);
      if (!weekSet.has(w)) continue;
      const bucket = obsByWeek.get(w)!;
      if (o.rating === "Satisfactory") bucket.sat++;
      else if (o.rating === "Unsatisfactory") bucket.unsat++;
    }

    // Achievements
    for (const a of achievements) {
      if (!unitPersonIds.has(a.personId)) continue;
      const w = mondayOf(a.achievedAt);
      if (!weekSet.has(w)) continue;
      achByWeek.set(w, (achByWeek.get(w) ?? 0) + 1);
    }

    // Stage completions — week the LAST competency for a stage was achieved
    for (const p of unitPersons) {
      const roleId = p.roleId ?? "r-rn";
      for (const s of STAGES) {
        const compIds = assignments
          .filter((a) => a.unitId === unit.id && a.roleId === roleId && a.stage === s)
          .map((a) => a.competencyId);
        if (compIds.length === 0) continue;
        const achDates = compIds.map((cid) =>
          achievements.find((a) => a.personId === p.id && a.competencyId === cid)?.achievedAt,
        );
        if (achDates.some((d) => !d)) continue; // not all achieved
        const last = achDates.reduce((max, d) => (d! > max! ? d : max))!;
        const w = mondayOf(last);
        if (!weekSet.has(w)) continue;
        const bucket = stageCompByWeek.get(w)!;
        bucket[s]++;
      }
    }

    return weeks.map((w) => ({
      week: shortDate(w),
      satisfactory: obsByWeek.get(w)!.sat,
      unsatisfactory: obsByWeek.get(w)!.unsat,
      achievements: achByWeek.get(w) ?? 0,
      Core:        stageCompByWeek.get(w)!.Core,
      Orientation: stageCompByWeek.get(w)!.Orientation,
      Education:   stageCompByWeek.get(w)!.Education,
    }));
  }, [unit, unitPersons, observations, achievements, assignments]);

  // ── Preceptor load ─────────────────────────────────────────────────────────
  const preceptorLoad = useMemo(() => {
    if (!unit) return [];
    const priv30Ago = new Date(TODAY);
    priv30Ago.setDate(priv30Ago.getDate() - 30);

    const preceptorPrivs = privileges.filter(
      (pr) => pr.privilege === "Preceptor" && pr.unitId === unit.id,
    );
    return preceptorPrivs.map((pr) => {
      const p = persons.find((x) => x.id === pr.personId);
      if (!p) return null;
      const roleId = p.roleId ?? "r-rn";
      const role = personRoles.find((r) => r.id === roleId);
      const myOrientees = orientees.filter((o) => o.primaryPreceptorId === p.id);
      const avgDays = myOrientees.length
        ? Math.round(myOrientees.reduce((s, o) => s + getDaysSinceStart(o.id), 0) / myOrientees.length)
        : 0;
      const signOffs30d = achievements.filter(
        (a) => a.observerId === p.id && new Date(a.achievedAt) >= priv30Ago,
      ).length;
      return {
        id: p.id,
        name: p.name,
        roleName: role?.name ?? "",
        activeOrientees: myOrientees.length,
        avgDays,
        signOffs30d,
      };
    }).filter(Boolean).sort((a, b) => b!.activeOrientees - a!.activeOrientees) as NonNullable<ReturnType<typeof preceptorLoad[0]>>[];
  }, [unit, privileges, persons, personRoles, orientees, achievements, getDaysSinceStart]);

  // ── Stalled orientees ─────────────────────────────────────────────────────
  const stalledOrientees = useMemo(() => {
    if (!unit) return [];
    const cutoff = new Date(TODAY);
    cutoff.setDate(cutoff.getDate() - 14);
    return orientees.filter((p) => {
      const lastObs = observations
        .filter((o) => o.personId === p.id)
        .reduce<string | null>((max, o) => (!max || o.observedAt > max ? o.observedAt : max), null);
      const lastAch = achievements
        .filter((a) => a.personId === p.id)
        .reduce<string | null>((max, a) => (!max || a.achievedAt > max ? a.achievedAt : max), null);
      const lastActivity = [lastObs, lastAch].filter(Boolean).reduce<string | null>(
        (max, d) => (!max || d! > max ? d! : max), null,
      );
      return !lastActivity || new Date(lastActivity) < cutoff;
    });
  }, [unit, orientees, observations, achievements]);

  // ── Guard ─────────────────────────────────────────────────────────────────
  if (!currentLogin) return null;
  if (!unit) {
    return (
      <p className="text-sm text-muted-foreground mt-6">
        Your login isn't associated with a unit. Ask your administrator to fix this.
      </p>
    );
  }

  const firstName = currentLogin.displayName.split(/[\s,]/)[0];
  const cumDaysLabel = [
    `Core ${stageDays.Core}d`,
    `Orient. ${stageDays.Core + stageDays.Orientation}d`,
    `Educ. ${stageDays.Core + stageDays.Orientation + stageDays.Education}d`,
  ].join(" · ");

  return (
    <div className="space-y-5">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Welcome, {firstName}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {unit.name} · {orientees.length} active learner{orientees.length !== 1 ? "s" : ""} · stage targets: {cumDaysLabel}
          </p>
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => navigate("/assignments")}>
            <GitPullRequestArrow className="h-3.5 w-3.5 mr-1.5" />
            Manage assignments
          </Button>
          <Button size="sm" onClick={() => navigate("/my-orientees")}>
            <Users className="h-3.5 w-3.5 mr-1.5" />
            My learners
          </Button>
        </div>
      </div>

      {/* ── Row 1: Health check + Staff profile ────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Health check */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <TimerOff className="h-4 w-4 text-primary" />
                Health check
              </CardTitle>
              {healthFlags.length > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
                  {healthFlags.length} flag{healthFlags.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Active learners past their current stage's target end date with unachieved competencies.
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {healthFlags.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-green-700 py-2">
                <Sparkles className="h-4 w-4" />
                All learners are on track.
              </div>
            ) : (
              healthFlags.map((f) => (
                <Link
                  key={f.person.id}
                  to={`/persons/${f.person.id}`}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 transition-colors"
                >
                  <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{f.person.name}{f.roleName ? `, ${f.roleName}` : ""}</p>
                    <p className="text-xs text-muted-foreground">
                      {f.stage} stage ended {f.stageEndDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · {f.unachieved} of {f.total} unachieved
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-semibold text-red-600">{f.daysOverdue}d overdue</span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        {/* Staff profile */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Staff profile
            </CardTitle>
            <p className="text-xs text-muted-foreground">All clinical staff on your unit, by current stage.</p>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {(["Core", "Orientation", "Education"] as Stage[]).map((s) => (
                <li key={s} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: STAGE_CHART_COLOR[s] }} />
                    {s}
                  </span>
                  <span className="font-medium tabular-nums">{staffProfile[s]}</span>
                </li>
              ))}
              <li className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-green-600" />
                  Continuous Learning
                </span>
                <span className="font-medium tabular-nums">{staffProfile.FullyOriented}</span>
              </li>
              <li className="flex items-center justify-between text-sm border-t pt-2 mt-1">
                <span className="text-muted-foreground">Total</span>
                <span className="font-medium tabular-nums">{unitPersons.length}</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* ── Planner ────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-primary" />
              Planner — path to independence
            </CardTitle>
            <span className="text-xs px-2.5 py-1 rounded-full border text-muted-foreground">
              {orientees.length} active learner{orientees.length !== 1 ? "s" : ""}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Projected end of orientation (when each learner can work independently). Buckets are relative to today.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {plannerBuckets.map((bucket) => (
              <div
                key={bucket.key}
                className={cn(
                  "rounded-lg border p-3 min-h-[120px]",
                  bucket.key === "behind" && bucket.items.length > 0 && "border-red-200 bg-red-50",
                  bucket.key === "2w" && bucket.items.length > 0 && "border-amber-200 bg-amber-50",
                )}
              >
                <div className="flex items-start justify-between gap-1 mb-1">
                  <div>
                    <p className={cn(
                      "text-xs font-semibold",
                      bucket.key === "behind" && bucket.items.length > 0 ? "text-red-600" : "",
                    )}>
                      {bucket.label}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{bucket.sub}</p>
                  </div>
                  <span className="text-xs font-medium tabular-nums text-muted-foreground">{bucket.items.length}</span>
                </div>
                <div className="space-y-1.5 mt-2">
                  {bucket.items.length === 0 ? (
                    <p className="text-xs text-muted-foreground">—</p>
                  ) : (
                    bucket.items.map((item) => (
                      <Link
                        key={item.person.id}
                        to={`/persons/${item.person.id}`}
                        className="block hover:opacity-80"
                      >
                        <p className="text-xs font-medium truncate">{item.person.name.split(",")[0]}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <StageBadge stage={item.stage} size="sm" />
                          <span className="text-[10px] text-muted-foreground">
                            · {item.projected.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Unit Progress Trend ─────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Unit Progress Trend
            </CardTitle>
            <span className="text-xs px-2.5 py-1 rounded-full border text-muted-foreground">last 12 weeks</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Weekly activity on {unit.name}. Targets: {cumDaysLabel}.
          </p>
        </CardHeader>
        <CardContent className="space-y-6 pt-1">

          {/* Step Observations */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium">Step Observations</p>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: OBS_SAT }} />Satisfactory</span>
                <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: OBS_UNSAT }} />Unsatisfactory</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={trendData} margin={{ top: 2, right: 4, bottom: 0, left: -24 }} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="week" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 11 }} />
                <Bar dataKey="satisfactory" stackId="obs" fill={OBS_SAT} name="Satisfactory" radius={[0, 0, 0, 0]} />
                <Bar dataKey="unsatisfactory" stackId="obs" fill={OBS_UNSAT} name="Unsatisfactory" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Competency Achievements */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium">Competency Achievements</p>
              <p className="text-[10px] text-muted-foreground">Sign-offs per week</p>
            </div>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={trendData} margin={{ top: 2, right: 4, bottom: 0, left: -24 }} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="week" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 11 }} />
                <Bar dataKey="achievements" fill={ACH_COLOR} name="Achievements" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Stage Completions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium">Stage Completions</p>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                {STAGES.map((s) => (
                  <span key={s} className="flex items-center gap-1">
                    <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: STAGE_CHART_COLOR[s] }} />
                    {s}
                  </span>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={trendData} margin={{ top: 2, right: 4, bottom: 0, left: -24 }} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="week" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 11 }} />
                {STAGES.map((s, i) => (
                  <Bar key={s} dataKey={s} stackId="stage" fill={STAGE_CHART_COLOR[s]}
                    name={s} radius={i === STAGES.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* ── Row 4: Preceptor load + Stalled ────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Preceptor load */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-primary" />
                Preceptor load
              </CardTitle>
              <span className="text-xs px-2.5 py-1 rounded-full border text-muted-foreground">
                {preceptorLoad.length} preceptor{preceptorLoad.length !== 1 ? "s" : ""}
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {preceptorLoad.length === 0 ? (
              <p className="px-5 py-4 text-sm text-muted-foreground">No preceptors assigned to this unit.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr className="text-xs text-muted-foreground">
                    <th className="px-5 py-2 text-left font-medium">Preceptor</th>
                    <th className="px-3 py-2 text-right font-medium">Active<br />learners</th>
                    <th className="px-3 py-2 text-right font-medium">Avg<br />days</th>
                    <th className="px-3 py-2 text-right font-medium">Sign-offs<br />/ 30d</th>
                  </tr>
                </thead>
                <tbody>
                  {preceptorLoad.map((p, i) => (
                    <tr key={p.id} className={cn("border-b last:border-0", i % 2 === 0 ? "" : "bg-muted/20")}>
                      <td className="px-5 py-3 font-medium">{p.name}{p.roleName ? `, ${p.roleName.replace("Registered ", "")}` : ""}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{p.activeOrientees}</td>
                      <td className={cn("px-3 py-3 text-right tabular-nums", p.avgDays > 180 ? "text-amber-600 font-medium" : "")}>
                        {p.avgDays > 0 ? `${p.avgDays}d` : "—"}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">{p.signOffs30d}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {/* Stalled orientees */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <TimerOff className="h-4 w-4 text-primary" />
                Stalled learners
              </CardTitle>
              <span className="text-xs px-2.5 py-1 rounded-full border text-muted-foreground">
                no activity 14d+
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Active learners with no observation or sign-off in the last 14 days. Different from "overdue" — they might be on schedule but inactive.
            </p>
          </CardHeader>
          <CardContent>
            {stalledOrientees.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-green-700 py-1">
                <Sparkles className="h-4 w-4" />
                Everyone is active.
              </div>
            ) : (
              <ul className="space-y-2">
                {stalledOrientees.map((p) => (
                  <li key={p.id}>
                    <Link
                      to={`/persons/${p.id}`}
                      className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border hover:bg-muted/30 transition-colors"
                    >
                      <div>
                        <p className="text-sm font-medium">{p.name}</p>
                        <StageBadge stage={getPersonStage(p.id) as Stage} size="sm" />
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
