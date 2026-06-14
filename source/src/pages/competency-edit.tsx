import { Fragment, useState, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/data/auth";
import { useData } from "@/data/store";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, ArrowUp, ArrowDown, Trash2, Plus, CheckSquare,
} from "lucide-react";
import type { Competency, CompetencyAssignment, CompetencyStep } from "@/data/types";
import { STAGES } from "@/data/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface StepRow {
  key: string;   // stable React key
  id?: string;   // undefined = newly added (no prior observations)
  name: string;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function CompetencyEditPage() {
  const { id } = useParams<{ id: string }>();
  const { currentLogin } = useAuth();
  const {
    competencies, groups, steps, assignments, units, personRoles,
    upsertCompetency, upsertSteps, upsertAssignment, removeAssignment, logAudit,
  } = useData();
  const navigate = useNavigate();

  const comp = competencies.find((c) => c.id === id);

  if (!comp || currentLogin?.systemRole !== "Administrator") {
    return (
      <div className="space-y-3">
        <Link to="/competencies" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Competency Library
        </Link>
        <p className="text-sm text-muted-foreground">
          {!comp ? "Competency not found." : "Administrator access required."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <Link to={`/competencies/${comp.id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> {comp.name}
      </Link>

      <div>
        <h1 className="text-xl font-semibold tracking-tight">Edit competency</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{comp.name}</p>
      </div>

      <Tabs defaultValue="basic">
        <TabsList className="mb-4">
          <TabsTrigger value="basic">Basic</TabsTrigger>
          <TabsTrigger value="references">References</TabsTrigger>
          <TabsTrigger value="assignments">
            Assignments ({assignments.filter((a) => a.competencyId === comp.id).length})
          </TabsTrigger>
          <TabsTrigger value="steps">
            Steps ({steps.filter((s) => s.competencyId === comp.id).length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="basic">
          <BasicTab comp={comp} groups={groups} upsertCompetency={upsertCompetency} logAudit={logAudit} currentLogin={currentLogin} />
        </TabsContent>

        <TabsContent value="references">
          <ReferencesTab comp={comp} upsertCompetency={upsertCompetency} logAudit={logAudit} currentLogin={currentLogin} />
        </TabsContent>

        <TabsContent value="assignments">
          <AssignmentsTab
            comp={comp}
            assignments={assignments.filter((a) => a.competencyId === comp.id)}
            units={units}
            personRoles={personRoles}
            upsertAssignment={upsertAssignment}
            removeAssignment={removeAssignment}
            logAudit={logAudit}
            currentLogin={currentLogin}
          />
        </TabsContent>

        <TabsContent value="steps">
          <StepsTab
            comp={comp}
            existingSteps={steps.filter((s) => s.competencyId === comp.id).sort((a, b) => a.orderIndex - b.orderIndex)}
            upsertSteps={upsertSteps}
            logAudit={logAudit}
            currentLogin={currentLogin}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Basic tab
// ---------------------------------------------------------------------------
function BasicTab({ comp, groups, upsertCompetency, logAudit, currentLogin }: {
  comp: Competency;
  groups: ReturnType<typeof useData>["groups"];
  upsertCompetency: ReturnType<typeof useData>["upsertCompetency"];
  logAudit: ReturnType<typeof useData>["logAudit"];
  currentLogin: ReturnType<typeof useAuth>["currentLogin"];
}) {
  const [name, setName] = useState(comp.name);
  const [description, setDescription] = useState(comp.description ?? "");
  const [groupId, setGroupId] = useState(comp.groupId ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const orderedGroups = useMemo(
    () => [...groups].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0) || a.name.localeCompare(b.name)),
    [groups],
  );

  const dirty = name !== comp.name || description !== (comp.description ?? "") || groupId !== (comp.groupId ?? "");
  const canSave = name.trim().length > 0 && groupId.length > 0 && dirty;

  async function handleSave() {
    if (!canSave || !currentLogin) return;
    setSaving(true);
    await upsertCompetency({ ...comp, name: name.trim(), description: description.trim() || undefined, groupId });
    logAudit({ actor: currentLogin.id, actorRole: currentLogin.systemRole, type: "CompetencyEdited", summary: `Edited "${name.trim()}" — basic info`, targetLabel: name.trim() });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <Card>
      <CardContent className="pt-5 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="edit-name">Name</Label>
          <Input id="edit-name" value={name} onChange={(e) => { setName(e.target.value); setSaved(false); }} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="edit-desc">Description</Label>
          <Textarea id="edit-desc" rows={4} value={description} onChange={(e) => { setDescription(e.target.value); setSaved(false); }} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="edit-group">Group</Label>
          <Select value={groupId} onValueChange={(v) => { setGroupId(v); setSaved(false); }}>
            <SelectTrigger id="edit-group"><SelectValue placeholder="Select a group" /></SelectTrigger>
            <SelectContent>
              {orderedGroups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Group structure is managed in <Link to="/groups" className="underline">Manage Groups</Link>.</p>
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={handleSave} disabled={!canSave || saving}>
            {saving ? "Saving…" : saved ? "Saved ✓" : "Save changes"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// References tab
// ---------------------------------------------------------------------------
function ReferencesTab({ comp, upsertCompetency, logAudit, currentLogin }: {
  comp: Competency;
  upsertCompetency: ReturnType<typeof useData>["upsertCompetency"];
  logAudit: ReturnType<typeof useData>["logAudit"];
  currentLogin: ReturnType<typeof useAuth>["currentLogin"];
}) {
  const [validationMethod, setValidationMethod] = useState(comp.validationMethod ?? "");
  const [knowledgeSource, setKnowledgeSource]   = useState(comp.knowledgeSource ?? "");
  const [policySource, setPolicySource]         = useState(comp.policySource ?? "");
  const [updateNote, setUpdateNote]             = useState(comp.updateNote ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);

  const dirty =
    validationMethod !== (comp.validationMethod ?? "") ||
    knowledgeSource  !== (comp.knowledgeSource  ?? "") ||
    policySource     !== (comp.policySource     ?? "") ||
    updateNote       !== (comp.updateNote       ?? "");

  async function handleSave() {
    if (!currentLogin) return;
    setSaving(true);
    await upsertCompetency({
      ...comp,
      validationMethod: validationMethod.trim() || undefined,
      knowledgeSource:  knowledgeSource.trim()  || undefined,
      policySource:     policySource.trim()     || undefined,
      updateNote:       updateNote.trim()        || undefined,
    });
    logAudit({ actor: currentLogin.id, actorRole: currentLogin.systemRole, type: "CompetencyEdited", summary: `Edited "${comp.name}" — references`, targetLabel: comp.name });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <Card>
      <CardContent className="pt-5 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="ref-vm">Validation Method <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <Textarea id="ref-vm" rows={2} placeholder="e.g. Validated by Observation of Behavior" value={validationMethod} onChange={(e) => { setValidationMethod(e.target.value); setSaved(false); }} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ref-ks">Knowledge Source <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <Input id="ref-ks" placeholder="https://… link to PDF, video, or other learning resource" value={knowledgeSource} onChange={(e) => { setKnowledgeSource(e.target.value); setSaved(false); }} />
          <p className="text-xs text-muted-foreground">Link to a PDF, video, or resource with tips and help.</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ref-ps">Policy Source <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <Input id="ref-ps" placeholder="https://dukeuniversity.policytech.com/…" value={policySource} onChange={(e) => { setPolicySource(e.target.value); setSaved(false); }} />
          <p className="text-xs text-muted-foreground">Typically a link to a DUHS PolicyTech policy.</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ref-un">Update Note <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <Input id="ref-un" placeholder="e.g. Word Document updated 4/2017" value={updateNote} onChange={(e) => { setUpdateNote(e.target.value); setSaved(false); }} />
          <p className="text-xs text-muted-foreground">A short note describing when and why the content was last updated.</p>
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={handleSave} disabled={!dirty || saving}>
            {saving ? "Saving…" : saved ? "Saved ✓" : "Save changes"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Assignments tab
// ---------------------------------------------------------------------------
function AssignmentsTab({ comp, assignments, units, personRoles, upsertAssignment, removeAssignment, logAudit, currentLogin }: {
  comp: Competency;
  assignments: CompetencyAssignment[];
  units: ReturnType<typeof useData>["units"];
  personRoles: ReturnType<typeof useData>["personRoles"];
  upsertAssignment: ReturnType<typeof useData>["upsertAssignment"];
  removeAssignment: ReturnType<typeof useData>["removeAssignment"];
  logAudit: ReturnType<typeof useData>["logAudit"];
  currentLogin: ReturnType<typeof useAuth>["currentLogin"];
}) {
  const [showBatchForm, setShowBatchForm]   = useState(false);
  const [batchRoleIds, setBatchRoleIds]     = useState<Set<string>>(new Set());
  const [batchStage, setBatchStage]         = useState("");
  const [batchUnitIds, setBatchUnitIds]     = useState<Set<string>>(new Set());
  const [batchFilter, setBatchFilter]       = useState("");
  const [adding, setAdding]                 = useState(false);

  const sortedUnits = useMemo(() => [...units].sort((a, b) => a.name.localeCompare(b.name)), [units]);
  const sortedRoles = useMemo(() => [...personRoles].sort((a, b) => a.name.localeCompare(b.name)), [personRoles]);
  const filteredUnits = useMemo(() => {
    const q = batchFilter.trim().toLowerCase();
    return q ? sortedUnits.filter((u) => u.name.toLowerCase().includes(q)) : sortedUnits;
  }, [sortedUnits, batchFilter]);

  const existingKeys = useMemo(() => new Set(assignments.map((a) => `${a.unitId}|${a.roleId}|${a.stage}`)), [assignments]);

  function toggleBatchUnit(id: string) {
    setBatchUnitIds((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }
  function toggleAllFiltered(on: boolean) {
    setBatchUnitIds((prev) => {
      const next = new Set(prev);
      filteredUnits.forEach((u) => on ? next.add(u.id) : next.delete(u.id));
      return next;
    });
  }

  const allFilteredSelected = filteredUnits.length > 0 && filteredUnits.every((u) => batchUnitIds.has(u.id));

  function toggleBatchRole(id: string) {
    setBatchRoleIds((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }

  // Total new assignments that would be created (skipping existing combos)
  const batchAddCount = useMemo(() => {
    let n = 0;
    for (const rid of batchRoleIds) for (const uid of batchUnitIds) {
      if (!existingKeys.has(`${uid}|${rid}|${batchStage}`)) n++;
    }
    return n;
  }, [batchRoleIds, batchUnitIds, batchStage, existingKeys]);

  async function handleBatchAdd() {
    if (batchRoleIds.size === 0 || !batchStage || batchUnitIds.size === 0 || !currentLogin) return;
    setAdding(true);
    let added = 0;
    for (const rid of batchRoleIds) {
      for (const uid of batchUnitIds) {
        if (existingKeys.has(`${uid}|${rid}|${batchStage}`)) continue;
        const newId = `as-${Math.random().toString(36).slice(2, 10)}`;
        await upsertAssignment({ id: newId, competencyId: comp.id, unitId: uid, roleId: rid, stage: batchStage as CompetencyAssignment["stage"] });
        added++;
      }
    }
    if (added > 0) {
      const roleLabels = [...batchRoleIds].map((rid) => personRoles.find((r) => r.id === rid)?.name ?? rid).join(", ");
      logAudit({ actor: currentLogin.id, actorRole: currentLogin.systemRole, type: "AssignmentAdded", summary: `Added ${added} assignment(s) for "${comp.name}" — ${roleLabels} / ${batchStage}`, targetLabel: comp.name });
    }
    setAdding(false);
    setShowBatchForm(false);
    setBatchRoleIds(new Set()); setBatchStage(""); setBatchUnitIds(new Set()); setBatchFilter("");
  }

  async function handleRemove(a: CompetencyAssignment) {
    if (!currentLogin) return;
    await removeAssignment(a.id);
    const unitName = units.find((u) => u.id === a.unitId)?.name ?? a.unitId;
    const roleName = personRoles.find((r) => r.id === a.roleId)?.name ?? a.roleId;
    logAudit({ actor: currentLogin.id, actorRole: currentLogin.systemRole, type: "AssignmentRemoved", summary: `Removed assignment "${comp.name}" from ${unitName} / ${roleName} / ${a.stage}`, targetLabel: comp.name });
  }

  return (
    <Card>
      <CardContent className="pt-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Each row = one unit + role + stage that requires this competency.</p>
          {!showBatchForm && (
            <Button size="sm" onClick={() => setShowBatchForm(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add assignment
            </Button>
          )}
        </div>

        {/* Batch add form */}
        {showBatchForm && (
          <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
            <p className="text-sm font-medium">New assignment</p>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Role</Label>
                <div className="border rounded-md bg-background divide-y">
                  {sortedRoles.map((r) => (
                    <label key={r.id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-muted/40">
                      <Checkbox checked={batchRoleIds.has(r.id)} onCheckedChange={() => toggleBatchRole(r.id)} />
                      <span>{r.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Stage</Label>
                <Select value={batchStage} onValueChange={setBatchStage}>
                  <SelectTrigger><SelectValue placeholder="Select stage" /></SelectTrigger>
                  <SelectContent>
                    {STAGES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Units ({batchUnitIds.size} selected)</Label>
              <Input
                placeholder="Filter units…"
                value={batchFilter}
                onChange={(e) => setBatchFilter(e.target.value)}
                className="mb-1"
              />
              <div className="border rounded-md bg-background max-h-52 overflow-y-auto">
                {/* Select all */}
                <label className="flex items-center gap-2 px-3 py-2 border-b text-sm cursor-pointer hover:bg-muted/40 font-medium">
                  <Checkbox
                    checked={allFilteredSelected}
                    onCheckedChange={(v) => toggleAllFiltered(!!v)}
                  />
                  <CheckSquare className="h-3.5 w-3.5 text-muted-foreground" />
                  Select all{batchFilter ? " matching" : ""}
                </label>
                {filteredUnits.map((u) => (
                  <label key={u.id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-muted/40 border-b last:border-0">
                    <Checkbox checked={batchUnitIds.has(u.id)} onCheckedChange={() => toggleBatchUnit(u.id)} />
                    <span>{u.name}</span>
                    {batchRoleIds.size > 0 && batchStage && [...batchRoleIds].every((rid) => existingKeys.has(`${u.id}|${rid}|${batchStage}`)) && (
                      <span className="ml-auto text-[10px] text-muted-foreground italic">already assigned</span>
                    )}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => { setShowBatchForm(false); setBatchRoleIds(new Set()); setBatchStage(""); setBatchUnitIds(new Set()); setBatchFilter(""); }}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleBatchAdd} disabled={batchRoleIds.size === 0 || !batchStage || batchUnitIds.size === 0 || batchAddCount === 0 || adding}>
                {adding ? "Adding…" : `Add${batchAddCount > 0 ? ` (${batchAddCount})` : ""}`}
              </Button>
            </div>
          </div>
        )}

        {/* Assignment table */}
        {assignments.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No assignments yet.</p>
        ) : (
          <div className="border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">Unit</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">Role</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">Stage</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {[...assignments].sort((a, b) => {
                  const ua = units.find((u) => u.id === a.unitId)?.name ?? "";
                  const ub = units.find((u) => u.id === b.unitId)?.name ?? "";
                  return ua.localeCompare(ub) || STAGES.indexOf(a.stage) - STAGES.indexOf(b.stage);
                }).map((a) => (
                  <tr key={a.id} className="hover:bg-muted/20">
                    <td className="px-3 py-2">{units.find((u) => u.id === a.unitId)?.name ?? a.unitId}</td>
                    <td className="px-3 py-2">{personRoles.find((r) => r.id === a.roleId)?.name ?? a.roleId}</td>
                    <td className="px-3 py-2">{a.stage}</td>
                    <td className="px-3 py-2 text-right">
                      <button type="button" onClick={() => handleRemove(a)} className="text-muted-foreground hover:text-destructive transition-colors" title="Remove">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Steps tab
// ---------------------------------------------------------------------------
function StepsTab({ comp, existingSteps, upsertSteps, logAudit, currentLogin }: {
  comp: Competency;
  existingSteps: CompetencyStep[];
  upsertSteps: ReturnType<typeof useData>["upsertSteps"];
  logAudit: ReturnType<typeof useData>["logAudit"];
  currentLogin: ReturnType<typeof useAuth>["currentLogin"];
}) {
  const [rows, setRows] = useState<StepRow[]>(() =>
    existingSteps.map((s) => ({ key: s.id, id: s.id, name: s.name })),
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);

  function newKey() { return `new-${Math.random().toString(36).slice(2, 10)}`; }

  function updateName(key: string, value: string) {
    setRows((prev) => prev.map((r) => r.key === key ? { ...r, name: value } : r));
    setSaved(false);
  }

  function moveUp(i: number) {
    if (i === 0) return;
    setRows((prev) => { const next = [...prev]; [next[i - 1], next[i]] = [next[i], next[i - 1]]; return next; });
    setSaved(false);
  }

  function moveDown(i: number) {
    setRows((prev) => {
      if (i >= prev.length - 1) return prev;
      const next = [...prev]; [next[i], next[i + 1]] = [next[i + 1], next[i]]; return next;
    });
    setSaved(false);
  }

  function insertAfter(i: number) {
    setRows((prev) => {
      const next = [...prev];
      next.splice(i + 1, 0, { key: newKey(), name: "" });
      return next;
    });
    setSaved(false);
  }

  function addAtEnd() {
    setRows((prev) => [...prev, { key: newKey(), name: "" }]);
    setSaved(false);
  }

  function remove(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key));
    setSaved(false);
  }

  async function handleSave() {
    if (!currentLogin) return;
    setSaving(true);
    const validRows = rows.filter((r) => r.name.trim().length > 0);
    const steps: CompetencyStep[] = validRows.map((r, i) => ({
      id: r.id ?? `step-${Math.random().toString(36).slice(2, 10)}`,
      competencyId: comp.id,
      name: r.name.trim(),
      orderIndex: i + 1,
    }));
    await upsertSteps(comp.id, steps);
    logAudit({ actor: currentLogin.id, actorRole: currentLogin.systemRole, type: "CompetencyEdited", summary: `Edited "${comp.name}" — steps (${steps.length} total)`, targetLabel: comp.name });
    // Refresh keys so saved IDs are preserved
    setRows(steps.map((s) => ({ key: s.id, id: s.id, name: s.name })));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <Card>
      <CardContent className="pt-5 space-y-2">
        <p className="text-xs text-muted-foreground mb-3">
          Empty rows are ignored on save. Reordering preserves the step ID → observation link where possible.
        </p>

        {rows.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">No steps yet. Add one below.</p>
        )}

        {rows.map((row, i) => (
          <Fragment key={row.key}>
            <div className="flex items-center gap-2">
              <span className="w-6 text-center text-xs text-muted-foreground tabular-nums shrink-0">{i + 1}</span>
              <Input
                value={row.name}
                onChange={(e) => updateName(row.key, e.target.value)}
                placeholder={`Step ${i + 1}`}
                className="flex-1"
              />
              <div className="flex gap-0.5 shrink-0">
                <button type="button" onClick={() => moveUp(i)} disabled={i === 0} title="Move up"
                  className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors">
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => moveDown(i)} disabled={i === rows.length - 1} title="Move down"
                  className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors">
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => remove(row.key)} title="Remove step"
                  className="p-1 rounded text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            {/* Insert between rows */}
            <button
              type="button"
              onClick={() => insertAfter(i)}
              className="w-full flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors py-0.5 px-8 group"
              title="Insert step here"
            >
              <span className="flex-1 h-px bg-border group-hover:bg-primary/30 transition-colors" />
              <Plus className="h-3 w-3" />
              <span className="flex-1 h-px bg-border group-hover:bg-primary/30 transition-colors" />
            </button>
          </Fragment>
        ))}

        <div className="flex items-center justify-between pt-2 gap-2">
          <Button variant="outline" size="sm" onClick={addAtEnd}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add step
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : saved ? "Saved ✓" : "Save steps"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
