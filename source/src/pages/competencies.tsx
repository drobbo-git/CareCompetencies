import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/data/auth";
import { useData } from "@/data/store";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CompetencyAddDialog } from "@/components/forms/CompetencyAddDialog";
import { Plus } from "lucide-react";

export default function CompetenciesPage() {
  const { currentLogin } = useAuth();
  const { competencies, groups, units } = useData();
  const [query, setQuery] = useState("");
  const [groupFilter, setGroupFilter] = useState<string>("all");
  const [unitFilter, setUnitFilter] = useState<string>("all");
  const [showAdd, setShowAdd] = useState(false);

  const groupName = useMemo(() => {
    const m = new Map<string, string>();
    groups.forEach((g) => m.set(g.id, g.name));
    return m;
  }, [groups]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return competencies
      .filter((c) => !q || c.name.toLowerCase().includes(q))
      .filter((c) => groupFilter === "all" || c.groupId === groupFilter)
      .filter((c) => unitFilter === "all" || c.unitIds.includes(unitFilter))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [competencies, query, groupFilter, unitFilter]);

  const isAdmin = currentLogin?.systemRole === "Administrator";

  return (
    <>
      <PageHeader
        title="Catalog"
        description={`${rows.length} of ${competencies.length} competencies`}
        actions={
          isAdmin && (
            <Button onClick={() => setShowAdd(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add competency
            </Button>
          )
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <Input
          type="search"
          placeholder="Search by name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Select value={groupFilter} onValueChange={setGroupFilter}>
          <SelectTrigger><SelectValue placeholder="All groups" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All groups</SelectItem>
            {groups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={unitFilter} onValueChange={setUnitFilter}>
          <SelectTrigger><SelectValue placeholder="All units" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All units</SelectItem>
            {units.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {rows.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">No competencies match the filters.</div>
          )}
          <ul className="divide-y">
            {rows.map((c) => (
              <li key={c.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                <Link to={`/competencies/${c.id}`} className="text-sm font-medium hover:underline truncate min-w-0">
                  {c.name}
                </Link>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {c.groupId ? groupName.get(c.groupId) ?? "—" : "—"} · {c.unitIds.length} unit{c.unitIds.length === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <CompetencyAddDialog open={showAdd} onOpenChange={setShowAdd} />
    </>
  );
}