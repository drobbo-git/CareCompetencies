import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/data/auth";
import { useData } from "@/data/store";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { STAGES, type Stage } from "@/data/types";
import type { ObservationRating } from "@/data/types";
import {
  CheckCircle2, XCircle, EyeOff, User, Home, Building2,
  Globe, Shield, Info, Award,
} from "lucide-react";
import { todayLocalISODate, localDateStringToISO } from "@/lib/utils";

type ScopeFilter = "Stage" | "Unit" | "AllForRole";
type SignOffContext = "HomeUnit" | "CrossTraining";

// ---------------------------------------------------------------------------
// Rating badge (read-only display, not interactive)
// ---------------------------------------------------------------------------
function RatingBadge({ rating }: { rating: ObservationRating | null }) {
  if (!rating) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground border border-dashed rounded-full px-2.5 py-1">
        <span className="h-3 w-3 rounded-full border border-muted-foreground/40" />
        No observation yet
      </span>
    );
  }
  if (rating === "Satisfactory") {
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Satisfactory
      </span>
    );
  }
  if (rating === "Unsatisfactory") {
    return (
      <span className="flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1">
        <XCircle className="h-3.5 w-3.5" />
        Unsatisfactory
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-slate-100 border border-slate-300 rounded-full px-2.5 py-1">
      <EyeOff className="h-3.5 w-3.5" />
      Not Observed
    </span>
  );
}

