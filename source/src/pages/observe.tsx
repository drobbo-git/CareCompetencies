import { useMemo, useState } from "react";
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
import type { ObservationRating } from "@/data/types";
import { localDateStringToISO, todayLocalISODate } from "@/lib/utils";

/** Record a step observation for an orientee. */
export default function ObservePage() {
  const { currentLogin } = useAuth();
  const { persons, steps, recordObservation, logAudit, competencies } = useData();

  const myOrientees = useMemo(() => {
    if (!currentLogin) return [];
    if (currentLogin.systemRole === "UnitLeader") {
      return persons.filter((n) => n.unitId === currentLogin.unitId);
    }
    return persons.filter((n) => n.primaryPreceptorId === currentLogin.id);
  }, [persons, currentLogin]);

  const [personId, setPersonId] = useState<string>("");
  const [competencyId, setCompetencyId] = useState<string>("");
  const [stepId, setStepId] = useState<string>("");
  const [rating, setRating] = useState<ObservationRating>("Satisfactory");
  const [observedAt, setObservedAt] = useState(todayLocalISODate());
  const [notes, setNotes] = useState("");

  const person = persons.find((n) => n.id === personId);
  const compSteps = useMemo(
    () => steps.filter((s) => s.competencyId === competencyId).sort((a, b) => a.orderIndex - b.orderIndex),
    [steps, competencyId],
  );

  const canSave = !!currentLogin && !!personId && !!competencyId && !!stepId;

  function handleSave() {
    if (!currentLogin || !canSave) return;
    const obs = recordObservation({
      personId,
      stepId,
      competencyId,
      preceptorId: currentLogin.id,
      rating,
      observedAt: localDateStringToISO(observedAt),
      notes: notes.trim() || undefined,
    });
    const comp = competencies.find((c) => c.id === competencyId)?.name ?? competencyId;
    logAudit({
      actor: currentLogin.id,
      actorRole: currentLogin.systemRole,
      type: "StepObservationRecorded",
      summary: `Recorded ${rating} on "${comp}" for ${person?.name ?? personId}`,
      targetLabel: comp,
      detail: notes.trim() || undefined,
    });
    void obs;
    setStepId("");
    setNotes("");
    setRating("Satisfactory");
  }

  return (
    <>
      <PageHeader
        title="Observe"
        description="Record a step observation for an orientee."
      />

      <Card className="max-w-2xl">
        <CardHeader><CardTitle className="text-sm">New observation</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Orientee</Label>
            <Select value={personId} onValueChange={(v) => { setPersonId(v); setCompetencyId(""); setStepId(""); }}>
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
                onChange={(id) => { setCompetencyId(id); setStepId(""); }}
              />
            </div>
          )}

          {competencyId && (
            <div className="space-y-1.5">
              <Label>Step</Label>
              <Select value={stepId} onValueChange={setStepId}>
                <SelectTrigger><SelectValue placeholder="Pick a step…" /></SelectTrigger>
                <SelectContent>
                  {compSteps.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.orderIndex}. {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Outcome</Label>
              <Select value={rating} onValueChange={(v) => setRating(v as ObservationRating)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Satisfactory">Satisfactory</SelectItem>
                  <SelectItem value="Unsatisfactory">Unsatisfactory</SelectItem>
                  <SelectItem value="NotObserved">Not Observed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Observed on</Label>
              <Input
                type="date"
                value={observedAt}
                onChange={(e) => setObservedAt(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional. Context for the audit record."
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={!canSave}>Record observation</Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}