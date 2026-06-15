import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/data/auth";
import { useData } from "@/data/store";
import type { ObservationRating } from "@/data/types";
import { ArrowLeft, CheckCircle2, Shield, ClipboardCheck } from "lucide-react";

interface StepEntry {
  stepId: string;
  name: string;
  rating: ObservationRating | null;
}

function SegmentedControl({
  rating, onChange,
}: { rating: ObservationRating | null; onChange: (r: ObservationRating) => void }) {
  const btn = (value: ObservationRating, label: string, activeClass: string, border?: string) => (
    <button
      type="button"
      onClick={() => onChange(value)}
      className={`flex-1 py-3.5 text-sm font-medium transition-colors active:scale-95 ${border ?? ""} ${
        rating === value
          ? activeClass
          : "text-muted-foreground hover:bg-muted"
      }`}
    >
      {label}
    </button>
  );
  return (
    <div className="flex rounded-xl border overflow-hidden mt-2">
      {btn("Satisfactory",  "✓ Satisfactory",  "bg-emerald-500 text-white")}
      {btn("Unsatisfactory","✗ Unsatisfactory","bg-amber-500 text-white", "border-x")}
      {btn("NotObserved",   "— N/O",           "bg-slate-200 text-slate-800")}
    </div>
  );
}

export default function ObserveMobilePage() {
  const { nurseId, competencyId } = useParams<{ nurseId: string; competencyId: string }>();
  const navigate = useNavigate();
  const { currentLogin } = useAuth();
  const { persons, competencies, steps, recordObservation, logAudit } = useData();

  const person = useMemo(() => persons.find((n) => n.id === nurseId), [persons, nurseId]);
  const comp   = useMemo(() => competencies.find((c) => c.id === competencyId), [competencies, competencyId]);
  const compSteps = useMemo(
    () => steps.filter((s) => s.competencyId === competencyId).sort((a, b) => a.orderIndex - b.orderIndex),
    [steps, competencyId],
  );

  const [entries, setEntries] = useState<StepEntry[]>([]);
  const [notes, setNotes]     = useState("");
  const [saving, setSaving]   = useState(false);
  const [savedCount, setSavedCount] = useState<number | null>(null);

  useEffect(() => {
    setEntries(compSteps.map((s) => ({ stepId: s.id, name: s.name, rating: null })));
    setSavedCount(null);
    setNotes("");
  }, [competencyId, compSteps.length]);

  function setRating(idx: number, r: ObservationRating) {
    setEntries((prev) => prev.map((e, i) => i === idx ? { ...e, rating: r } : e));
  }

  function markAll(r: ObservationRating) {
    setEntries((prev) => prev.map((e) => ({ ...e, rating: r })));
  }

  const rated   = entries.filter((e) => e.rating !== null);
  const canSave = !!currentLogin && rated.length > 0 && !saving;

  async function handleSave() {
    if (!currentLogin || !canSave || !nurseId || !competencyId) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      await Promise.all(
        rated.map((e) =>
          recordObservation({
            personId:     nurseId,
            stepId:       e.stepId,
            competencyId: competencyId,
            observerId:   currentLogin.id,
            rating:       e.rating!,
            observedAt:   now,
            notes:        notes.trim() || undefined,
          }),
        ),
      );
      void logAudit({
        actor:       currentLogin.id,
        actorRole:   currentLogin.systemRole,
        type:        "StepObservationRecorded",
        summary:     `Recorded ${rated.length} observation(s) on "${comp?.name}" for ${person?.name}`,
        targetLabel: comp?.name ?? competencyId,
      });
      setSavedCount(rated.length);
    } finally {
      setSaving(false);
    }
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
        <p className="text-sm text-muted-foreground mt-0.5">Observing: {person.name}</p>
      </div>

      {/* Success state */}
      {savedCount !== null && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-emerald-600" />
            <p className="font-semibold text-emerald-800">
              {savedCount} observation{savedCount !== 1 ? "s" : ""} recorded
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => { setSavedCount(null); setEntries(compSteps.map((s) => ({ stepId: s.id, name: s.name, rating: null }))); setNotes(""); }}
              className="py-3 rounded-xl border text-sm font-medium hover:bg-emerald-100 transition-colors"
            >
              Observe again
            </button>
            <button
              type="button"
              onClick={() => navigate(`/my-orientees/${nurseId}/sign-off/${competencyId}`)}
              className="py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Sign Off
            </button>
          </div>
        </div>
      )}

      {/* Steps */}
      {savedCount === null && (
        <>
          {/* Quick actions */}
          {entries.length > 1 && (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => markAll("Satisfactory")}
                className="py-2.5 rounded-xl border border-emerald-300 text-emerald-700 text-sm font-medium hover:bg-emerald-50 transition-colors"
              >
                ✓ Mark All Satisfactory
              </button>
              <button
                type="button"
                onClick={() => markAll("Unsatisfactory")}
                className="py-2.5 rounded-xl border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
              >
                ✗ Mark All Unsat
              </button>
            </div>
          )}

          {entries.length === 0 && (
            <p className="text-sm text-muted-foreground">No steps defined for this competency.</p>
          )}

          {entries.map((entry, i) => (
            <div key={entry.stepId} className="rounded-xl border bg-card p-4 space-y-1">
              <div className="flex items-start gap-3">
                <span className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-[11px] font-semibold text-muted-foreground shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <p className="text-sm font-medium leading-snug">{entry.name}</p>
              </div>
              <SegmentedControl rating={entry.rating} onChange={(r) => setRating(i, r)} />
            </div>
          ))}

          {/* Notes */}
          {entries.length > 0 && (
            <div className="rounded-xl border bg-card p-4 space-y-2">
              <label className="text-sm font-medium">Session notes <span className="text-muted-foreground font-normal">(optional)</span></label>
              <textarea
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any notes that apply to this observation session…"
              />
            </div>
          )}

          {/* Audit notice */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
            <Shield className="h-3.5 w-3.5 shrink-0" />
            Each rated step creates an immutable observation record.
          </div>

          {/* Save */}
          {entries.length > 0 && (
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className="w-full py-4 rounded-xl bg-primary text-primary-foreground text-base font-semibold hover:bg-primary/90 disabled:opacity-50 active:scale-95 transition-all"
            >
              {saving
                ? "Saving…"
                : rated.length === 0
                ? "Rate at least one step to save"
                : `Save ${rated.length} Observation${rated.length !== 1 ? "s" : ""}`}
            </button>
          )}
        </>
      )}
    </div>
  );
}
