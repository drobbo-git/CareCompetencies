import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/data/auth";
import { useData } from "@/data/store";
import { Card, CardContent } from "@/components/ui/card";
import { StageBadge } from "@/components/common/StageBadge";
import { STAGES, type Stage } from "@/data/types";
import { CalendarDays } from "lucide-react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function lastName(name: string): string {
  const bare = name.replace(/,.*$/, "").trim();
  const parts = bare.split(" ");
  return parts[parts.length - 1] || name;
}

function initials(name: string): string {
  const bare = name.replace(/,.*$/, "").trim();
  return bare.split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

const AVATAR_COLORS = [
  "bg-teal-500", "bg-blue-500", "bg-violet-500",
  "bg-emerald-600", "bg-rose-500", "bg-amber-500", "bg-cyan-600",
];

function avatarColor(id: string): string {
  const hash = id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

// ---------------------------------------------------------------------------
// Stat chip
// ---------------------------------------------------------------------------
function StatChip({
  label, value, activeClass,
}: {
  label: string;
  value: number;
  activeClass: string;
}) {
  const isEmpty = value === 0;
  return (
    <div className={`flex-1 rounded-lg border px-2 py-1.5 text-center transition-colors ${
      isEmpty
        ? "bg-muted/40 border-border text-muted-foreground"
        : activeClass
    }`}>
      <div className="text-[10px] font-semibold uppercase tracking-wide leading-none mb-1">
        {label}
      </div>
      <div className="text-lg font-bold leading-none">{value}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function MyOrienteesPage() {
  const { currentLogin } = useAuth();
  const {
    persons, units, assignments, observations, achievements,
    getPersonStage, getDaysSinceStart, getCompetencyProgress,
  } = useData();

  const isUnitLeader = currentLogin?.systemRole === "UnitLeader";

  const rows = useMemo(() => {
    if (!currentLogin) return [];

    const orientees = isUnitLeader
      ? persons.filter((n) => n.unitId === currentLogin.unitId)
      : persons.filter((n) => n.primaryPreceptorId === currentLogin.id);

    return orientees
      .map((n) => {
        const stage = getPersonStage(n.id);
        const daysSince = getDaysSinceStart(n.id);
        const unit = units.find((u) => u.id === n.unitId);
        const roleId = n.roleId ?? "r-rn";
        const myAssignments = assignments.filter(
          (a) => a.unitId === n.unitId && a.roleId === roleId,
        );
        const stageIdx =
          stage === "FullyOriented" || stage === "Nonclinical"
            ? STAGES.length
            : STAGES.indexOf(stage as Stage);

        let achieved = 0, started = 0, overdue = 0, due = 0;
        for (const a of myAssignments) {
          const progress = getCompetencyProgress(n.id, a.competencyId);
          const aStageIdx = STAGES.indexOf(a.stage as Stage);
          if (progress === "Achieved") {
            achieved++;
          } else {
            if (progress === "InProgress") started++;
            if (aStageIdx < stageIdx) overdue++;
            if (a.stage === stage) due++;
          }
        }

        const total = myAssignments.length;
        const pct = total === 0 ? 0 : Math.round((achieved / total) * 100);
        return { person: n, unit, stage, daysSince, total, achieved, pct, overdue, started, due };
      })
      .filter((r) => !isUnitLeader || r.stage !== "FullyOriented")
      .sort((a, b) => lastName(a.person.name).localeCompare(lastName(b.person.name)));
  }, [currentLogin, isUnitLeader, persons, units, assignments, observations, achievements, getPersonStage, getDaysSinceStart, getCompetencyProgress]);

  if (!currentLogin) return null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {isUnitLeader ? "Unit Orientees" : "My Orientees"}
        </h1>
      </div>

      {/* Cards */}
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {isUnitLeader
            ? "All orientees on this unit are fully oriented."
            : "No orientees are paired with you."}
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map((r) => (
            <Link key={r.person.id} to={`/my-orientees/${r.person.id}`} className="block group">
              <Card className="h-full transition-colors group-hover:border-primary/40">
                <CardContent className="p-4 flex flex-col gap-3">
                  {/* Avatar + name */}
                  <div className="flex items-center gap-3">
                    <div className={`h-11 w-11 rounded-full ${avatarColor(r.person.id)} flex items-center justify-center text-white font-semibold text-sm shrink-0`}>
                      {initials(r.person.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{r.person.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{r.unit?.name ?? "—"}</p>
                    </div>
                  </div>

                  {/* Stage + day */}
                  <div className="flex items-center gap-2">
                    {r.stage !== "FullyOriented" && r.stage !== "Nonclinical" ? (
                      <>
                        <StageBadge stage={r.stage as Stage} size="sm" />
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <CalendarDays className="h-3 w-3" />
                          Day {r.daysSince}
                        </span>
                      </>
                    ) : (
                      <StageBadge stage={r.stage} size="sm" />
                    )}
                  </div>

                  {/* Progress bar */}
                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Overall progress</span>
                      <span className="font-medium">{r.achieved} / {r.total} · {r.pct}%</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${r.pct}%` }}
                      />
                    </div>
                  </div>

                  {/* Stat chips */}
                  <div className="flex gap-2">
                    <StatChip
                      label="Overdue"
                      value={r.overdue}
                      activeClass="bg-red-50 text-red-700 border-red-200"
                    />
                    <StatChip
                      label="Started"
                      value={r.started}
                      activeClass="bg-emerald-50 text-emerald-700 border-emerald-200"
                    />
                    <StatChip
                      label="Due"
                      value={r.due}
                      activeClass="bg-blue-50 text-blue-700 border-blue-200"
                    />
                  </div>

                  {/* Start date */}
                  <p className="text-xs text-muted-foreground">
                    Started {new Date(r.person.startDate + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Footer */}
      <p className="text-xs text-muted-foreground">
        <span className="font-medium">{rows.length} orientee{rows.length !== 1 ? "s" : ""}</span>
        {" · "}Sorted by last name. Click a card to open the orientee workspace.
      </p>
    </div>
  );
}
