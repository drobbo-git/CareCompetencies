import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/data/auth";
import { useData } from "@/data/store";
import type { Competency, CompetencyStep } from "@/data/types";

interface CompetencyEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  competency: Competency;
}

/**
 * Admin-only dialog for editing an existing competency.
 *
 * Same "Group only, no Category" rule as Add — see CompetencyAddDialog.
 */
export function CompetencyEditDialog({
  open, onOpenChange, competency,
}: CompetencyEditDialogProps) {
  const { currentLogin } = useAuth();
  const { groups, units, steps, upsertCompetency, upsertSteps, logAudit } = useData();

  const [name, setName] = useState(competency.name);
  const [description, setDescription] = useState(competency.description ?? "");
  const [groupId, setGroupId] = useState<string>(competency.groupId ?? "");
  const [selectedUnitIds, setSelectedUnitIds] = useState<Set<string>>(new Set(competency.unitIds));
  const existingSteps = useMemo(
    () => steps.filter((s) => s.competencyId === competency.id).sort((a, b) => a.orderIndex - b.orderIndex),
    [steps, competency.id],
  );
  const [stepsText, setStepsText] = useState(existingSteps.map((s) => s.name).join("\n"));

  // Reset state when the competency changes (re-open with a different row).
  useEffect(() => {
    setName(competency.name);
    setDescription(competency.description ?? "");
    setGroupId(competency.groupId ?? "");
    setSelectedUnitIds(new Set(competency.unitIds));
    setStepsText(existingSteps.map((s) => s.name).join("\n"));
  }, [competency, existingSteps]);

  const orderedGroups = useMemo(
    () => groups.slice().sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0) || a.name.localeCompare(b.name)),
    [groups],
  );

  const canSave = name.trim().length > 0 && groupId.length > 0;

  function toggleUnit(id: string, on: boolean) {
    setSelectedUnitIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function handleSave() {
    if (!currentLogin || !canSave) return;
    const updated: Competency = {
      ...competency,
      name: name.trim(),
      description: description.trim() || undefined,
      groupId,
      unitIds: Array.from(selectedUnitIds),
    };
    upsertCompetency(updated);

    const lines = stepsText.split("\n").map((s) => s.trim()).filter(Boolean);
    const updatedSteps: CompetencyStep[] = lines.map((line, i) => {
      const existing = existingSteps[i];
      return {
        id: existing?.id ?? `s-${competency.id}-${Math.random().toString(36).slice(2, 8)}`,
        competencyId: competency.id,
        name: line,
        orderIndex: i + 1,
      };
    });
    upsertSteps(competency.id, updatedSteps);

    logAudit({
      actor: currentLogin.id,
      actorRole: currentLogin.systemRole,
      type: "CompetencyEdited",
      summary: `Edited competency "${updated.name}"`,
      targetLabel: updated.name,
    });

    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit competency</DialogTitle>
          <DialogDescription>
            Catalog edits are audited. Step changes overwrite the existing step list.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto pr-1">
          <div className="space-y-1.5">
            <Label htmlFor="ce-name">Name</Label>
            <Input id="ce-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ce-group">Group</Label>
            <Select value={groupId} onValueChange={setGroupId}>
              <SelectTrigger id="ce-group">
                <SelectValue placeholder="Select a group" />
              </SelectTrigger>
              <SelectContent>
                {orderedGroups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ce-desc">Description</Label>
            <Textarea
              id="ce-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Units</Label>
            <div className="rounded-md border bg-card divide-y">
              {units.map((u) => (
                <label
                  key={u.id}
                  className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer"
                >
                  <Checkbox
                    checked={selectedUnitIds.has(u.id)}
                    onCheckedChange={(v) => toggleUnit(u.id, !!v)}
                  />
                  <span>{u.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ce-steps">Steps (one per line)</Label>
            <Textarea
              id="ce-steps"
              value={stepsText}
              onChange={(e) => setStepsText(e.target.value)}
              rows={6}
            />
            <p className="text-xs text-muted-foreground">
              Existing observations stay attached to their step ids; reordering lines preserves them where possible.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!canSave}>Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}