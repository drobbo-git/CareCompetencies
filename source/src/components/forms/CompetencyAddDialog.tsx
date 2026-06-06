import { useMemo, useState } from "react";
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

interface CompetencyAddDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Admin-only dialog for adding a new competency to the catalog.
 *
 * Note: the Category dropdown was removed during the May rebrand cleanup.
 * Group is the meaningful hierarchical axis; Category was redundant. The
 * underlying field is still populated automatically (first available
 * category) so the data model remains valid for back-compat — see
 * etl/README.md "Recent changes".
 */
export function CompetencyAddDialog({ open, onOpenChange }: CompetencyAddDialogProps) {
  const { currentLogin } = useAuth();
  const { groups, units, categories, upsertCompetency, upsertSteps, logAudit } = useData();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [groupId, setGroupId] = useState<string>("");
  const [selectedUnitIds, setSelectedUnitIds] = useState<Set<string>>(new Set());
  const [stepsText, setStepsText] = useState("");

  const orderedGroups = useMemo(
    () => groups.slice().sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0) || a.name.localeCompare(b.name)),
    [groups],
  );

  const canSave = name.trim().length > 0 && groupId.length > 0;

  function reset() {
    setName("");
    setDescription("");
    setGroupId("");
    setSelectedUnitIds(new Set());
    setStepsText("");
  }

  function toggleUnit(id: string, on: boolean) {
    setSelectedUnitIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function handleSave() {
    if (!currentLogin || !canSave) return;
    const id = `c-${Math.random().toString(36).slice(2, 10)}`;
    const fallbackCategory = categories[0]?.id;
    const comp: Competency = {
      id,
      name: name.trim(),
      description: description.trim() || undefined,
      groupId,
      categoryId: fallbackCategory, // back-compat; not surfaced in UI
      unitIds: Array.from(selectedUnitIds),
    };
    await upsertCompetency(comp);

    // Parse stepsText (one step per line) into ordered steps.
    const lines = stepsText.split("\n").map((s) => s.trim()).filter(Boolean);
    const newSteps: CompetencyStep[] = lines.map((line, i) => ({
      id: `s-${id}-${i + 1}`,
      competencyId: id,
      name: line,
      orderIndex: i + 1,
    }));
    if (newSteps.length > 0) await upsertSteps(id, newSteps);

    void logAudit({
      actor: currentLogin.id,
      actorRole: currentLogin.systemRole,
      type: "CompetencyAdded",
      summary: `Added competency "${comp.name}"`,
      targetLabel: comp.name,
      detail: `Group ${groups.find((g) => g.id === groupId)?.name ?? groupId}; ${newSteps.length} step(s); ${selectedUnitIds.size} unit(s)`,
    });

    reset();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add competency</DialogTitle>
          <DialogDescription>
            Define a new catalog entry. You can edit assignments and steps later.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto pr-1">
          <div className="space-y-1.5">
            <Label htmlFor="ca-name">Name</Label>
            <Input
              id="ca-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Central line dressing change"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ca-group">Group</Label>
            <Select value={groupId} onValueChange={setGroupId}>
              <SelectTrigger id="ca-group">
                <SelectValue placeholder="Select a group" />
              </SelectTrigger>
              <SelectContent>
                {orderedGroups.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ca-desc">Description</Label>
            <Textarea
              id="ca-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Optional. Clinical context, scope, or references."
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
            <p className="text-xs text-muted-foreground">
              Pick the units this competency applies to. You can change this later.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ca-steps">Steps (one per line)</Label>
            <Textarea
              id="ca-steps"
              value={stepsText}
              onChange={(e) => setStepsText(e.target.value)}
              rows={5}
              placeholder={"Identify patient using two identifiers\nDon PPE\n…"}
            />
            <p className="text-xs text-muted-foreground">
              Optional. You can add steps now or later from the competency detail page.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!canSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}