function fmtISO(iso: string): string {
  try {
    const d = new Date(iso.includes("T") ? iso : iso + "T12:00:00");
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch { return iso; }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function SignOffPage() {
  const { currentLogin } = useAuth();
  const {
    persons, units, steps, competencies, assignments, observations,
    getPersonStage, getCompetencyProgress, recordAchievement, logAudit,
  } = useData();

  const { state } = useLocation();
  const prefill = state as { personId?: string; competencyId?: string } | null;

  const myOrientees = useMemo(() => {
    if (!currentLogin) return [];
    if (currentLogin.systemRole === "UnitLeader") {
      return persons.filter((n) => n.unitId === currentLogin.unitId);
    }
    return persons.filter((n) => n.primaryPreceptorId === currentLogin.id);
  }, [persons, currentLogin]);

  const [personId, setPersonId] = useState<string>(prefill?.personId ?? "");
  const [competencyId, setCompetencyId] = useState<string>(prefill?.competencyId ?? "");
  const [signOffContext, setSignOffContext] = useState<SignOffContext>("HomeUnit");
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("Stage");
  const [achievedAt, setAchievedAt] = useState(todayLocalISODate());
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);

  const person = persons.find((n) => n.id === personId);
  const personStage = person ? getPersonStage(person.id) : undefined;
  const selectedComp = competencies.find((c) => c.id === competencyId);

  // Scoped competency list
  const scopedCompetencies = useMemo(() => {
    if (!person) return [];
    const roleId = person.roleId ?? "r-rn";
    let filtered = assignments;
    if (scopeFilter === "Stage" && personStage && STAGES.includes(personStage as Stage)) {
      filtered = filtered.filter((a) => a.unitId === person.unitId && a.roleId === roleId && a.stage === personStage);
    } else if (scopeFilter === "Unit") {
      filtered = filtered.filter((a) => a.unitId === person.unitId && a.roleId === roleId);
    } else {
      filtered = filtered.filter((a) => a.roleId === roleId);
    }
    const ids = new Set(filtered.map((a) => a.competencyId));
    return competencies
      .filter((c) => ids.has(c.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [person, personStage, scopeFilter, assignments, competencies]);

  const scopeDescription = useMemo(() => {
    if (!person) return "";
    const count = scopedCompetencies.length;
    if (scopeFilter === "Stage" && personStage && STAGES.includes(personStage as Stage)) {
      return `${count} competenc${count === 1 ? "y" : "ies"} · ${personStage} stage on this unit / 1 role`;
    }
    if (scopeFilter === "Unit") {
      return `${count} competenc${count === 1 ? "y" : "ies"} on this unit`;
    }
    return `${count} competenc${count === 1 ? "y" : "ies"} across all units for this role`;
  }, [scopedCompetencies, scopeFilter, person, personStage]);

  // Steps for selected competency
  const compSteps = useMemo(
    () => steps.filter((s) => s.competencyId === competencyId).sort((a, b) => a.orderIndex - b.orderIndex),
    [steps, competencyId],
  );

  // Latest observation per step
  const latestPerStep = useMemo(() => {
    if (!person || !competencyId) return new Map<string, { rating: ObservationRating; observedAt: string; observerId: string }>();
    const map = new Map<string, { rating: ObservationRating; observedAt: string; observerId: string }>();
    for (const obs of observations) {
      if (obs.personId !== person.id || obs.competencyId !== competencyId) continue;
      const existing = map.get(obs.stepId);
      if (!existing || obs.observedAt > existing.observedAt) {
        map.set(obs.stepId, { rating: obs.rating, observedAt: obs.observedAt, observerId: obs.observerId });
      }
    }
    return map;
  }, [observations, person, competencyId]);

  // Overall competency progress badge label
  const compProgress = person && competencyId
    ? getCompetencyProgress(person.id, competencyId)
    : null;

  const canSave = !!currentLogin && !!personId && !!competencyId && !saved;

  function handleSave() {
    if (!currentLogin || !canSave || !person) return;
    recordAchievement({
      personId,
      competencyId,
      observerId: currentLogin.id,
      achievedAt: localDateStringToISO(achievedAt),
      notes: notes.trim() || undefined,
      earnedAtUnitId: person.unitId,
    });
    const comp = competencies.find((c) => c.id === competencyId)?.name ?? competencyId;
    logAudit({
      actor: currentLogin.id,
      actorRole: currentLogin.systemRole,
      type: "CompetencyAchievementSigned",
      summary: `Signed off "${comp}" for ${person.name}`,
      targetLabel: comp,
      detail: notes.trim() || undefined,
    });
    setSaved(true);
    setNotes("");
    setTimeout(() => {
      setCompetencyId("");
      setSaved(false);
    }, 1800);
  }

  if (!currentLogin) return null;

  return (
    <div className="space-y-4 pb-24">

      {/* ── Page header ──────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Sign Off Competency</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          A separate, explicit attestation that the nurse is competent overall. This is independent of step observations.
        </p>
      </div>

      {/* ── Sign off context pills ───────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Sign off context:</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setSignOffContext("HomeUnit")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm transition-colors ${
              signOffContext === "HomeUnit"
                ? "border-primary bg-primary/5 text-primary font-medium"
                : "border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            <Home className="h-3.5 w-3.5" />
            Home unit
          </button>
          <button
            type="button"
            onClick={() => setSignOffContext("CrossTraining")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm transition-colors ${
              signOffContext === "CrossTraining"
                ? "border-primary bg-primary/5 text-primary font-medium"
                : "border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            <Building2 className="h-3.5 w-3.5" />
            Cross-training
          </button>
        </div>
      </div>

      {/* ── Context banner (when nurse + competency selected) ────────── */}
      {person && selectedComp && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg border bg-muted/40">
          <div className="flex items-center gap-2 text-sm">
            <User className="h-4 w-4 text-muted-foreground shrink-0" />
            <span>
              Signing off: <strong>{person.name}</strong>
              {" · "}
              <strong>{selectedComp.name}</strong>
              {" "}as{" "}
              <strong>{currentLogin.displayName.split(/[,(]/)[0].trim()}</strong>
            </span>
          </div>
          <button
            type="button"
            onClick={() => { setPersonId(""); setCompetencyId(""); }}
            className="text-sm text-primary hover:underline shrink-0"
          >
            Change nurse
          </button>
        </div>
      )}

      {/* ── Selection card ───────────────────────────────────────────── */}
      <Card>
        <CardContent className="pt-5 pb-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

            {/* Nurse */}
            <div className="space-y-1.5">
              <Label>Nurse</Label>
              <Select value={personId} onValueChange={(v) => { setPersonId(v); setCompetencyId(""); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a nurse…" />
                </SelectTrigger>
                <SelectContent>
                  {myOrientees.map((n) => (
                    <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Competency */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Competency</Label>
                {person && (
                  <div className="flex gap-1">
                    {(["Stage", "Unit", "AllForRole"] as ScopeFilter[]).map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => { setScopeFilter(f); setCompetencyId(""); }}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] border transition-colors ${
                          scopeFilter === f
                            ? "border-primary bg-primary/5 text-primary font-medium"
                            : "border-border text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {f === "Stage" && <CheckCircle2 className="h-3 w-3" />}
                        {f === "Unit" && <Building2 className="h-3 w-3" />}
                        {f === "AllForRole" && <Globe className="h-3 w-3" />}
                        {f === "Stage" ? "Stage" : f === "Unit" ? "Unit" : "All for role"}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Select value={competencyId} onValueChange={setCompetencyId} disabled={!person}>
                <SelectTrigger>
                  <SelectValue placeholder={person ? "Select a competency…" : "Select a nurse first"} />
                </SelectTrigger>
                <SelectContent>
                  {scopedCompetencies.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {person && <p className="text-xs text-muted-foreground">{scopeDescription}</p>}
            </div>

            {/* Date */}
            <div className="space-y-1.5">
              <Label>Date of sign-off</Label>
              <input
                type="date"
                value={achievedAt}
                onChange={(e) => setAchievedAt(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

          </div>
        </CardContent>
      </Card>

      {/* ── Preceptor professional judgment notice ───────────────────── */}
      <div className="flex gap-3 px-4 py-3 rounded-lg border border-blue-200 bg-blue-50 text-blue-900">
        <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
        <div className="text-sm">
          <span className="font-semibold">Preceptor professional judgment — </span>
          A preceptor may sign off a competency as <span className="font-medium">Achieved</span> even if some step observations were Unsatisfactory. Use your judgment based on the nurse&apos;s overall demonstration of the skill.
        </div>
      </div>

      {/* ── Latest observation per step ──────────────────────────────── */}
      {competencyId && (
        <Card>
          <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b">
            <h2 className="text-sm font-semibold">Latest observation per step</h2>
            {compProgress && (
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${
                compProgress === "Achieved"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : compProgress === "InProgress"
                  ? "bg-blue-50 text-blue-700 border-blue-200"
                  : "bg-muted text-muted-foreground border-border"
              }`}>
                {compProgress === "Achieved" ? "Achieved" : compProgress === "InProgress" ? "In Progress" : "Not Started"}
              </span>
            )}
          </div>
          {compSteps.length === 0 ? (
            <CardContent className="py-4">
              <p className="text-sm text-muted-foreground">No steps defined for this competency.</p>
            </CardContent>
          ) : (
            <ul className="divide-y">
              {compSteps.map((step, idx) => {
                const latest = latestPerStep.get(step.id) ?? null;
                const observer = latest ? persons.find((n) => n.id === latest.observerId) : null;
                return (
                  <li key={step.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {idx + 1}. {step.name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {latest
                          ? `${fmtISO(latest.observedAt)} · ${observer?.name ?? "Unknown"}`
                          : "No observations"}
                      </p>
                    </div>
                    <div className="shrink-0">
                      <RatingBadge rating={latest?.rating ?? null} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}

      {/* ── Rationale / notes ────────────────────────────────────────── */}
      <Card>
        <CardContent className="pt-5 pb-5 space-y-2">
          <Label>Rationale / notes <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <Textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder='e.g., "Demonstrated independent technique on three patients over two shifts. Recommend monthly drill reinforcement."'
          />
        </CardContent>
      </Card>

      {/* ── Sticky bottom bar ────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur">
        <div className="max-w-screen-xl mx-auto flex items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Shield className="h-3.5 w-3.5 shrink-0" />
            Sign-offs are permanent and form part of the competency audit trail.
          </div>
          {saved ? (
            <span className="flex items-center gap-2 px-5 py-2 rounded-md bg-emerald-600 text-white text-sm font-medium">
              <CheckCircle2 className="h-4 w-4" />
              Marked as Achieved
            </span>
          ) : (
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              className="flex items-center gap-2 px-5 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none transition-colors"
            >
              <Award className="h-4 w-4" />
              Mark as Achieved
            </button>
          )}
        </div>
      </div>

    </div>
  );
}
