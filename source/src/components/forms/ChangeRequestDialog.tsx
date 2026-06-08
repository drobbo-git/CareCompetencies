import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/data/auth";
import { useData } from "@/data/store";
import { CR_TYPE_LABEL } from "@/data/types";
import type { ChangeRequestType, RequesterRole } from "@/data/types";

interface ChangeRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-fill the competency the request is about. Optional. */
  prefilledCompetencyId?: string;
}

export function ChangeRequestDialog({
  open, onOpenChange, prefilledCompetencyId,
}: ChangeRequestDialogProps) {
  const { currentLogin } = useAuth();
  const { competencies, submitChangeRequest, logAudit } = useData();

  const [type, setType] = useState<ChangeRequestType>("Add");
  const [competencyId, setCompetencyId] = useState<string>(prefilledCompetencyId ?? "__none__");
  const [rationale, setRationale] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Sync pre-fill when prop changes or dialog reopens
  useEffect(() => {
    setCompetencyId(prefilledCompetencyId ?? "__none__");
  }, [prefilledCompetencyId, open]);

  function handleClose() {
    setRationale("");
    setType("Add");
    setCompetencyId(prefilledCompetencyId ?? "__none__");
    onOpenChange(false);
  }

  const canSubmit =
    !!currentLogin &&
    (currentLogin.systemRole === "Preceptor" || currentLogin.systemRole === "UnitLeader") &&
    rationale.trim().length > 0;

  async function handleSubmit() {
    if (!currentLogin || !canSubmit) return;
    setSubmitting(true);
    try {
      const requesterRole: RequesterRole =
        currentLogin.systemRole === "UnitLeader" ? "UnitLeader" : "Preceptor";
      const resolvedCompId = competencyId === "__none__" ? undefined : competencyId;
      const comp = competencies.find((c) => c.id === resolvedCompId);
      const cr = await submitChangeRequest({
        requesterId: currentLogin.id,
        requesterRole,
        type,
        competencyId: resolvedCompId,
        rationale: rationale.trim(),
      });
      logAudit({
        actor: currentLogin.id,
        actorRole: currentLogin.systemRole,
        type: "ChangeRequestSubmitted",
        summary: `${type} request submitted${comp ? ` for ${comp.name}` : ""}`,
        targetLabel: comp?.name ?? cr.id,
      });
      handleClose();
    } finally {
      setSubmitting(false);
    }
  }

  const sortedCompetencies = [...competencies].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Request a library change</DialogTitle>
          <DialogDescription>
            Administrators will review your request. The library itself is not modified until approved.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="cr-type">Type of change</Label>
            <Select value={type} onValueChange={(v) => setType(v as ChangeRequestType)}>
              <SelectTrigger id="cr-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(CR_TYPE_LABEL) as ChangeRequestType[]).map((t) => (
                  <SelectItem key={t} value={t}>{CR_TYPE_LABEL[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cr-comp">Related competency (optional)</Label>
            <Select value={competencyId} onValueChange={setCompetencyId}>
              <SelectTrigger id="cr-comp">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— None / new competency —</SelectItem>
                {sortedCompetencies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cr-rationale">Rationale</Label>
            <Textarea
              id="cr-rationale"
              placeholder="Explain what change you propose and why it matters."
              rows={5}
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || submitting}>
            {submitting ? "Submitting…" : "Submit request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
