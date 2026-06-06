import { useState } from "react";
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
import type {
  ChangeRequestType, RequesterRole, Competency,
} from "@/data/types";

interface ChangeRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-fill the competency the request is about. Optional. */
  competency?: Competency;
  /** Pre-fill the request type. Defaults to "Edit". */
  defaultType?: ChangeRequestType;
}

/**
 * Dialog used by Preceptors and Unit Leaders to submit a change request
 * against the catalog. Administrators triage these on /requests.
 */
export function ChangeRequestDialog({
  open, onOpenChange, competency, defaultType = "Edit",
}: ChangeRequestDialogProps) {
  const { currentLogin } = useAuth();
  const { submitChangeRequest, logAudit } = useData();

  const [type, setType] = useState<ChangeRequestType>(defaultType);
  const [rationale, setRationale] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canSubmit =
    !!currentLogin &&
    (currentLogin.systemRole === "Preceptor" || currentLogin.systemRole === "UnitLeader") &&
    rationale.trim().length > 0;

  function handleSubmit() {
    if (!currentLogin || !canSubmit) return;
    setSubmitting(true);
    try {
      const requesterRole: RequesterRole =
        currentLogin.systemRole === "UnitLeader" ? "UnitLeader" : "Preceptor";
      const cr = submitChangeRequest({
        requesterId: currentLogin.id,
        requesterRole,
        type,
        competencyId: competency?.id,
        rationale: rationale.trim(),
      });
      logAudit({
        actor: currentLogin.id,
        actorRole: currentLogin.systemRole,
        type: "ChangeRequestSubmitted",
        summary: `${type} request submitted${competency ? ` for ${competency.name}` : ""}`,
        targetLabel: competency?.name ?? cr.id,
      });
      setRationale("");
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request catalog change</DialogTitle>
          <DialogDescription>
            Administrators review change requests. You'll see the decision back here in the
            Change Requests inbox.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {competency && (
            <div className="rounded-md border bg-muted/50 px-3 py-2 text-sm">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Competency</div>
              <div className="font-medium">{competency.name}</div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="cr-type">Request type</Label>
            <Select value={type} onValueChange={(v) => setType(v as ChangeRequestType)}>
              <SelectTrigger id="cr-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Add">Add a competency</SelectItem>
                <SelectItem value="Edit">Edit this competency</SelectItem>
                <SelectItem value="Remove">Remove this competency</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cr-rationale">Rationale</Label>
            <Textarea
              id="cr-rationale"
              placeholder="Why is this change needed? What's the clinical or operational driver?"
              rows={5}
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Include enough detail that an administrator can decide without follow-up.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
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