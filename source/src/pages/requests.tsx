import { useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/data/auth";
import { useData } from "@/data/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ChangeRequestDialog } from "@/components/forms/ChangeRequestDialog";
import { CR_STATUS_LABEL, CR_TYPE_LABEL } from "@/data/types";
import type { ChangeRequest, ChangeRequestStatus } from "@/data/types";
import { GitPullRequestArrow, History } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Status pill styling
// ---------------------------------------------------------------------------
const STATUS_CLASSES: Record<ChangeRequestStatus, string> = {
  Pending:     "border-blue-400 text-blue-700 bg-blue-50",
  UnderReview: "border-amber-400 text-amber-700 bg-amber-50",
  Approved:    "border-green-500 text-green-700 bg-green-50",
  Rejected:    "border-red-400 text-red-700 bg-red-50",
};

const ALL_STATUSES: ChangeRequestStatus[] = ["Pending", "UnderReview", "Approved", "Rejected"];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function RequestsPage() {
  const { currentLogin } = useAuth();
  const { changeRequests, competencies, persons, personRoles, decideChangeRequest, logAudit } = useData();
  const location = useLocation();
  const prefilledCompetencyId: string | undefined = (location.state as { competencyId?: string } | null)?.competencyId;

  const [dialogOpen, setDialogOpen] = useState(() => !!prefilledCompetencyId);
  const [statusFilter, setStatusFilter] = useState<ChangeRequestStatus | "all">("all");
  const [decideOn, setDecideOn] = useState<ChangeRequest | null>(null);
  const [decision, setDecision] = useState<"Approved" | "Rejected">("Approved");
  const [note, setNote] = useState("");

  const isAdmin = currentLogin?.systemRole === "Administrator";

  // Show all requests (unit-level view); admins see all, others see all too since unit is shared
  const visible = useMemo(() => {
    if (!currentLogin) return [];
    return [...changeRequests].sort(
      (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime(),
    );
  }, [changeRequests, currentLogin]);

  // Count per status (for filter pills)
  const countByStatus = useMemo(() => {
    const m: Record<ChangeRequestStatus | "all", number> = { all: visible.length, Pending: 0, UnderReview: 0, Approved: 0, Rejected: 0 };
    for (const cr of visible) {
      if (cr.status in m) (m as Record<string, number>)[cr.status]++;
    }
    return m;
  }, [visible]);

  const filtered = useMemo(() =>
    statusFilter === "all" ? visible : visible.filter((cr) => cr.status === statusFilter),
    [visible, statusFilter],
  );

  const compName = (id?: string) => competencies.find((c) => c.id === id)?.name;

  function personDisplay(requesterId: string, requesterRole: string) {
    const p = persons.find((x) => x.id === requesterId);
    const role = p ? personRoles.find((r) => r.id === p.roleId) : undefined;
    const name = p?.name ?? requesterId;
    return `${name}${role ? `, ${role.name}` : ""} (${requesterRole})`;
  }

  function openDecision(cr: ChangeRequest, dec: "Approved" | "Rejected") {
    setDecideOn(cr);
    setDecision(dec);
    setNote("");
  }

  async function commitDecision() {
    if (!decideOn || !currentLogin) return;
    await decideChangeRequest(decideOn.id, decision, note.trim() || undefined);
    logAudit({
      actor: currentLogin.id,
      actorRole: currentLogin.systemRole,
      type: decision === "Approved" ? "ChangeRequestApproved" : "ChangeRequestRejected",
      summary: `${decision} change request`,
      targetLabel: decideOn.id,
      detail: note.trim() || undefined,
    });
    setDecideOn(null);
    setNote("");
  }

  const canSubmitNew = currentLogin?.systemRole === "Preceptor" || currentLogin?.systemRole === "UnitLeader";

  return (
    <>
      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Change Requests</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Submit a request to suggest changes to the library; admins will review.
          </p>
        </div>
        {canSubmitNew && (
          <Button onClick={() => setDialogOpen(true)} className="shrink-0">
            <GitPullRequestArrow className="h-4 w-4 mr-1.5" />
            New request
          </Button>
        )}
      </div>

      {/* ── Status filter pills ──────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 mb-5">
        {/* All */}
        <button
          type="button"
          onClick={() => setStatusFilter("all")}
          className={cn(
            "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors",
            statusFilter === "all"
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background border-border text-foreground hover:bg-muted",
          )}
        >
          All status
          <span className={cn(
            "inline-flex h-5 min-w-5 items-center justify-center rounded-full text-xs px-1",
            statusFilter === "all" ? "bg-white/20" : "bg-muted",
          )}>
            {countByStatus.all}
          </span>
        </button>

        {ALL_STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium border transition-colors",
              statusFilter === s
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background border-border text-foreground hover:bg-muted",
            )}
          >
            {CR_STATUS_LABEL[s]}
            <span className={cn(
              "inline-flex h-5 min-w-5 items-center justify-center rounded-full text-xs px-1",
              statusFilter === s ? "bg-white/20" : "bg-muted",
            )}>
              {countByStatus[s]}
            </span>
          </button>
        ))}
      </div>

      {/* ── Request list ─────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="px-4 py-10 text-center text-sm text-muted-foreground">
            No change requests match this filter.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((cr) => {
            const cName = compName(cr.competencyId);
            const status = cr.status as ChangeRequestStatus;
            const typeLabel = cr.type in CR_TYPE_LABEL
              ? CR_TYPE_LABEL[cr.type as keyof typeof CR_TYPE_LABEL]
              : cr.type;
            return (
              <Card key={cr.id}>
                <CardContent className="px-5 py-4 space-y-2">
                  {/* Pills row */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full border text-xs font-medium text-foreground">
                      {typeLabel}
                    </span>
                    <span className={cn(
                      "inline-flex items-center px-2.5 py-0.5 rounded-full border text-xs font-medium",
                      STATUS_CLASSES[status] ?? "border-border text-muted-foreground",
                    )}>
                      {CR_STATUS_LABEL[status] ?? status}
                    </span>
                    {cName && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full border text-xs font-medium text-foreground">
                        {cName}
                      </span>
                    )}
                  </div>

                  {/* Rationale */}
                  {cr.rationale && (
                    <p className="text-sm leading-relaxed">{cr.rationale}</p>
                  )}

                  {/* Footer row */}
                  <div className="flex items-center justify-between gap-4 pt-0.5">
                    <p className="text-xs text-muted-foreground">
                      Submitted by {personDisplay(cr.requesterId, cr.requesterRole)} · {new Date(cr.submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                    <button type="button" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                      <History className="h-3.5 w-3.5" />
                      History
                    </button>
                  </div>

                  {/* Admin note */}
                  {cr.adminNote && (
                    <p className="text-xs text-muted-foreground italic border-t pt-2">Admin note: {cr.adminNote}</p>
                  )}

                  {/* Admin action buttons */}
                  {isAdmin && cr.status === "Pending" && (
                    <div className="flex gap-2 pt-1 border-t">
                      <Button size="sm" onClick={() => openDecision(cr, "Approved")}>Approve</Button>
                      <Button size="sm" variant="outline" onClick={() => openDecision(cr, "Rejected")}>Decline</Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── New request dialog ───────────────────────────────────────── */}
      <ChangeRequestDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        prefilledCompetencyId={prefilledCompetencyId}
      />

      {/* ── Admin decision dialog ────────────────────────────────────── */}
      <Dialog open={!!decideOn} onOpenChange={(o) => !o && setDecideOn(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {decision === "Approved" ? "Approve" : "Decline"} change request
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-2">
            <Textarea
              placeholder="Optional note for the requester"
              rows={4}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecideOn(null)}>Cancel</Button>
            <Button onClick={commitDecision}>{decision === "Approved" ? "Approve" : "Decline"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
