import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/data/auth";
import { useData } from "@/data/store";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ScopedCompetencySelector } from "@/components/common/ScopedCompetencySelector";
import type { CompetencyStep, ObservationRating } from "@/data/types";
import { localDateStringToISO, todayLocalISODate } from "@/lib/utils";

interface StepEntry {
  step: CompetencyStep;
  rating: ObservationRating | null;
  notes: string;
}

/** Record step observations for an orientee. */
export default function ObservePage() {
  const { currentLogin } = useAuth();
  const { persons, steps, competencies, recordObservation, logAudit } = useData();
  const { state } = useLocation();

  const myOrientees = useMemo(() => {
    if (!currentLogin) return [];
    if (currentLogin.systemRole === "UnitLeader") {
      return persons.filter((n) => n.unitId === currentLogin.unitId);
    }
    return persons.filter((n) => n.primaryPreceptorId === currentLogin.id);
  }, [persons, currentLogin]);

  const [personId, setPersonId] = useState<string>((state as { personId?: string } | null)?.personId ?? "");
  const [competencyId, setCompetencyId] = useState<string>((state as { competencyId?: string } | null)?.competencyId ?? "");
  const [observedAt, setObservedAt] = useState(todayLocalISODate());
  const [entries, setEntries] = useState<StepEntry[]>([]);
  const [saving, setSaving] = useState(false);

  const person = persons.find((n) => n.id === personId);

  const compSteps = useMemo(
    () => steps.filter((s) => s.competencyId === competencyId).sort((a, b) => a.orderIndex - b.orderIndex),
    [steps, competencyId],
  );

  useEffect(() => {
    setEntries(compSteps.map((s) => ({ step: s, rating: null, notes: "" })));
  }, [competencyId, compSteps]);

  function setRating(index: number, rating: ObservationRating) {
    setEntries((prev) => prev.map((e, i) => i === index ? { ...e, rating } : e));
  }

  function setNote(index: number, notes: string) {
    setEntries((prev) => prev.map((e, i) => i === index ? { ...e, notes } : e));
  }

  const ratedEntries = entries.filter((e) => e.rating !== null);
  const canSave = !!currentLogin && !!personId && !!competencyId && ratedEntries.length > 0;

  async function handleSave() {
    if (!currentLogin || !canSave) return;
    setSaving(true);
    try {
      await Promise.all(
        ratedEntries.map((entry) =>
          recordObservation({
            personId,
            stepId: entry.step.id,
            competencyId,
            preceptorId: currentLogin.id,
            rating: entry.rating!,
            observedAt: localDateStringToISO(observedAt),
            notes: entry.notes.trim() || undefined,
          }),
        ),
      );
      const compName = competencies.find((c) => c.id === competencyId)?.name ?? competencyId;
      void logAudit({
        actor: currentLogin.id,
        actorRole: currentLogin.systemRole,
        type: "StepObservationRecorded",
        summary: `Recorded ${ratedEntries.length} observation(s) on "${compName}" for ${person?.name ?? personId}`,
        targetLabel: compName,
      });
      // Keep orientee + competency selected; reset step ratings for next round
      setEntries(compSteps.map((s) => ({ step: s, rating: null, notes: "" })));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader title="Observe" description="Record step observations for an orientee." />

      <Card className="max-w-2xl">
        <CardHeader><CardTitle className="text-sm">New observation</CardTitle></CardHeader>
        <CardContent className="space-y-4">

          <div className="space-y-1.5">
            <Label>Orientee</Label>
            <Select value={personId} onValueChange={(v) => { setPersonId(v); setCompetencyId(""); }}>
              <SelectTrigger><SelectValue placeholder="Pick an orientee…" /></SelectTrigger>
              <SelectContent>
                {myOrientees.map((n) => <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {person && (
            <div className="space-y-1.5">
              <Label>Competency</Label>
              <ScopedCompetencySelector
                unitId={person.unitId}
                roleId={person.roleId ?? "r-rn"}
                value={competencyId}
                onChange={(id) => setCompetencyId(id)}
              />
            </div>
          )}

          {competencyId && (
            <div className="space-y-1.5">
              <Label>Observed on</Label>
              <Input
                type="date"
                value={observedAt}
                onChange={(e) => setObservedAt(e.target.value)}
              />
            </div>
          )}

          {competencyId && entries.length === 0 && (
            <p className="text-sm text-muted-foreground">No steps defined for this competency.</p>
          )}

          {entries.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Steps</Label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEntries((prev) => prev.map((e) => ({ ...e, rating: "Satisfactory" })))}
                >
                  All Satisfactory
                </Button>
              </div>
              {entries.map((entry, i) => (
                <div key={entry.step.id} className="border rounded-lg p-3 space-y-2">
                  <p className="text-sm font-medium">{i + 1}. {entry.step.name}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant={entry.rating === "Satisfactory" ? "default" : "outline"}
                      onClick={() => setRating(i, "Satisfactory")}
                    >
                      Satisfactory
                    </Button>
                    <Button
                      size="sm"
                      variant={entry.rating === "Unsatisfactory" ? "destructive" : "outline"}
                      onClick={() => setRating(i, "Unsatisfactory")}
                    >
                      Unsatisfactory
                    </Button>
                    <Button
                      size="sm"
                      variant={entry.rating === "NotObserved" ? "secondary" : "outline"}
                      onClick={() => setRating(i, "NotObserved")}
                    >
                      Not Observed
                    </Button>
                  </div>
                  {entry.rating && (
                    <Textarea
                      placeholder="Note (optional)"
                      value={entry.notes}
                      onChange={(e) => setNote(i, e.target.value)}
                      rows={2}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {canSave && (
            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : `Save ${ratedEntries.length} observation${ratedEntries.length === 1 ? "" : "s"}`}
              </Button>
            </div>
          )}

        </CardContent>
      </Card>
    </>
  );
}
