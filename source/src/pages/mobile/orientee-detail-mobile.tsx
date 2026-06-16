import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/data/auth";
import { useData } from "@/data/store";
import { StageBadge } from "@/components/common/StageBadge";
import { STAGES, type Stage, type Competency } from "@/data/types";
import { ArrowLeft, CheckCircle2, AlertTriangle, Stethoscope, ClipboardCheck, CalendarDays } from "lucide-react";

function initials(name: string) {
  return name.replace(/,.*$/, "").trim().split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}
const AVATAR_COLORS = ["bg-teal-500","bg-blue-500","bg-violet-500","bg-emerald-600","bg-rose-500","bg-amber-500","bg-cyan-600"];
function avatarColor(id: string) {
  const h = id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function ActionButtons({ nurseId, competencyId }: { nurseId: string; competencyId: string }) {
  const navigate = useNavigate();
  return (
    <div className="grid grid-cols-2 gap-2 mt-3">
      <button
        type="button"
        onClick={() => navigate(`/my-orientees/${nurseId}/observe/${competencyId}`)}
        className="flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-medium text-foreground hover:bg-muted active:scale-95 transition-all"
      >
        <Stethoscope className="h-4 w-4" />
        Observe
      </button>
      <button
        type="button"
        onClick={() => navigate(`/my-orientees/${nurseId}/sign-off/${competencyId}`)}
        className="flex items-center justify-center gap-2 py-3 rounded-xl border border-emerald-300 text-emerald-700 text-sm font-medium hover:bg-emerald-50 active:scale-95 transition-all"
      >
        <ClipboardCheck className="h-4 w-4" />
        Sign Off
      </button>
    </div>
  );
}

export default function OrienteeDetailMobile() {
  const { id } = useParams<{ id: string }>();
  const { currentLogin } = useAuth();
  const {
    persons, units,
    competencies, assignments, achievements, observations,
    getPersonStage, getDaysSinceStart, getCompetencyProgress,
  } = useData();

  const person = useMemo(() => persons.find((n) => n.id === id), [persons, id]);
  const unit    = person ? units.find((u) => u.id === person.unitId) : undefined;
  const stage   = person ? getPersonStage(person.id) : "Core";
  const daysSince = person ? getDaysSinceStart(person.id) : 0;

  // The learner must learn everything required by their own home unit/role,
  // regardless of who's viewing.
  const myAssignments = useMemo(() => {
    if (!person) return [];
    return assignments.filter(
      (a) => a.unitId === person.unitId && a.roleId === (person.roleId ?? "r-rn"),
    );
  }, [assignments, person]);

  // Competencies the viewing preceptor is personally qualified to teach —
  // a preceptor may observe/sign off any competency they've achieved
  // themselves, not just their home unit's catalog (see CLAUDE.md "Preceptor").
  // Administrators bypass the check.
  const qualifiedCompetencyIds = useMemo(() => {
    if (!currentLogin) return new Set<string>();
    if (currentLogin.systemRole === "Administrator") return null;
    return new Set(
      achievements.filter((a) => a.personId === currentLogin.id).map((a) => a.competencyId),
    );
  }, [achievements, currentLogin]);
  const canTeach = (competencyId: string) =>
    qualifiedCompetencyIds === null || (qualifiedCompetencyIds?.has(competencyId) ?? false);

  // Competencies this preceptor has achieved that aren't part of the
  // learner's home-unit requirements — they can still teach these; it just
  // records as a cross-trained "Other" achievement for the learner instead
  // of a required one (see CLAUDE.md "Preceptor").
  const teachableExtras = useMemo(() => {
    if (!person || qualifiedCompetencyIds === null) return [];
    const requiredIds = new Set(myAssignments.map((a) => a.competencyId));
    const alreadyAchievedIds = new Set(
      achievements.filter((a) => a.personId === person.id).map((a) => a.competencyId),
    );
    return [...qualifiedCompetencyIds]
      .filter((cid) => !requiredIds.has(cid) && !alreadyAchievedIds.has(cid))
      .map((cid) => competencies.find((c) => c.id === cid))
      .filter((c): c is Competency => !!c)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [person, qualifiedCompetencyIds, myAssignments, achievements, competencies]);

  const currentStageIdx = stage === "FullyOriented" || stage === "Nonclinical"
    ? STAGES.length
    : STAGES.indexOf(stage as Stage);

  const perStage = useMemo(() => {
    if (!person) return [];
    return STAGES.map((s) => {
      const isOverdue = STAGES.indexOf(s) < currentStageIdx;
      const items = myAssignments
        .filter((a) => a.stage === s)
        .map((a) => {
          const comp = competencies.find((c) => c.id === a.competencyId);
          if (!comp) return null;
          const progress = getCompetencyProgress(person.id, a.competencyId);
          const lastObs = [...observations]
            .filter((o) => o.personId === person.id && o.competencyId === comp.id)
            .sort((x, y) => y.observedAt.localeCompare(x.observedAt))[0];
          return { comp, progress, lastObs, overdue: isOverdue && progress !== "Achieved" };
        })
        .filter((x): x is NonNullable<typeof x> => !!x)
        .sort((a, b) => {
          if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
          if (a.progress === "Achieved" && b.progress !== "Achieved") return 1;
          if (a.progress !== "Achieved" && b.progress === "Achieved") return -1;
          return a.comp.name.localeCompare(b.comp.name);
        });
      return { stage: s, items };
    });
  }, [myAssignments, person, competencies, observations, getCompetencyProgress, currentStageIdx]);

  const totalAchieved = myAssignments.filter((a) => person && getCompetencyProgress(person.id, a.competencyId) === "Achieved").length;
  const totalRequired = myAssignments.length;
  const pct = totalRequired === 0 ? 0 : Math.round((totalAchieved / totalRequired) * 100);

  if (!person) {
    return (
      <div className="space-y-4">
        <Link to="/my-orientees" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> My Learners
        </Link>
        <p className="text-sm text-muted-foreground">Learner not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* Back */}
      <Link to="/my-orientees" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> My Learners
      </Link>

      {/* Learner header */}
      <div className="flex items-center gap-3">
        <div className={`h-12 w-12 rounded-full ${avatarColor(person.id)} flex items-center justify-center text-white font-semibold shrink-0`}>
          {initials(person.name)}
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-bold leading-tight truncate">{person.name}</h1>
          <p className="text-xs text-muted-foreground truncate">{unit?.name ?? "—"}</p>
          <div className="flex items-center gap-2 mt-1">
            {stage !== "FullyOriented" && stage !== "Nonclinical" ? (
              <>
                <StageBadge stage={stage as Stage} size="sm" />
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <CalendarDays className="h-3 w-3" /> Day {daysSince}
                </span>
              </>
            ) : (
              <StageBadge stage={stage} size="sm" />
            )}
          </div>
        </div>
      </div>

      {/* Overall progress */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-muted-foreground">Overall progress</span>
          <span className="font-semibold">{totalAchieved} / {totalRequired} · {pct}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Stage sections */}
      {perStage.map(({ stage: s, items }) => {
        if (items.length === 0) return null;
        const overdueInStage = items.filter((i) => i.overdue);
        const isCurrentStage = s === stage;
        return (
          <div key={s}>
            <div className="flex items-center gap-2 mb-2 px-1">
              <StageBadge stage={s} size="sm" />
              {isCurrentStage && (
                <span className="text-[10px] font-semibold text-primary uppercase tracking-wide">Current</span>
              )}
              {overdueInStage.length > 0 && (
                <span className="flex items-center gap-1 text-[10px] font-semibold text-red-600">
                  <AlertTriangle className="h-3 w-3" />
                  {overdueInStage.length} overdue
                </span>
              )}
              <span className="text-xs text-muted-foreground ml-auto">
                {items.filter((i) => i.progress === "Achieved").length}/{items.length}
              </span>
            </div>

            <div className="space-y-2">
              {items.map(({ comp, progress, overdue }) => (
                <div
                  key={comp.id}
                  className={`rounded-xl border p-3 ${
                    overdue
                      ? "border-red-200 bg-red-50/50"
                      : progress === "Achieved"
                      ? "border-emerald-200 bg-emerald-50/30"
                      : "bg-card"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm font-medium leading-snug ${overdue ? "text-red-800" : ""}`}>
                      {comp.name}
                    </p>
                    {progress === "Achieved" ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    ) : (
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${
                        progress === "InProgress"
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : overdue
                          ? "bg-red-50 text-red-700 border-red-200"
                          : "bg-muted text-muted-foreground border-border"
                      }`}>
                        {progress === "InProgress" ? "In Progress" : overdue ? "Overdue" : "Not Started"}
                      </span>
                    )}
                  </div>
                  {progress !== "Achieved" && (
                    canTeach(comp.id) ? (
                      <ActionButtons nurseId={person.id} competencyId={comp.id} />
                    ) : (
                      <p className="text-[11px] text-muted-foreground mt-2">Outside your skill set</p>
                    )
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Other competencies you can teach */}
      {teachableExtras.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2 px-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Other Competencies You Can Teach
            </span>
          </div>
          <div className="space-y-2">
            {teachableExtras.map((comp) => (
              <div key={comp.id} className="rounded-xl border p-3 bg-card">
                <p className="text-sm font-medium leading-snug">{comp.name}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Not required on {person.name.split(",")[0]}'s home unit — counts as cross-trained
                </p>
                <ActionButtons nurseId={person.id} competencyId={comp.id} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
