import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/data/auth";
import { useData } from "@/data/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectLabel, SelectGroup, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { StageBadge } from "@/components/common/StageBadge";
import { CompetencyAddDialog } from "@/components/forms/CompetencyAddDialog";
import { STAGES, type Stage } from "@/data/types";
import type { CompetencyGroup } from "@/data/types";
import { Plus, ChevronRight } from "lucide-react";

export default function CompetenciesPage() {
  const { currentLogin } = useAuth();
  const { competencies, groups, units, assignments } = useData();
  const [query, setQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [unitFilter, setUnitFilter] = useState<string>("all");
  const [showAdd, setShowAdd] = useState(false);

  // Group tree for hierarchical dropdown
  const groupTree = useMemo(() => {
    type G = CompetencyGroup & { sortOrder?: number };
    const bySort = (a: G, b: G) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99);
    const roots = (groups.filter((g) => !g.parentGroupId) as G[]).sort(bySort);
    return roots.map((root) => ({
      root,
      children: (groups.filter((g) => g.parentGroupId === root.id) as G[]).sort(bySort),
      directComps: competencies.filter((c) => c.groupId === root.id).length,
    }));
  }, [groups, competencies]);

  // Assignments indexed by competency → stages at filtered unit
  const assignmentsByComp = useMemo(() => {
    const map = new Map<string, { stage: Stage; roleId: string }[]>();
    const filtered = unitFilter === "all"
      ? assignments
      : assignments.filter((a) => a.unitId === unitFilter);
    for (const a of filtered) {
      if (!map.has(a.competencyId)) map.set(a.competencyId, []);
      map.get(a.competencyId)!.push({ stage: a.stage as Stage, roleId: a.roleId });
    }
    return map;
  }, [assignments, unitFilter]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    // Determine which group IDs are "selected" (a root may cover its children)
    const selectedGroupIds = new Set<string>();
    if (groupFilter !== "all") {
      selectedGroupIds.add(groupFilter);
      // Also match children if a root was selected
      groups.filter((g) => g.parentGroupId === groupFilter).forEach((g) => selectedGroupIds.add(g.id));
    }

    return competencies
      .filter((c) => !q || c.name.toLowerCase().includes(q))
      .filter((c) => groupFilter === "all" || (c.groupId && selectedGroupIds.has(c.groupId)))
      .filter((c) => unitFilter === "all" || assignmentsByComp.has(c.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [competencies, query, groupFilter, unitFilter, groups, assignmentsByComp]);

  const groupName = useMemo(() => {
    const m = new Map<string, string>();
    groups.forEach((g) => m.set(g.id, g.name));
    return m;
  }, [groups]);

  const isAdmin = currentLogin?.systemRole === "Administrator";

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Search Competencies</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {rows.length} of {competencies.length} competencies
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add competency
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <Input
          type="search"
          placeholder="Search by name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        {/* Group hierarchy dropdown */}
        <Select value={groupFilter} onValueChange={setGroupFilter}>
          <SelectTrigger><SelectValue placeholder="All groups" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All groups</SelectItem>
            {groupTree.map(({ root, children, directComps }) =>
              directComps > 0 ? (
                <SelectItem key={root.id} value={root.id}>{root.name}</SelectItem>
              ) : (
                <SelectGroup key={root.id}>
                  <SelectLabel>{root.name}</SelectLabel>
                  {children.map((child) => (
                    <SelectItem key={child.id} value={child.id} className="pl-6">{child.name}</SelectItem>
                  ))}
                </SelectGroup>
              )
            )}
          </SelectContent>
        </Select>

        <Select value={unitFilter} onValueChange={setUnitFilter}>
          <SelectTrigger><SelectValue placeholder="All units" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All units</SelectItem>
            {[...units].sort((a, b) => a.name.localeCompare(b.name)).map((u) => (
              <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Results */}
      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No competencies match the filters.
            </div>
          ) : (
            <ul className="divide-y">
              {rows.map((c) => {
                const stages = assignmentsByComp.get(c.id);
                const uniqueStages = stages
                  ? [...new Set(stages.map((s) => s.stage))].sort(
                      (a, b) => STAGES.indexOf(a) - STAGES.indexOf(b),
                    )
                  : [];
                return (
                  <li key={c.id} className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors">
                    <div className="min-w-0">
                      <Link
                        to={`/competencies/${c.id}`}
                        className="text-sm font-medium hover:underline truncate block"
                      >
                        {c.name}
                      </Link>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {c.groupId ? groupName.get(c.groupId) ?? "—" : "—"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {uniqueStages.map((s) => <StageBadge key={s} stage={s} size="sm" />)}
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <CompetencyAddDialog open={showAdd} onOpenChange={setShowAdd} />
    </>
  );
}
