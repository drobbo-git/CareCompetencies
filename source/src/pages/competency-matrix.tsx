import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/data/auth";
import { useData } from "@/data/store";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import type { Stage, StageOrFully } from "@/data/types";
import { STAGES } from "@/data/types";

/**
 * Transposed Competency Matrix for Unit Leaders.
 *
 *   - Rows: competencies, grouped by stage band (Core → Orientation → Education)
 *     and by group label within each band.
 *   - Columns: nurses on the unit, sorted by stage then name. Column headers
 *     are rotated 90° (writing-mode: vertical-rl) to keep columns narrow.
 *   - A second sticky top row spans the nurses-in-each-stage as a colored
 *     "stage grouper" — matching the symmetry of the row stage band.
 *   - Cell semantics:
 *       ✓     — Achieved
 *       •     — In progress (one or more observations recorded)
 *       blank — Not started
 *       —     — Not required (no assignment for this person's role/unit at this competency)
 *   - All sticky <th>s render on opaque `bg-card` so scrolled rows don't
 *     bleed through.
 */
export default function CompetencyMatrixPage() {
  const { currentLogin } = useAuth();
  const {
    persons, units, competencies, groups, assignments, achievements, observations,
    getPersonStage,
  } = useData();

  const unitId = currentLogin?.unitId;
  const unit = unitId ? units.find((u) => u.id === unitId) : undefined;

  // ---------------------------------------------------------------------
  // Build column list (nurses on this unit, sorted by stage then name).
  // ---------------------------------------------------------------------
  const STAGE_RANK: Record<StageOrFully, number> = {
    Core: 0, Orientation: 1, Education: 2, FullyOriented: 3, Nonclinical: 4,
  };

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

  // Group consecutive columns by stage for the top sticky band.
  const columnStageGroups = useMemo(() => {
    const out: { stage: StageOrFully; span: number }[] = [];
    for (const c of columns) {
      const last = out[out.length - 1];
      if (last && last.stage === c.stage) last.span += 1;
      else out.push({ stage: c.stage, span: 1 });
    }
    return out;
  }, [columns]);

  // ---------------------------------------------------------------------
  // Build row list (competencies grouped by stage band and group label).
  // ---------------------------------------------------------------------
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
    // Build assignments for this unit (any role; matrix shows the union).
    const unitAssignments = assignments.filter((a) => a.unitId === unitId);

    // Map competencyId -> earliest stage that assigns it on this unit
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

      // Group by groupName for the second sticky col
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

      const flatCount = groupedSorted.reduce((acc, g) => acc + g.competencyIds.length, 0);
      return { stage, groups: groupedSorted, flatCount };
    }).filter((b) => b.flatCount > 0);
  }, [unitId, assignments, competencies, groupName]);

  // ---------------------------------------------------------------------
  // Cell status lookup
  // ---------------------------------------------------------------------
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

  // assignmentByPersonComp: which (person, competency) pairs are required?
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

  if (currentLogin?.systemRole !== "UnitLeader") {
    return <p className="text-sm text-muted-foreground">Unit Leader access required.</p>;
  }

  function cellContent(personId: string, competencyId: string): { glyph: string; cls: string; title: string } {
    const k = `${personId}|${competencyId}`;
    if (!requiredSet.has(k)) return { glyph: "—", cls: "text-muted-foreground/50", title: "Not required" };
    if (achievedSet.has(k)) return { glyph: "✓", cls: "text-green-700 font-semibold", title: "Achieved" };
    if (inProgressSet.has(k)) return { glyph: "•", cls: "text-blue-700 font-semibold", title: "In progress" };
    return { glyph: "", cls: "", title: "Not started" };
  }

  const STAGE_HEADER_BG: Record<StageOrFully, string> = {
    Core: "bg-red-50 text-red-800 border-red-200",
    Orientation: "bg-amber-50 text-amber-900 border-amber-200",
    Education: "bg-blue-50 text-blue-800 border-blue-200",
    FullyOriented: "bg-green-50 text-green-800 border-green-200",
    Nonclinical: "bg-zinc-50 text-zinc-700 border-zinc-200",
  };

  return (
    <>
      <PageHeader
        title="Competency Matrix"
        description={unit ? `${unit.name} · ${competencies.length} competencies × ${columns.length} persons` : undefined}
      />

      <Card>
        <CardContent className="p-0 overflow-auto max-h-[80vh]">
          <table className="text-xs border-collapse">
            <thead>
              {/* Top sticky row: stage band groupers across the nurses */}
              <tr>
                <th
                  className="sticky top-0 left-0 z-30 bg-card border-r border-b"
                  colSpan={3}
                  style={{ minWidth: 360 }}
                />
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
              {/* Second sticky row: rotated person names */}
              <tr>
                <th
                  className="sticky left-0 z-20 bg-card border-r border-b"
                  style={{ top: 26, minWidth: 48 }}
                />
                <th
                  className="sticky z-20 bg-card border-r border-b"
                  style={{ top: 26, minWidth: 140 }}
                />
                <th
                  className="sticky z-20 bg-card border-r border-b"
                  style={{ top: 26, minWidth: 220 }}
                >
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
                      style={{
                        writingMode: "vertical-rl",
                        transform: "rotate(180deg)",
                        height: 140,
                      }}
                    >
                      {c.person.name}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rowBands.flatMap((band) => {
                // For each band, we need to render rows; the stage cell uses rowSpan=band.flatCount.
                let firstRowOfBand = true;
                const stageBg = STAGE_HEADER_BG[band.stage];
                return band.groups.flatMap((grp) => {
                  let firstRowOfGroup = true;
                  return grp.competencyIds.map((cid) => {
                    const c = competencies.find((x) => x.id === cid)!;
                    const tr = (
                      <tr key={cid} className="border-b">
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
                        {columns.map((col) => {
                          const cell = cellContent(col.person.id, c.id);
                          return (
                            <td
                              key={col.person.id}
                              className={`border-r text-center align-middle ${cell.cls}`}
                              style={{ width: 44 }}
                              title={`${col.person.name} · ${c.name} · ${cell.title}`}
                            >
                              {cell.glyph}
                            </td>
                          );
                        })}
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

      <div className="mt-3 text-xs text-muted-foreground flex items-center gap-4 flex-wrap">
        <span className="inline-flex items-center gap-1"><span className="text-green-700 font-semibold">✓</span> Achieved</span>
        <span className="inline-flex items-center gap-1"><span className="text-blue-700 font-semibold">•</span> In progress</span>
        <span className="inline-flex items-center gap-1"><span className="text-muted-foreground">blank</span> Not started</span>
        <span className="inline-flex items-center gap-1"><span className="text-muted-foreground/50">—</span> Not required</span>
      </div>
    </>
  );
}