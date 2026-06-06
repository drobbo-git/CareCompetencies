// =============================================================================
// Other Competencies derivation
// -----------------------------------------------------------------------------
// Given a nurse and the full achievement set, this returns the achievements
// that fall OUTSIDE the nurse's current unit + role required set. These are
// surfaced on the dashboard under a separate "Other Competencies" stripe with
// provenance (e.g., "Earned at DN 4100 · Core").
//
// Two real-world sources of Other Competencies:
//   1) Cross-train credentials — the nurse earned a competency at a unit other
//      than their home unit.
//   2) Prior-unit credentials — the nurse transferred and the old unit's
//      required competencies become "Other" at their new home unit.
//
// The achievement.earnedAtUnitId field carries provenance. If absent, we fall
// back to the nurse's current home unit (i.e., treat it as a normal in-unit
// achievement). That keeps legacy/generated achievements working unchanged.
// =============================================================================
import type {
  Person, CompetencyAchievement, CompetencyAssignment, Competency, Unit, Stage,
} from "@/data/types";

export interface OtherCompetencyRow {
  achievement: CompetencyAchievement;
  competency: Competency;
  earnedAtUnit?: Unit;
  /** Stage of this competency on the earnedAt unit (for the person's role), if known. */
  earnedAtStage?: Stage;
}

export function getOtherCompetencyAchievements(
  person: Person | undefined,
  achievements: CompetencyAchievement[],
  assignments: CompetencyAssignment[],
  competencies: Competency[],
  units: Unit[],
): OtherCompetencyRow[] {
  if (!person) return [];
  const roleId = person.roleId ?? "r-rn";

  // Required-set: competencyId for the person's home unit + role.
  const required = new Set<string>();
  for (const a of assignments) {
    if (a.unitId === person.unitId && a.roleId === roleId) required.add(a.competencyId);
  }

  const rows: OtherCompetencyRow[] = [];
  for (const ach of achievements) {
    if (ach.personId !== person.id) continue;
    if (required.has(ach.competencyId)) continue; // it's a required achievement, not Other
    const comp = competencies.find((c) => c.id === ach.competencyId);
    if (!comp) continue;
    const earnedAtUnitId = ach.earnedAtUnitId;
    const earnedAtUnit = earnedAtUnitId ? units.find((u) => u.id === earnedAtUnitId) : undefined;
    // Resolve stage on the earned-at unit at the nurse's role (best-effort).
    let earnedAtStage: Stage | undefined;
    if (earnedAtUnitId) {
      const matching = assignments.find(
        (a) => a.unitId === earnedAtUnitId && a.roleId === roleId && a.competencyId === ach.competencyId,
      );
      earnedAtStage = matching?.stage;
    }
    rows.push({ achievement: ach, competency: comp, earnedAtUnit, earnedAtStage });
  }

  // Sort: earned-at unit name, then competency name, then most recent first.
  rows.sort((x, y) => {
    const xu = x.earnedAtUnit?.name ?? "";
    const yu = y.earnedAtUnit?.name ?? "";
    if (xu !== yu) return xu.localeCompare(yu);
    if (x.competency.name !== y.competency.name) return x.competency.name.localeCompare(y.competency.name);
    return y.achievement.achievedAt.localeCompare(x.achievement.achievedAt);
  });
  return rows;
}

/** Returns the per-stage required totals across Core/Orientation/Education for a person. */
export function getRequiredTotalsByStage(
  person: Person | undefined,
  assignments: CompetencyAssignment[],
): Record<Stage, number> {
  const out: Record<Stage, number> = { Core: 0, Orientation: 0, Education: 0 };
  if (!person) return out;
  const roleId = person.roleId ?? "r-rn";
  for (const a of assignments) {
    if (a.unitId === person.unitId && a.roleId === roleId) out[a.stage]++;
  }
  return out;
}