import { useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/data/auth";
import { useData } from "@/data/store";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import type { SelfAssessmentConfidence, SelfAssessmentRating } from "@/data/types";

// ---------------------------------------------------------------------------
// Rating display helpers
// ---------------------------------------------------------------------------
const CONFIDENCE_OPTIONS: { value: SelfAssessmentConfidence; label: string; color: string }[] = [
  { value: "HighConfidence", label: "High confidence",  color: "border-emerald-400 bg-emerald-50 text-emerald-800 data-[selected]:bg-emerald-500 data-[selected]:text-white data-[selected]:border-emerald-500" },
  { value: "LowConfidence",  label: "Low confidence",   color: "border-amber-400 bg-amber-50 text-amber-800 data-[selected]:bg-amber-500 data-[selected]:text-white data-[selected]:border-amber-500" },
  { value: "NeverDone",      label: "No experience",    color: "border-slate-300 bg-slate-50 text-slate-700 data-[selected]:bg-slate-500 data-[selected]:text-white data-[selected]:border-slate-500" },
];

const OVERALL_OPTIONS: { value: SelfAssessmentRating; label: string; sub: string; color: string }[] = [
  { value: "ReadyForAssessment", label: "Ready for assessment", sub: "I can demonstrate this competency now",     color: "border-emerald-400 bg-emerald-50 text-emerald-800 data-[selected]:bg-emerald-500 data-[selected]:text-white data-[selected]:border-emerald-500" },
  { value: "NeedPractice",       label: "Need practice",        sub: "I've done this but need more repetition",  color: "border-amber-400 bg-amber-50 text-amber-800 data-[selected]:bg-amber-500 data-[selected]:text-white data-[selected]:border-amber-500" },
  { value: "NeedInstruction",    label: "Need instruction",     sub: "I need more teaching before I can do this", color: "border-rose-400 bg-rose-50 text-rose-800 data-[selected]:bg-rose-500 data-[selected]:text-white data-[selected]:border-rose-500" },
];

export default function SelfAssessPage() {
  const { competencyId } = useParams<{ competencyId: string }>();
  const navigate = useNavigate();
  const { currentLogin } = useAuth();
  const { competencies, steps, recordSelfAssessment } = useData();

  const competency = useMemo(
    () => competencies.find((c) => c.id === competencyId),
    [competencies, competencyId],
  );
  const compSteps = useMemo(
    () => steps.filter((s) => s.competencyId === competencyId).sort((a, b) => a.orderIndex - b.orderIndex),
    [steps, competencyId],
  );

  const [confidences, setConfidences] = useState<Record<string, SelfAssessmentConfidence>>({});
  const [overall, setOverall] = useState<SelfAssessmentRating | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const allStepsRated = compSteps.length > 0 && compSteps.every((s) => confidences[s.id]);
  const canSubmit = allStepsRated && overall !== null && !submitting;

  async function handleSubmit() {
    if (!canSubmit || !competencyId) return;
    setSubmitting(true);
    try {
      await recordSelfAssessment({
        competencyId,
        overallRating: overall!,
        notes: notes.trim() || undefined,
        steps: compSteps.map((s) => ({ stepId: s.id, confidence: confidences[s.id]! })),
      });
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (!currentLogin || !competency) return null;

  if (done) {
    return (
      <div className="max-w-lg mx-auto p-4 space-y-6">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 flex flex-col items-center gap-3 text-center">
          <CheckCircle2 className="h-10 w-10 text-emerald-500" />
          <p className="text-base font-semibold text-emerald-800">Self-assessment submitted</p>
          <p className="text-sm text-emerald-700">Your preceptor can now see your confidence ratings.</p>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mt-2 px-4 py-2 rounded-lg border border-emerald-400 text-sm font-medium text-emerald-800 hover:bg-emerald-100 transition-colors"
          >
            Back to my competencies
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => navigate(-1)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Self-assessment</p>
          <h1 className="text-base font-bold leading-snug">{competency.name}</h1>
        </div>
      </div>

      {/* Step confidence ratings */}
      {compSteps.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">Rate your confidence for each step</p>
            <div className="flex gap-1.5 shrink-0">
              {CONFIDENCE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    const all: Record<string, SelfAssessmentConfidence> = {};
                    compSteps.forEach((s) => { all[s.id] = opt.value; });
                    setConfidences(all);
                  }}
                  className={`rounded-lg border px-2 py-1 text-[11px] font-medium transition-all active:scale-95 ${opt.color}`}
                >
                  All {opt.label.split(" ")[0].toLowerCase()}
                </button>
              ))}
            </div>
          </div>
          {compSteps.map((step, i) => (
            <div key={step.id} className="space-y-2">
              <p className="text-sm text-foreground">
                <span className="font-medium text-muted-foreground mr-1.5">{i + 1}.</span>
                {step.name}
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                {CONFIDENCE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    data-selected={confidences[step.id] === opt.value ? "" : undefined}
                    onClick={() => setConfidences((prev) => ({ ...prev, [step.id]: opt.value }))}
                    className={`rounded-lg border px-2 py-2 text-xs font-medium text-center transition-all active:scale-95 ${opt.color}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Overall readiness */}
      <div className="space-y-2 pt-2 border-t">
        <p className="text-sm font-semibold">Overall readiness</p>
        <div className="space-y-2">
          {OVERALL_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              data-selected={overall === opt.value ? "" : undefined}
              onClick={() => setOverall(opt.value)}
              className={`w-full rounded-xl border px-4 py-3 text-left transition-all active:scale-[0.99] ${opt.color}`}
            >
              <p className="text-sm font-semibold">{opt.label}</p>
              <p className="text-xs opacity-75 mt-0.5">{opt.sub}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Optional notes */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium" htmlFor="sa-notes">Notes (optional)</label>
        <textarea
          id="sa-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Any context for your preceptor…"
          className="w-full rounded-lg border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Submit */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="w-full rounded-xl bg-primary text-primary-foreground py-3 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-opacity active:scale-[0.99]"
      >
        {submitting ? "Submitting…" : "Submit self-assessment"}
      </button>

      {!allStepsRated && compSteps.length > 0 && (
        <p className="text-xs text-center text-muted-foreground">
          Rate all {compSteps.length} step{compSteps.length !== 1 ? "s" : ""} to continue
        </p>
      )}
    </div>
  );
}
