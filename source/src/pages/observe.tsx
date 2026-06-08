import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/data/auth";
import { useData } from "@/data/store";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectLabel, SelectGroup, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { CompetencyGroup, CompetencyStep, ObservationRating } from "@/data/types";
import {
  CheckCircle2, XCircle, EyeOff, User, Shield, Check, X, ClipboardCheck, ChevronsUpDown,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StepEntry {
  step: CompetencyStep;
  rating: ObservationRating | null;
  notes: string;
}

interface SavedResult {
  count: number;
  personName: string;
  compName: string;
  savedAt: Date;
  personId: string;
  competencyId: string;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function ObservePage() {
  const navigate = useNavigate();
  const { currentLogin } = useAuth();
  const {
    persons, units, steps, competencies, assignments, groups,
    getPersonStage, recordObservation, logAudit,
  } = useData();
  const { state } = useLocation();

  const [personId, setPersonId] = useState<string>(
    (state as { personId?: string } | null)?.personId ?? "",
  );
  const [competencyId, setCompetencyId] = useState<string>(
    (state as { competencyId?: string } | null)?.competencyId ?? "",
  );
  // Pre-select the group that matches the pre-filled competencyId
  const [groupId, setGroupId] = useState<string>(() => {
    const prefillCompId = (state as { competencyId?: string } | null)?.competencyId ?? "";
    if (prefillCompId) {
      return competencies.find((c) => c.id === prefillCompId)?.groupId ?? "";
    }
    return "";
  });
  const [entries, setEntries] = useState<StepEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedResult, setSavedResult] = useState<SavedResult | null>(null);

  // Orientee combobox state
  const [orienteeOpen, setOrienteeOpen] = useState(false);
  const [orienteeQuery, setOrienteeQuery] = useState("");

  const person = persons.find((n) => n.id === personId);
  const selectedComp = competencies.find((c) => c.id === competencyId);
  const personRoleId = person?.roleId ?? "r-rn";

  // Person search: all persons, filtered by query
  const filteredPersons = useMemo(() => {
    const q = orienteeQuery.trim().toLowerCase();
    const sorted = [...persons].sort((a, b) => a.name.localeCompare(b.name));
    if (!q) return sorted.slice(0, 12);
    return sorted.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 20);
  }, [persons, orienteeQuery]);

  // All competency IDs valid for the person's role (any unit, any stage)
  const roleCompetencyIds = useMemo(() => {
    if (!person) return null; // null = no filter applied yet
    return new Set(
      assignments.filter((a) => a.roleId === personRoleId).map((a) => a.competencyId),
    );
  }, [person, personRoleId, assignments]);

  // Group tree: root groups sorted, children filtered to role when known
  const groupTree = useMemo(() => {
    type G = CompetencyGroup & { sortOrder?: number };
    const bySort = (a: G, b: G) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99);
    const hasRoleComp = (gid: string) =>
      competencies.some((c) => c.groupId === gid && (!roleCompetencyIds || roleCompetencyIds.has(c.id)));

    const roots = groups.filter((g) => !g.parentGroupId).sort(bySort) as G[];
    return roots
      .map((root) => {
        const children = (groups.filter((g) => g.parentGroupId === root.id).sort(bySort) as G[])
          .filter((c) => hasRoleComp(c.id));
        const directComps = competencies.filter(
          (c) => c.groupId === root.id && (!roleCompetencyIds || roleCompetencyIds.has(c.id)),
        ).length;
        return { root, children, directComps };
      })
      .filter(({ directComps, children }) => directComps > 0 || children.length > 0);
  }, [groups, competencies, roleCompetencyIds]);

  // Competencies in the selected group, filtered to person's role
  const groupCompetencies = useMemo(() => {
    if (!groupId) return [];
    return competencies
      .filter((c) => c.groupId === groupId && (!roleCompetencyIds || roleCompetencyIds.has(c.id)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [groupId, competencies, roleCompetencyIds]);

  const roleLabel = useMemo(() => {
    if (!person || !roleCompetencyIds) return "";
    return `${roleCompetencyIds.size} competenc${roleCompetencyIds.size === 1 ? "y" : "ies"} for this role`;
  }, [person, roleCompetencyIds]);

  const compSteps = useMemo(
    () => steps.filter((s) => s.competencyId === competencyId).sort((a, b) => a.orderIndex - b.orderIndex),
    [steps, competencyId],
  );

  useEffect(() => {
    setEntries(compSteps.map((s) => ({ step: s, rating: null, notes: "" })));
    setSavedResult(null);
  }, [competencyId, compSteps]);

  function setRating(index: number, rating: ObservationRating) {
    setEntries((prev) => prev.map((e, i) => i === index ? { ...e, rating } : e));
  }

  function setNote(index: number, notes: string) {
    setEntries((prev) => prev.map((e, i) => i === index ? { ...e, notes } : e));
  }

  function markAll(rating: ObservationRating) {
    setEntries((prev) => prev.map((e) => ({ ...e, rating })));
  }

  function clearAll() {
    setEntries((prev) => prev.map((e) => ({ ...e, rating: null, notes: "" })));
  }

  const ratedEntries = entries.filter((e) => e.rating !== null);
  const canSave = !!currentLogin && !!personId && !!competencyId && ratedEntries.length > 0;

  async function handleSave() {
    if (!currentLogin || !canSave) return;
    setSaving(true);
    try {
      const now = new Date();
      const observedAtISO = now.toISOString();
      await Promise.all(
        ratedEntries.map((entry) =>
          recordObservation({
            personId,
            stepId: entry.step.id,
            competencyId,
            observerId: currentLogin.id,
            rating: entry.rating!,
            observedAt: observedAtISO,
            notes: entry.notes.trim() || undefined,
          }),
        ),
      );
      const compName = selectedComp?.name ?? competencyId;
      void logAudit({
        actor: currentLogin.id,
        actorRole: currentLogin.systemRole,
        type: "StepObservationRecorded",
        summary: `Recorded ${ratedEntries.length} observation(s) on "${compName}" for ${person?.name ?? personId}`,
        targetLabel: compName,
      });
      setSavedResult({
        count: ratedEntries.length,
        personName: person?.name ?? personId,
        compName,
        savedAt: now,
        personId,
        competencyId,
      });
      setEntries(compSteps.map((s) => ({ step: s, rating: null, notes: "" })));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 pb-24">

      {/* ── Page header ──────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Record Step Observations</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Rate each step. Submissions become an immutable part of the audit trail.
        </p>
      </div>

      {/* ── Context banner (when both selected) ─────────────────────── */}
      {person && selectedComp && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg border bg-muted/40">
          <div className="flex items-center gap-2 text-sm">
            <User className="h-4 w-4 text-muted-foreground shrink-0" />
            <span>
              Observing: <strong>{person.name}</strong>
              {" · "}
              <strong>{selectedComp.name}</strong>
            </span>
          </div>
          <button
            type="button"
            onClick={() => { setPersonId(""); setCompetencyId(""); setGroupId(""); setOrienteeQuery(""); }}
            className="text-sm text-primary hover:underline shrink-0"
          >
            Change
          </button>
        </div>
      )}

      {/* ── Selection card ───────────────────────────────────────────── */}
      <Card>
        <CardContent className="pt-5 pb-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Learner combobox */}
            <div className="space-y-1.5">
              <Label>Learner</Label>
              <Popover open={orienteeOpen} onOpenChange={setOrienteeOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className={person ? "text-foreground" : "text-muted-foreground"}>
                      {person ? person.name : "Search by name…"}
                    </span>
                    <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Type a name…"
                      value={orienteeQuery}
                      onValueChange={setOrienteeQuery}
                    />
                    <CommandList>
                      <CommandEmpty>No match found.</CommandEmpty>
                      <CommandGroup>
                        {filteredPersons.map((p) => {
                          const u = units.find((u) => u.id === p.unitId);
                          return (
                            <CommandItem
                              key={p.id}
                              value={p.id}
                              onSelect={() => {
                                setPersonId(p.id);
                                setCompetencyId("");
                                setOrienteeOpen(false);
                                setOrienteeQuery("");
                              }}
                            >
                              <div className="flex flex-col min-w-0">
                                <span className="font-medium truncate">{p.name}</span>
                                {u && <span className="text-[11px] text-muted-foreground truncate">{u.name}</span>}
                              </div>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Competency: group picker + competency picker stacked */}
            <div className="space-y-3">
              {/* Group */}
              <div className="space-y-1.5">
                <Label>Category / Group</Label>
                <Select
                  value={groupId}
                  onValueChange={(v) => { setGroupId(v); setCompetencyId(""); }}
                  disabled={!person}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={person ? "Select a category…" : "Select a learner first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {groupTree.map(({ root, children, directComps }) =>
                      directComps > 0 ? (
                        // Root has direct competencies — selectable item
                        <SelectItem key={root.id} value={root.id}>{root.name}</SelectItem>
                      ) : (
                        // Root is a container — non-selectable label + child items
                        <SelectGroup key={root.id}>
                          <SelectLabel>{root.name}</SelectLabel>
                          {children.map((child) => (
                            <SelectItem key={child.id} value={child.id} className="pl-6">
                              {child.name}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Competency */}
              <div className="space-y-1.5">
                <Label>Competency</Label>
                <Select
                  value={competencyId}
                  onValueChange={setCompetencyId}
                  disabled={!groupId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={groupId ? "Select a competency…" : "Select a category first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {groupCompetencies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {person && !groupId && roleLabel && (
                  <p className="text-xs text-muted-foreground">{roleLabel}</p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Observations recorded card ───────────────────────────────── */}
      {savedResult && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-6 py-5 space-y-4">
          <div className="flex items-start gap-3">
            <ClipboardCheck className="h-6 w-6 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-emerald-800">Observations recorded</p>
              <p className="text-sm text-emerald-700 mt-0.5">
                {savedResult.count} step observation{savedResult.count !== 1 ? "s" : ""} added to the audit trail for{" "}
                <strong>{savedResult.personName}</strong> on{" "}
                <strong>{savedResult.compName}</strong> at{" "}
                {savedResult.savedAt.toLocaleString(undefined, {
                  month: "short", day: "numeric", year: "numeric",
                  hour: "numeric", minute: "2-digit",
                })}.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSavedResult(null)}
              className="px-4 py-2 rounded-md border text-sm font-medium hover:bg-emerald-100 transition-colors"
            >
              Record more
            </button>
            <button
              type="button"
              onClick={() => navigate("/sign-off", { state: { personId: savedResult.personId, competencyId: savedResult.competencyId } })}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Go to Sign Off
            </button>
            <button
              type="button"
              onClick={() => navigate(`/competencies/${savedResult.competencyId}`)}
              className="px-4 py-2 rounded-md border text-sm font-medium hover:bg-emerald-100 transition-colors"
            >
              View competency
            </button>
          </div>
        </div>
      )}

      {/* ── Steps card ───────────────────────────────────────────────── */}
      {competencyId && !savedResult && (
        <Card>
          <CardContent className="pt-5 pb-5 space-y-4">

            {/* Steps header */}
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Steps</h2>
              <span className="text-sm text-muted-foreground">
                {ratedEntries.length} of {entries.length} rated
              </span>
            </div>

            {entries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No steps defined for this competency.</p>
            ) : (
              <>
                {/* Bulk actions */}
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground font-medium">Bulk:</span>
                  <button
                    type="button"
                    onClick={() => markAll("Satisfactory")}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-emerald-400 text-emerald-700 text-sm hover:bg-emerald-50 transition-colors"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Mark All Satisfactory
                  </button>
                  <button
                    type="button"
                    onClick={() => markAll("Unsatisfactory")}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border text-sm hover:bg-muted transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                    Mark All Unsatisfactory
                  </button>
                  {ratedEntries.length > 0 && (
                    <button
                      type="button"
                      onClick={clearAll}
                      className="text-sm text-muted-foreground hover:text-foreground"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Step rows */}
                <div className="space-y-3">
                  {entries.map((entry, i) => (
                    <div key={entry.step.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground shrink-0">
                            {i + 1}
                          </span>
                          <p className="text-sm font-medium">{entry.step.name}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {/* Satisfactory */}
                          <button
                            type="button"
                            onClick={() => setRating(i, "Satisfactory")}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm transition-colors ${
                              entry.rating === "Satisfactory"
                                ? "bg-emerald-500 border-emerald-500 text-white"
                                : "border-border text-muted-foreground hover:bg-muted"
                            }`}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Satisfactory
                          </button>
                          {/* Unsatisfactory */}
                          <button
                            type="button"
                            onClick={() => setRating(i, "Unsatisfactory")}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm transition-colors ${
                              entry.rating === "Unsatisfactory"
                                ? "bg-amber-500 border-amber-500 text-white"
                                : "border-border text-muted-foreground hover:bg-muted"
                            }`}
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Unsatisfactory
                          </button>
                          {/* Not Observed */}
                          <button
                            type="button"
                            onClick={() => setRating(i, "NotObserved")}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm transition-colors ${
                              entry.rating === "NotObserved"
                                ? "bg-slate-100 border-slate-400 text-slate-700"
                                : "border-border text-muted-foreground hover:bg-muted"
                            }`}
                          >
                            <EyeOff className="h-3.5 w-3.5" />
                            Not Observed
                          </button>
                        </div>
                      </div>
                      {entry.rating && (
                        <Textarea
                          placeholder="Optional notes for this observation"
                          value={entry.notes}
                          onChange={(e) => setNote(i, e.target.value)}
                          rows={2}
                          className="text-sm"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Sticky save bar ──────────────────────────────────────────── */}
      {canSave && !savedResult && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur">
          <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Shield className="h-4 w-4 shrink-0" />
              Each rated step creates a new immutable observation record; prior records are never changed.
            </div>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="shrink-0 px-6 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving…" : `Save ${ratedEntries.length} observation${ratedEntries.length === 1 ? "" : "s"}`}
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
