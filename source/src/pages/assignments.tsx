import { useMemo, useState } from "react";
import { useAuth } from "@/data/auth";
import { useData } from "@/data/store";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { StageBadge } from "@/components/common/StageBadge";
import { Trash2 } from "lucide-react";
import { STAGES, type Stage } from "@/data/types";

/**
 * Admin page for mapping competencies to (unit × role) at a given stage.
 */
export default function AssignmentsPage() {
  const { currentLogin } = useAuth();
  const {
    units, personRoles, competencies, assignments,
    upsertAssignment, removeAssignment, logAudit,
  } = useData();

  const [unitId, setUnitId] = useState(units[0]?.id ?? "");
  const [roleId, setRoleId] = useState(personRoles[0]?.id ?? "");

  const inScope = useMemo(
    () => assignments.filter((a) => a.unitId === unitId && a.roleId === roleId),
    [assignments, unitId, roleId],
  );

  const compById = useMemo(() => {
    const m = new Map<string, string>();
    competencies.forEach((c) => m.set(c.id, c.name));
    return m;
  }, [competencies]);

  if (currentLogin?.systemRole !== "Administrator") {
    return <p className="text-sm text-muted-foreground">Administrator access required.</p>;
  }

  function assignNew(competencyId: string, stage: Stage) {
    if (!competencyId) return;
    const id = `as-${Math.random().toString(36).slice(2, 10)}`;
    upsertAssignment({ id, competencyId, unitId, roleId, stage });
    logAudit({
      actor: currentLogin!.id,
      actorRole: currentLogin!.systemRole,
      type: "AssignmentAdded",
      summary: `Assigned ${compById.get(competencyId) ?? competencyId} to ${units.find((u) => u.id === unitId)?.name} (${personRoles.find((r) => r.id === roleId)?.name}, ${stage})`,
    });
  }

  function unassign(assignmentId: string) {
    const a = inScope.find((x) => x.id === assignmentId);
    removeAssignment(assignmentId);
    if (a) {
      logAudit({
        actor: currentLogin!.id,
        actorRole: currentLogin!.systemRole,
        type: "AssignmentRemoved",
        summary: `Unassigned ${compById.get(a.competencyId) ?? a.competencyId}`,
      });
    }
  }

  // Competencies not yet assigned to this scope
  const unassigned = competencies.filter((c) => !inScope.some((a) => a.competencyId === c.id));

  return (
    <>
      <PageHeader
        title="Assignments"
        description="Map competencies to a unit and clinical role at a specific stage."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6 max-w-xl">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Unit</label>
          <Select value={unitId} onValueChange={setUnitId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {units.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Clinical role</label>
          <Select value={roleId} onValueChange={setRoleId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {personRoles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="mb-6">
        <CardContent className="p-0">
          <div className="px-4 py-2 border-b text-xs uppercase tracking-wider text-muted-foreground">
            Assigned ({inScope.length})
          </div>
          {inScope.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">No competencies assigned to this scope.</div>
          )}
          <ul className="divide-y">
            {inScope
              .slice()
              .sort((a, b) => (compById.get(a.competencyId) ?? "").localeCompare(compById.get(b.competencyId) ?? ""))
              .map((a) => (
                <li key={a.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                  <span className="text-sm truncate">{compById.get(a.competencyId)}</span>
                  <div className="flex items-center gap-2">
                    <StageBadge stage={a.stage} size="sm" />
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => unassign(a.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="px-4 py-2 border-b text-xs uppercase tracking-wider text-muted-foreground">
            Unassigned ({unassigned.length})
          </div>
          {unassigned.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">Everything in the catalog is already assigned.</div>
          )}
          <ul className="divide-y">
            {unassigned
              .slice()
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((c) => (
                <li key={c.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                  <span className="text-sm truncate">{c.name}</span>
                  <div className="flex items-center gap-1">
                    {STAGES.map((s) => (
                      <Button key={s} size="sm" variant="outline" onClick={() => assignNew(c.id, s)}>
                        Assign · {s}
                      </Button>
                    ))}
                  </div>
                </li>
              ))}
          </ul>
        </CardContent>
      </Card>
    </>
  );
}