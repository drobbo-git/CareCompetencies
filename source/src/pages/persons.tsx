import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/data/auth";
import { useData } from "@/data/store";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StageBadge } from "@/components/common/StageBadge";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import type { StageOrFully } from "@/data/types";

type SortKey = "name" | "stage" | "progress" | "startDate";
type SortDir = "asc" | "desc";

interface RosterRow {
  id: string;
  name: string;
  stage: StageOrFully;
  achieved: number;
  total: number;
  pct: number;
  startDate: string;
}

const STAGE_RANK: Record<StageOrFully, number> = {
  Core: 0,
  Orientation: 1,
  Education: 2,
  FullyOriented: 3,
  Nonclinical: 4,
};

/**
 * Unit Leader–scoped roster of nurses on their unit.
 * Default sort flips to ASC (least progress at top) per the May tweak round.
 */
export default function PersonsPage() {
  const { currentLogin } = useAuth();
  const { persons, assignments, achievements, units, getPersonStage } = useData();

  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("progress");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const homeUnit = currentLogin?.unitIds?.[0] ? units.find((u) => u.id === currentLogin.unitIds![0]) : undefined;

  const rows: RosterRow[] = useMemo(() => {
    if (!currentLogin) return [];
    const scoped = currentLogin.unitIds?.length
      ? persons.filter((n) => currentLogin.unitIds!.includes(n.unitId))
      : persons;
    return scoped.map((n) => {
      const roleId = n.roleId ?? "r-rn";
      const total = assignments.filter((a) => a.unitId === n.unitId && a.roleId === roleId).length;
      const achieved = achievements.filter((a) => a.personId === n.id).length;
      const pct = total === 0 ? 0 : Math.round((achieved / total) * 100);
      return {
        id: n.id,
        name: n.name,
        stage: getPersonStage(n.id),
        achieved,
        total,
        pct,
        startDate: n.startDate,
      };
    });
  }, [currentLogin, persons, assignments, achievements, getPersonStage]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? rows.filter((r) => r.name.toLowerCase().includes(q)) : rows;
  }, [rows, query]);

  const sorted = useMemo(() => {
    const arr = filtered.slice();
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") cmp = a.name.localeCompare(b.name);
      else if (sortKey === "stage") cmp = STAGE_RANK[a.stage] - STAGE_RANK[b.stage];
      else if (sortKey === "progress") cmp = a.pct - b.pct;
      else if (sortKey === "startDate") cmp = a.startDate.localeCompare(b.startDate);
      if (cmp === 0) cmp = a.name.localeCompare(b.name);
      return cmp * dir;
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  if (currentLogin?.systemRole !== "UnitLeader") {
    return <p className="text-sm text-muted-foreground">Unit Leader access required.</p>;
  }

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      // Switching column always flips to desc by default — except progress, which stays asc.
      setSortDir(key === "progress" ? "asc" : "desc");
    }
  }

  return (
    <>
      <PageHeader
        title="Unit Roster"
        description={homeUnit ? `${homeUnit.name} · ${rows.length} persons` : `${rows.length} persons`}
      />

      <div className="mb-4 max-w-md">
        <Input
          type="search"
          placeholder="Search by name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b">
              <tr>
                <SortHeader label="Name"     sortKey="name"      cur={sortKey} dir={sortDir} onClick={toggleSort} />
                <SortHeader label="Stage"    sortKey="stage"     cur={sortKey} dir={sortDir} onClick={toggleSort} />
                <SortHeader label="Progress" sortKey="progress"  cur={sortKey} dir={sortDir} onClick={toggleSort} align="right" />
                <SortHeader label="Started"  sortKey="startDate" cur={sortKey} dir={sortDir} onClick={toggleSort} />
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.id} className="border-b hover:bg-muted/30">
                  <td className="px-4 py-2">
                    <Link to={`/persons/${r.id}`} className="hover:underline font-medium">
                      {r.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2"><StageBadge stage={r.stage} size="sm" /></td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <div className="w-32 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${r.pct}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground tabular-nums w-20 text-right">
                        {r.achieved} / {r.total} ({r.pct}%)
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground tabular-nums">
                    {r.startDate}
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No persons match the filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </>
  );
}

function SortHeader({
  label, sortKey, cur, dir, onClick, align,
}: {
  label: string;
  sortKey: SortKey;
  cur: SortKey;
  dir: SortDir;
  onClick: (k: SortKey) => void;
  align?: "left" | "right";
}) {
  const Icon = cur !== sortKey ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th className={`px-4 py-2 text-${align ?? "left"} font-medium text-xs uppercase tracking-wider text-muted-foreground`}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onClick(sortKey)}
        className="-mx-2 inline-flex items-center gap-1 h-auto py-1"
      >
        {label}
        <Icon className="h-3 w-3" />
      </Button>
    </th>
  );
}