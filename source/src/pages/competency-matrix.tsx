import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/data/auth";
import { useData } from "@/data/store";
import { Card, CardContent } from "@/components/ui/card";
import { Check } from "lucide-react";
import { STAGES, type Stage, type StageOrFully } from "@/data/types";

// ---------------------------------------------------------------------------
// Cell icon components
// ---------------------------------------------------------------------------
function CellAchieved() {
  return (
    <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center mx-auto">
      <Check className="h-3 w-3 text-white stroke-[3]" />
    </div>
  );
}

function CellInProgress() {
  return (
    <div className="w-5 h-5 rounded-full border-2 border-amber-400 bg-amber-50 mx-auto" />
  );
}

function CellNotStarted() {
  return (
    <div className="w-5 h-5 rounded-full mx-auto"
      style={{ border: "2px dashed #cbd5e1" }} />
  );
}

function CellNotRequired() {
  return <span className="text-muted-foreground/40 text-xs">—</span>;
}

// ---------------------------------------------------------------------------
// Stage styling
// ---------------------------------------------------------------------------
const STAGE_HEADER_BG: Record<StageOrFully, string> = {
  Core:          "bg-red-50 text-red-800 border-red-200",
  Orientation:   "bg-amber-50 text-amber-900 border-amber-200",
  Education:     "bg-blue-50 text-blue-800 border-blue-200",
  FullyOriented: "bg-green-50 text-green-800 border-green-200",
  Nonclinical:   "bg-zinc-50 text-zinc-700 border-zinc-200",
};

