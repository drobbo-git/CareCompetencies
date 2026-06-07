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
import { localDateStringToISO, todayLocalISODate } from "@/lib/utils";

/** Sign off a whole competency as Achieved for an orientee. */
export default function SignOffPage() {
  const { currentLogin } = useAuth();
  const { persons, recordAchievement, competencies, logAudit } = useData();

  const myOrientees = useMemo(() => {
    if (!currentLogin) return [];
    if (currentLogin.systemRole === "UnitLeader") {
      return persons.filter((n) => n.unitId === currentLogin.unitId);
    }
    return persons.filter((n) => n.primaryPreceptorId === currentLogin.id);
  }, [persons, currentLogin]);

  const [personId, setPersonId] = useState<string>("");
  const [competencyId, setCompetencyId] = useState<string>("");
  const [achievedAt, setAchievedAt] = useState(todayLocalISODate());
  const [notes, setNotes] = useState("");

  const person = persons.find((n) => n.id === personId);
  const canSave = !!currentLogin && !!personId && !!competencyId;

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
    setCompetencyId("");
    setNotes("");
  }

  return (
    <>
      <PageHeader
        title="Sign off"
        description="Mark a competency as Achieved for an orientee. Creates an immutable signoff record."
      />

      <Card className="max-w-2xl">
        <CardHeader><CardTitle className="text-sm">New sign-off</CardTitle></CardHeader>
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
                onChange={setCompetencyId}
              />
            </div>
          )}

          <div className="space-y-1.5 max-w-xs">
            <Label>Signed off on</Label>
            <Input
              type="date"
              value={achievedAt}
              onChange={(e) => setAchievedAt(e.target.value)}
            />
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
            <Button onClick={handleSave} disabled={!canSave}>Sign off</Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}