import { useMemo, useState } from "react";
import { useAuth } from "@/data/auth";
import { useData } from "@/data/store";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ChangeRequestDialog } from "@/components/forms/ChangeRequestDialog";
import type { ChangeRequest } from "@/data/types";

export default function RequestsPage() {
  const { currentLogin } = useAuth();
  const { changeRequests, competencies, decideChangeRequest, logAudit } = useData();
  const [showNew, setShowNew] = useState(false);
  const [decideOn, setDecideOn] = useState<ChangeRequest | null>(null);
  const [decision, setDecision] = useState<"Approved" | "Rejected">("Approved");
  const [note, setNote] = useState("");

  const isAdmin = currentLogin?.systemRole === "Administrator";

  const visible = useMemo(() => {
    if (!currentLogin) return [];
    if (isAdmin) return changeRequests;
    return changeRequests.filter((cr) => cr.requesterId === currentLogin.id);
  }, [changeRequests, currentLogin, isAdmin]);

  const pending = visible.filter((cr) => cr.status === "Pending");
  const decided = visible.filter((cr) => cr.status !== "Pending");

  function openDecision(cr: ChangeRequest, dec: "Approved" | "Rejected") {
    setDecideOn(cr);
    setDecision(dec);
    setNote("");
  }

  function commitDecision() {
    if (!decideOn || !currentLogin) return;
    decideChangeRequest(decideOn.id, decision, note.trim() || undefined);
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

  return (
    <>
      <PageHeader
        title="Change Requests"
        description={isAdmin ? "Triage catalog change requests from Preceptors and Unit Leaders." : "Your submitted catalog change requests."}
        actions={
          !isAdmin && (
            <Button onClick={() => setShowNew(true)}>New request</Button>
          )
        }
      />

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending ({pending.length})</TabsTrigger>
          <TabsTrigger value="decided">Decided ({decided.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <RequestList rows={pending} competencies={competencies} isAdmin={isAdmin} onDecide={openDecision} />
        </TabsContent>
        <TabsContent value="decided">
          <RequestList rows={decided} competencies={competencies} isAdmin={isAdmin} />
        </TabsContent>
      </Tabs>

      <ChangeRequestDialog open={showNew} onOpenChange={setShowNew} />

      <Dialog open={!!decideOn} onOpenChange={(o) => !o && setDecideOn(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {decision === "Approved" ? "Approve" : "Reject"} change request
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
            <Button onClick={commitDecision}>{decision}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function RequestList({
  rows, competencies, isAdmin, onDecide,
}: {
  rows: ChangeRequest[];
  competencies: { id: string; name: string }[];
  isAdmin: boolean;
  onDecide?: (cr: ChangeRequest, dec: "Approved" | "Rejected") => void;
}) {
  const compName = (id?: string) => competencies.find((c) => c.id === id)?.name;
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="px-4 py-8 text-center text-sm text-muted-foreground">
          No requests here.
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardContent className="p-0">
        <ul className="divide-y">
          {rows.map((cr) => (
            <li key={cr.id} className="px-4 py-3 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <Badge variant="outline" className="text-[10px]">{cr.type}</Badge>
                  <Badge
                    variant={cr.status === "Approved" ? "default" : cr.status === "Rejected" ? "destructive" : "secondary"}
                    className="text-[10px]"
                  >
                    {cr.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{cr.requesterRole} · {new Date(cr.submittedAt).toLocaleDateString()}</span>
                </div>
                {cr.competencyId && (
                  <div className="text-sm font-medium truncate">{compName(cr.competencyId) ?? cr.competencyId}</div>
                )}
                {cr.rationale && (
                  <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{cr.rationale}</p>
                )}
                {cr.adminNote && (
                  <p className="text-xs text-muted-foreground mt-1 italic">Admin note: {cr.adminNote}</p>
                )}
              </div>
              {isAdmin && cr.status === "Pending" && onDecide && (
                <div className="flex flex-col gap-1 flex-shrink-0">
                  <Button size="sm" onClick={() => onDecide(cr, "Approved")}>Approve</Button>
                  <Button size="sm" variant="outline" onClick={() => onDecide(cr, "Rejected")}>Reject</Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}