const STAGE_RANK: Record<StageOrFully, number> = {
  Core: 0, Orientation: 1, Education: 2, FullyOriented: 3, Nonclinical: 4,
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function CompetencyMatrixPage() {
  const { currentLogin } = useAuth();
  const {
    persons, units, competencies, groups, assignments, achievements, observations,
    getPersonStage,
  } = useData();

  const unitId = currentLogin?.unitIds?.[0];
  const unit = unitId ? units.find((u) => u.id === unitId) : undefined;

  // ── Columns (all persons on unit, sorted by stage then name) ─────────────
  const columns = useMemo(() => {
    if (!unitId) return [];
    return persons
      .filter((n) => n.unitId === unitId)
      .map((n) => ({ person: n, stage: getPersonStage(n.id) }))
      .sort((a, b) => {
        const r = STAGE_RANK[a.stage] - STAGE_RANK[b.stage];
        return r !== 0 ? r : a.person.name.localeCompare(b.person.name);
      });
  }, [persons, unitId, getPersonStage]);

  // Group consecutive columns by stage for the top header band
  const columnStageGroups = useMemo(() => {
    const out: { stage: StageOrFully; span: number }[] = [];
    for (const c of columns) {
      const last = out[out.length - 1];
      if (last && last.stage === c.stage) last.span += 1;
      else out.push({ stage: c.stage, span: 1 });
    }
    return out;
  }, [columns]);

  // ── Row bands (competencies grouped by stage band then group label) ───────
  const groupName = useMemo(() => {
    const m = new Map<string, string>();
    groups.forEach((g) => m.set(g.id, g.name));
    return m;
  }, [groups]);

  interface RowBand {
    stage: Stage;
    groups: { label: string; competencyIds: string[] }[];
    flatCount: number;
  }

  const rowBands: RowBand[] = useMemo(() => {
    if (!unitId) return [];
    const unitAssignments = assignments.filter((a) => a.unitId === unitId);
    const compStage = new Map<string, Stage>();
    for (const a of unitAssignments) {
      const cur = compStage.get(a.competencyId);
      if (!cur || STAGES.indexOf(a.stage) < STAGES.indexOf(cur)) {
        compStage.set(a.competencyId, a.stage);
      }
    }
    return STAGES.map((stage) => {
      const compIds = competencies
        .filter((c) => compStage.get(c.id) === stage)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((c) => c.id);

      const grouped = new Map<string, string[]>();
      for (const cid of compIds) {
        const c = competencies.find((x) => x.id === cid)!;
        const label = c.groupId ? groupName.get(c.groupId) ?? "Ungrouped" : "Ungrouped";
        const list = grouped.get(label) ?? [];
        list.push(cid);
        grouped.set(label, list);
      }
      const groupedSorted = Array.from(grouped.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([label, ids]) => ({ label, competencyIds: ids }));

      return { stage, groups: groupedSorted, flatCount: groupedSorted.reduce((s, g) => s + g.competencyIds.length, 0) };
    }).filter((b) => b.flatCount > 0);
  }, [unitId, assignments, competencies, groupName]);

  // ── Cell status sets ──────────────────────────────────────────────────────
  const achievedSet = useMemo(() => {
    const s = new Set<string>();
    achievements.forEach((a) => s.add(`${a.personId}|${a.competencyId}`));
    return s;
  }, [achievements]);

  const inProgressSet = useMemo(() => {
    const s = new Set<string>();
    observations.forEach((o) => s.add(`${o.personId}|${o.competencyId}`));
    return s;
  }, [observations]);

  const requiredSet = useMemo(() => {
    const s = new Set<string>();
    const personRole = new Map<string, string>();
    for (const n of persons) personRole.set(n.id, n.roleId ?? "r-rn");
    for (const a of assignments) {
      if (a.unitId !== unitId) continue;
      for (const c of columns) {
        if (personRole.get(c.person.id) === a.roleId) {
          s.add(`${c.person.id}|${a.competencyId}`);
        }
      }
    }
    return s;
  }, [assignments, persons, columns, unitId]);

  // ── KPI calculations ──────────────────────────────────────────────────────
  const kpi = useMemo(() => {
    const unitCompIds = new Set(
      assignments.filter((a) => a.unitId === unitId).map((a) => a.competencyId),
    );
    const totalSlots = requiredSet.size;
    const achievedSlots = [...requiredSet].filter((k) => achievedSet.has(k)).length;
    const pct = totalSlots === 0 ? 0 : Math.round((achievedSlots / totalSlots) * 100);

    const stageCounts: Record<Stage, number> = { Core: 0, Orientation: 0, Education: 0 };
    for (const c of columns) {
      if (c.stage === "Core" || c.stage === "Orientation" || c.stage === "Education") {
        stageCounts[c.stage as Stage]++;
      }
    }
    return { nurses: columns.length, competencies: unitCompIds.size, pct, stageCounts };
  }, [columns, assignments, unitId, requiredSet, achievedSet]);

  // ── Guard ─────────────────────────────────────────────────────────────────
  if (currentLogin?.systemRole !== "UnitLeader") {
    return <p className="text-sm text-muted-foreground">Unit Leader access required.</p>;
  }

  function cellNode(personId: string, competencyId: string) {
    const k = `${personId}|${competencyId}`;
    if (!requiredSet.has(k)) return <CellNotRequired />;
    if (achievedSet.has(k))  return <CellAchieved />;
    if (inProgressSet.has(k)) return <CellInProgress />;
    return <CellNotStarted />;
  }

  return (
    <div className="space-y-4">

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Competency Matrix</h1>
          <p className="text-sm text-muted-foreground mt-0.5 max-w-2xl">
            Competency achievement across all clinical staff on {unit?.name ?? "your unit"}. Rows are unit-required competencies grouped by stage; columns are staff grouped by stage.
          </p>
        </div>
        {unit && (
          <span className="shrink-0 text-xs px-3 py-1.5 rounded-full border font-medium text-muted-foreground">
            {unit.name}
          </span>
        )}
      </div>

      {/* ── KPI row ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Nurses</p>
            <p className="text-3xl font-semibold tabular-nums mt-0.5">{kpi.nurses}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Competencies</p>
            <p className="text-3xl font-semibold tabular-nums mt-0.5">{kpi.competencies}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">% Achieved</p>
            <p className="text-3xl font-semibold tabular-nums mt-0.5">{kpi.pct}%</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">across required slots</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Active Learners</p>
            <div className="mt-1 space-y-0.5">
              {STAGES.map((s) => (
                <div key={s} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{s}</span>
                  <span className="font-medium tabular-nums">{kpi.stageCounts[s]}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Legend ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-5 text-xs text-muted-foreground flex-wrap">
        <span className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center shrink-0">
            <Check className="h-2.5 w-2.5 text-white stroke-[3]" />
          </div>
          Achieved
        </span>
        <span className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-full border-2 border-amber-400 bg-amber-50 shrink-0" />
          In progress
        </span>
        <span className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-full shrink-0" style={{ border: "2px dashed #cbd5e1" }} />
          Not started
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-muted-foreground/40 font-medium">—</span>
          Not required for role
        </span>
      </div>

      {/* ── Matrix table ─────────────────────────────────────────────── */}
      <Card>
        <CardContent className="p-0 overflow-auto max-h-[72vh]">
          <table className="text-xs border-collapse">
            <thead>
              {/* Stage band grouper row */}
              <tr>
                <th className="sticky top-0 left-0 z-30 bg-card border-r border-b" colSpan={3} style={{ minWidth: 360 }} />
                {columnStageGroups.map((g, i) => (
                  <th
                    key={i}
                    colSpan={g.span}
                    className={`sticky top-0 z-20 bg-card border-b border-r text-center font-semibold uppercase tracking-wider text-[10px] py-1 ${STAGE_HEADER_BG[g.stage]}`}
                  >
                    {g.stage === "FullyOriented" ? "Fully Oriented" : g.stage}
                  </th>
                ))}
              </tr>
              {/* Rotated person name row */}
              <tr>
                <th className="sticky left-0 z-20 bg-card border-r border-b" style={{ top: 26, minWidth: 48 }} />
                <th className="sticky z-20 bg-card border-r border-b" style={{ top: 26, minWidth: 140 }} />
                <th className="sticky z-20 bg-card border-r border-b" style={{ top: 26, minWidth: 220 }}>
                  <div className="text-left px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                    Competency
                  </div>
                </th>
                {columns.map((c) => (
                  <th
                    key={c.person.id}
                    className="sticky z-10 bg-card border-r border-b"
                    style={{ top: 26, width: 44, minWidth: 44 }}
                    title={c.person.name}
                  >
                    <div
                      className="px-1 py-2 text-left text-[11px] font-medium"
                      style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", height: 140 }}
                    >
                      {c.person.name}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rowBands.flatMap((band) => {
                let firstRowOfBand = true;
                const stageBg = STAGE_HEADER_BG[band.stage];
                return band.groups.flatMap((grp) => {
                  let firstRowOfGroup = true;
                  return grp.competencyIds.map((cid) => {
                    const c = competencies.find((x) => x.id === cid)!;
                    const tr = (
                      <tr key={cid} className="border-b hover:bg-muted/20">
                        {firstRowOfBand && (
                          <td
                            rowSpan={band.flatCount}
                            className={`sticky left-0 z-10 border-r ${stageBg} text-center font-semibold uppercase tracking-wider text-[10px] align-top`}
                            style={{ minWidth: 48 }}
                          >
                            <div className="py-2 px-1" style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}>
                              {band.stage}
                            </div>
                          </td>
                        )}
                        {firstRowOfGroup && (
                          <td
                            rowSpan={grp.competencyIds.length}
                            className="sticky z-10 bg-card border-r text-[11px] text-muted-foreground align-top"
                            style={{ left: 48, minWidth: 140 }}
                          >
                            <div className="px-2 py-2">{grp.label}</div>
                          </td>
                        )}
                        <td
                          className="sticky z-10 bg-card border-r"
                          style={{ left: 188, minWidth: 220 }}
                        >
                          <Link to={`/competencies/${c.id}`} className="block px-2 py-1.5 hover:underline truncate">
                            {c.name}
                          </Link>
                        </td>
                        {columns.map((col) => (
                          <td
                            key={col.person.id}
                            className="border-r text-center align-middle py-1"
                            style={{ width: 44 }}
                            title={`${col.person.name} · ${c.name}`}
                          >
                            {cellNode(col.person.id, c.id)}
                          </td>
                        ))}
                      </tr>
                    );
                    firstRowOfBand = false;
                    firstRowOfGroup = false;
                    return tr;
                  });
                });
              })}
              {rowBands.length === 0 && (
                <tr>
                  <td colSpan={3 + columns.length} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No competencies assigned to this unit yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
