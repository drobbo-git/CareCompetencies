import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/data/auth";
import { useData } from "@/data/store";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { StageBadge } from "@/components/common/StageBadge";

/**
 * Preceptors and Unit Leaders both land here, but see different scopes:
 *   - Preceptor → their paired orientees
 *   - Unit Leader → every orientee on the unit who isn't Fully Oriented yet
 *
 * The label in the sidebar already differs ("My Orientees" vs "Unit Orientees");
 * the page heading mirrors that.
 */
export default function MyOrienteesPage() {
  const { currentLogin } = useAuth();
  const {
    persons, units, assignments, achievements,
    getPersonStage,
  } = useData();

  const isUnitLeader = currentLogin?.systemRole === "UnitLeader";

  const rows = useMemo(() => {
    if (!currentLogin) return [];
    const all = isUnitLeader
      ? persons.filter((n) => n.unitId === currentLogin.unitId)
      : persons.filter((n) => n.primaryPreceptorId === currentLogin.id);

    return all
      .map((n) => {
        const stage = getPersonStage(n.id);
        const roleId = n.roleId ?? "r-rn";
        const total = assignments.filter((a) => a.unitId === n.unitId && a.roleId === roleId).length;
        const achieved = achievements.filter((a) => a.personId === n.id).length;
        const pct = total === 0 ? 0 : Math.round((achieved / total) * 100);
        return { person: n, stage, total, achieved, pct };
      })
      .filter((r) => !isUnitLeader || r.stage !== "FullyOriented")
      // Match the Person Roster default: least progress at top
      .sort((a, b) => a.pct - b.pct);
  }, [currentLogin, isUnitLeader, persons, assignments, achievements, getPersonStage]);

  if (!currentLogin) return null;

  const homeUnit = isUnitLeader && currentLogin.unitId ? units.find((u) => u.id === currentLogin.unitId) : undefined;

  return (
    <>
      <PageHeader
        title={isUnitLeader ? "Unit Orientees" : "My Orientees"}
        description={isUnitLeader
          ? `${homeUnit?.name ?? "Unit"} · Orientees with incomplete orientation`
          : "Orientees paired with you."}
      />

      <Card>
        <CardContent className="p-0">
          {rows.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              {isUnitLeader ? "All orientees on this unit are fully oriented." : "No orientees are paired with you."}
            </div>
          )}
          <ul className="divide-y">
            {rows.map((r) => (
              <li key={r.person.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <Link to={`/persons/${r.person.id}`} className="text-sm font-medium hover:underline truncate block">
                    {r.person.name}
                  </Link>
                  <div className="text-xs text-muted-foreground">
                    {r.achieved} of {r.total} achieved · {r.pct}%
                  </div>
                </div>
                <StageBadge stage={r.stage} size="sm" />
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </>
  );
}