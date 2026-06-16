import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/data/auth";
import { useData } from "@/data/store";
import type { ObservationRating } from "@/data/types";
import { todayLocalISODate, localDateStringToISO } from "@/lib/utils";
import {
  ArrowLeft, CheckCircle2, XCircle, EyeOff, Award, Info, Shield,
} from "lucide-react";

function RatingPill({ rating }: { rating: ObservationRating | null }) {
  if (rating === "Satisfactory")
    return <span className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 inline-flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />Satisfactory</span>;
  if (rating === "Unsatisfactory")
    return <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 inline-flex items-center gap-1"><XCircle className="h-3 w-3" />Unsatisfactory</span>;
  if (rating === "NotObserved")
    return <span className="text-xs text-slate-600 bg-slate-100 border border-slate-200 rounded-full px-2 py-0.5 inline-flex items-center gap-1"><EyeOff className="h-3 w-3" />Not Observed</span>;
  return <span className="text-xs text-muted-foreground border border-dashed rounded-full px-2 py-0.5">No observation</span>;
}

function fmt(iso: string) {
  try { return new Date(iso.includes("T") ? iso : iso + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" }); }
  catch { return iso; }
}

export default function SignOffMobilePage() {
  const { nurseId, competencyId } = useParams<{ nurseId: string; competencyId: string }>();
  const navigate = useNavigate();
  const { currentLogin } = useAuth();
  const {
    persons, competencies, steps, assignments, observations, recordAchievement, logAudit,
    ensurePersonDataLoaded,
  } = useData();

  // observations are scoped server-side (see scopeFilter.ts) — explicitly
  // load this learner's data (usually already loaded by the page that
  // linked here, but this page can also be reached directly/on refresh).
  useEffect(() => {
    if (nurseId) ensurePersonDataLoaded(nurseId);
  }, [nurseId, ensurePersonDataLoaded]);

  const person = useMemo(() => persons.find((n) => n.id === nurseId), [persons, nurseId]);
  const comp   = useMemo(() => competencies.find((c) => c.id === competencyId), [competencies, competencyId]);

  // Provenance: if this competency is part of the learner's own home-unit
  // requirements, it was earned there. Otherwise (a cross-trained
  // competency the preceptor brought in) credit the unit where the signing
  // preceptor actually holds it, falling back to the learner's home unit.
  const earnedAtUnitId = useMemo(() => {
    if (!person || !competencyId) return undefined;
    const roleId = person.roleId ?? "r-rn";
    const isHomeRequired = assignments.some(
      (a) => a.unitId === person.unitId && a.roleId === roleId && a.competencyId === competencyId,
    );
    if (isHomeRequired) return person.unitId;
    const viewerUnitIds = currentLogin?.unitIds ?? [];
    const viaViewer = assignments.find(
      (a) => viewerUnitIds.includes(a.unitId) && a.roleId === roleId && a.competencyId === competencyId,
    )?.unitId;
    return viaViewer ?? person.unitId;
  }, [person, competencyId, assignments, currentLogin]);
  const compSteps = useMemo(
    () => steps.filter((s) => s.competencyId === competencyId).sort((a, b) => a.orderIndex - b.orderIndex),
    [steps, competencyId],
  );

  const latestPerStep = useMemo(() => {
    const map = new Map<string, { rating: ObservationRating; observedAt: string }>();
    if (!nurseId || !competencyId) return map;
    for (const obs of observations) {
      if (obs.personId !== nurseId || obs.competencyId !== competencyId) continue;
      const existing = map.get(obs.stepId);
      if (!existing || obs.observedAt > existing.observedAt)
        map.set(obs.stepId, { rating: obs.rating, observedAt: obs.observedAt });
    }
    return map;
  }, [observations, nurseId, competencyId]);

  const [achievedAt, setAchievedAt] = useState(todayLocalISODate());
  const [notes, setNotes]           = useState("");
  const [saved, setSaved]           = useState(false);

  function handleSave() {
    if (!currentLogin || !person || !competencyId || saved) return;
    recordAchievement({
      personId:      person.id,
      competencyId:  competencyId,
      observerId:    currentLogin.id,
      achievedAt:    localDateStringToISO(achievedAt),
      notes:         notes.trim() || undefined,
      earnedAtUnitId,
    });
    void logAudit({
      actor:       currentLogin.id,
      actorRole:   currentLogin.systemRole,
      type:        "CompetencyAchievementSigned",
      summary:     `Signed off "${comp?.name}" for ${person.name}`,
      targetLabel: comp?.name ?? competencyId,
      detail:      notes.trim() || undefined,
    });
    setSaved(true);
  }

  if (!person || !comp) {
    return (
      <div className="space-y-4">
        <Link to={`/my-orientees/${nurseId}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Link>
        <p className="text-sm text-muted-foreground">Learner or competency not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* Back */}
      <Link to={`/my-orientees/${nurseId}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> {person.name}
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold leading-snug">{comp.name}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Sign off for: {person.name}</p>
      </div>

      {/* Success */}
      {saved && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <p className="font-semibold text-emerald-800">Marked as Achieved</p>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/my-orientees/${nurseId}`)}
            className="w-full py-3 rounded-xl border text-sm font-medium hover:bg-emerald-100 transition-colors"
          >
            Back to {person.name.split(/\s/)[0]}
          </button>
        </div>
      )}

      {!saved && (
        <>
          {/* Professional judgment notice */}
          <div className="flex gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3">
            <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-900">
              <span className="font-semibold">Professional judgment — </span>
              You may sign off this competency even if some steps were Unsatisfactory.
            </p>
          </div>

          {/* Latest observations per step */}
          {compSteps.length > 0 && (
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b">
                <p className="text-sm font-semibold">Latest observations</p>
              </div>
              <ul className="divide-y">
                {compSteps.map((step, idx) => {
                  const latest = latestPerStep.get(step.id);
                  return (
                    <li key={step.id} className="px-4 py-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-snug">{idx + 1}. {step.name}</p>
                        {latest && (
                          <p className="text-xs text-muted-foreground mt-0.5">{fmt(latest.observedAt)}</p>
                        )}
                      </div>
                      <RatingPill rating={latest?.rating ?? null} />
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Date */}
          <div className="rounded-xl border bg-card p-4 space-y-2">
            <label className="text-sm font-medium">Date of sign-off</label>
            <input
              type="date"
              value={achievedAt}
              onChange={(e) => setAchievedAt(e.target.value)}
              className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* Notes */}
          <div className="rounded-xl border bg-card p-4 space-y-2">
            <label className="text-sm font-medium">
              Rationale / notes <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <textarea
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder='e.g., "Demonstrated independent technique across three patients."'
            />
          </div>

          {/* Audit notice */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
            <Shield className="h-3.5 w-3.5 shrink-0" />
            Sign-offs are permanent and form part of the competency audit trail.
          </div>

          {/* Sign off button */}
          <button
            type="button"
            onClick={handleSave}
            className="w-full py-4 rounded-xl bg-primary text-primary-foreground text-base font-semibold flex items-center justify-center gap-2 hover:bg-primary/90 active:scale-95 transition-all"
          >
            <Award className="h-5 w-5" />
            Mark as Achieved
          </button>
        </>
      )}
    </div>
  );
}
