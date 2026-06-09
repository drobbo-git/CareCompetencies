import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/data/auth";
import { useData } from "@/data/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { StageBadge } from "@/components/common/StageBadge";
import { GitPullRequestArrow, History } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface PendingChange {
  personId: string;
  personName: string;
  fromPreceptorId: string | null;
  toPreceptorId: string | null;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function UnitAssignmentsPage() {
  const { currentLogin } = useAuth();
  const {
    units, persons, privileges, observations, achievements,
    getPersonStage, getDaysSinceStart,
    reassignPreceptor, logAudit,
  } = useData();

  const [pending, setPending] = useState<PendingChange | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const unit = useMemo(
    () => currentLogin?.unitIds?.[0]
      ? units.find((u) => u.id === currentLogin.unitIds![0])
      : undefined,
    [units, currentLogin],
  );

  // Active learners on this unit, sorted by last name
  const learners = useMemo(() => {
    if (!unit) return [];
    return persons
      .filter((p) => {
        if (p.unitId !== unit.id) return false;
        const s = getPersonStage(p.id);
        return s !== "FullyOriented" && s !== "Nonclinical";
      })
      .sort((a, b) => {
        const lastName = (n: string) => n.replace(/,.*$/, "").trim().split(" ").at(-1) ?? n;
        return lastName(a.name).localeCompare(lastName(b.name));
      });
  }, [unit, persons, getPersonStage]);

  // Persons with Preceptor privilege on this unit
  const unitPreceptors = useMemo(() => {
    if (!unit) return [];
    const ids = new Set(
      privileges
        .filter((p) => p.privilege === "Preceptor" && p.unitId === unit.id)
        .map((p) => p.personId),
    );
    return persons.filter((p) => ids.has(p.id));
  }, [unit, persons, privileges]);

  // Set of person IDs who hold UnitLeader privilege on this unit
  const unitLeaderIds = useMemo(
    () => new Set(
      privileges
        .filter((p) => p.privilege === "UnitLeader" && p.unitId === unit?.id)
        .map((p) => p.personId),
    ),
    [privileges, unit],
  );

  // Active learner count per preceptor
  const loadByPreceptor = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of learners) {
      if (l.primaryPreceptorId) {
        map.set(l.primaryPreceptorId, (map.get(l.primaryPreceptorId) ?? 0) + 1);
      }
    }
    return map;
  }, [learners]);

  // Most recent activity date per learner
  const lastActivityByPerson = useMemo(() => {
    const map = new Map<string, string>();
    for (const o of observations) {
      const cur = map.get(o.personId);
      if (!cur || o.observedAt > cur) map.set(o.personId, o.observedAt);
    }
    for (const a of achievements) {
      const cur = map.get(a.personId);
      if (!cur || a.achievedAt > cur) map.set(a.personId, a.achievedAt);
    }
    return map;
  }, [observations, achievements]);

  function preceptorDisplayName(id: string | null | undefined): string {
    if (!id) return "(unassigned)";
    const p = persons.find((x) => x.id === id);
    if (!p) return "(unknown)";
    return unitLeaderIds.has(p.id) ? `${p.name} (Unit Leader)` : p.name;
  }

  function handleDropdownChange(personId: string, personName: string, currentPreceptorId: string | null | undefined, newValue: string) {
    const newPreceptorId = newValue === "__unassigned__" ? null : newValue;
    if (newPreceptorId === (currentPreceptorId ?? null)) return;
    setPending({
      personId,
      personName,
      fromPreceptorId: currentPreceptorId ?? null,
      toPreceptorId: newPreceptorId,
    });
    setReason("");
  }

  async function handleConfirm() {
    if (!pending || !currentLogin) return;
    setSaving(true);
    setSaveError(null);
    try {
      await reassignPreceptor(pending.personId, pending.toPreceptorId);
      const learner = persons.find((p) => p.id === pending.personId);
      await logAudit({
        actor: currentLogin.id,
        actorRole: currentLogin.systemRole,
        type: "PreceptorReassigned",
        summary: `Reassigned preceptor for ${learner?.name ?? pending.personId}: ${preceptorDisplayName(pending.fromPreceptorId)} → ${preceptorDisplayName(pending.toPreceptorId)}`,
        targetLabel: learner?.name,
        detail: reason || undefined,
      });
      setPending(null);
      setReason("");
    } catch {
      setSaveError("Failed to save — please try again.");
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setPending(null);
    setReason("");
    setSaveError(null);
  }

  if (!currentLogin || !unit) return null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Assignments</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Active learners on {unit.name}. Reassign the primary preceptor as needed.
        </p>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Nurse</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Stage</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Day</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Start</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Primary preceptor</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Last activity</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">History</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {learners.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No active learners on this unit.
                  </td>
                </tr>
              ) : learners.map((learner) => {
                const stage = getPersonStage(learner.id);
                const days = getDaysSinceStart(learner.id);
                const lastAct = lastActivityByPerson.get(learner.id);
                const currentPreceptor = persons.find((p) => p.id === learner.primaryPreceptorId);

                return (
                  <tr key={learner.id} className="hover:bg-muted/30 transition-colors">
                    {/* Nurse */}
                    <td className="px-4 py-3">
                      <p className="font-semibold">{learner.name}</p>
                      {currentPreceptor && (
                        <p className="text-xs text-muted-foreground">currently: {currentPreceptor.name}</p>
                      )}
                    </td>

                    {/* Stage */}
                    <td className="px-4 py-3">
                      <StageBadge stage={stage} size="sm" />
                    </td>

                    {/* Day */}
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">{days}</td>

                    {/* Start date */}
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                      {new Date(learner.startDate + "T12:00:00").toLocaleDateString(undefined, {
                        month: "short", day: "numeric", year: "numeric",
                      })}
                    </td>

                    {/* Preceptor dropdown */}
                    <td className="px-4 py-3 min-w-72">
                      <Select
                        value={learner.primaryPreceptorId ?? "__unassigned__"}
                        onValueChange={(v) => handleDropdownChange(
                          learner.id, learner.name, learner.primaryPreceptorId, v,
                        )}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__unassigned__">(unassigned)</SelectItem>
                          {unitPreceptors.map((p) => {
                            const isUL = unitLeaderIds.has(p.id);
                            const count = loadByPreceptor.get(p.id) ?? 0;
                            const label = isUL
                              ? `${p.name} (Unit Leader)`
                              : `${p.name} · ${count} ${count === 1 ? "learner" : "learners"}`;
                            return (
                              <SelectItem key={p.id} value={p.id}>
                                {label}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </td>

                    {/* Last activity */}
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                      {lastAct
                        ? new Date(lastAct).toLocaleDateString(undefined, {
                            month: "short", day: "numeric", year: "numeric",
                          })
                        : "—"}
                    </td>

                    {/* History link */}
                    <td className="px-4 py-3 text-center">
                      <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                        <Link to={`/my-orientees/${learner.id}`}>
                          <History className="h-4 w-4 text-muted-foreground" />
                        </Link>
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Footer */}
      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <GitPullRequestArrow className="h-3.5 w-3.5 shrink-0" />
        Reassignments require confirmation and are recorded in the audit log.
      </p>

      {/* Confirmation dialog */}
      <Dialog open={!!pending} onOpenChange={(open) => { if (!open) handleCancel(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm reassignment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div>
              <p className="text-sm">
                Reassign primary preceptor for{" "}
                <strong>{pending?.personName.replace(/,.*$/, "").trim()}</strong>?
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {preceptorDisplayName(pending?.fromPreceptorId)}{" "}
                →{" "}
                {preceptorDisplayName(pending?.toPreceptorId)}
              </p>
            </div>
            {saveError && (
              <p className="text-sm text-destructive">{saveError}</p>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="reassign-reason">
                Reason{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Textarea
                id="reassign-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., Coverage during PTO; preceptor capacity rebalancing; orientee preference."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancel} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={saving}>
              {saving ? "Saving…" : "Confirm reassignment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
