import { useMemo } from "react";
import { useAuth } from "@/data/auth";
import { useData } from "@/data/store";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StageProgressRow } from "@/components/common/StageProgressRow";
import { STAGES } from "@/data/types";

/**
 * Lightweight in-app reports. The serious analytics live in Power BI / the
 * CareOps reporting layer against the dim/fact warehouse — see etl/README.md.
 * This page is for quick at-a-glance numbers without leaving the app.
 */
export default function ReportsPage() {
  const { currentLogin } = useAuth();
  const {
    units, persons, assignments, achievements, changeRequests, observations,
    getPersonStage,
  } = useData();

  const isUnitLeader = currentLogin?.systemRole === "UnitLeader";

  const unitsInScope = useMemo(
    () => (isUnitLeader && currentLogin?.unitId
      ? units.filter((u) => u.id === currentLogin.unitId)
      : units),
    [units, isUnitLeader, currentLogin],
  );

  const unitReadiness = useMemo(() => {
    return unitsInScope.map((u) => {
      const onUnit = persons.filter((n) => n.unitId === u.id && getPersonStage(n.id) !== "FullyOriented");
      const perStage = STAGES.map((s) => {
        const inStage = onUnit.flatMap((n) => {
          const roleId = n.roleId ?? "r-rn";
          return assignments
            .filter((a) => a.unitId === u.id && a.roleId === roleId && a.stage === s)
            .map((a) => ({ personId: n.id, competencyId: a.competencyId }));
        });
        const achievedCount = inStage.filter((row) =>
          achievements.some((ach) => ach.personId === row.personId && ach.competencyId === row.competencyId),
        ).length;
        return { stage: s, total: inStage.length, achieved: achievedCount };
      });
      return { unit: u, perStage };
    });
  }, [unitsInScope, persons, assignments, achievements, getPersonStage]);

  const requestSummary = useMemo(() => ({
    pending: changeRequests.filter((cr) => cr.status === "Pending").length,
    approved: changeRequests.filter((cr) => cr.status === "Approved").length,
    rejected: changeRequests.filter((cr) => cr.status === "Rejected").length,
  }), [changeRequests]);

  const obsSummary = useMemo(() => {
    const sat = observations.filter((o) => o.rating === "Satisfactory").length;
    const unsat = observations.filter((o) => o.rating === "Unsatisfactory").length;
    const not = observations.filter((o) => o.rating === "NotObserved").length;
    return { total: observations.length, sat, unsat, not };
  }, [observations]);

  if (!currentLogin) return null;

  return (
    <>
      <PageHeader
        title="Reports"
        description={isUnitLeader ? "Readiness summary for your unit." : "Cross-unit readiness and activity."}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <SummaryStat label="Pending change requests" value={requestSummary.pending} />
        <SummaryStat label="Approved (lifetime)" value={requestSummary.approved} />
        <SummaryStat label="Rejected (lifetime)" value={requestSummary.rejected} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
        <SummaryStat label="Observations recorded" value={obsSummary.total} />
        <SummaryStat label="Satisfactory" value={obsSummary.sat} />
        <SummaryStat label="Unsatisfactory" value={obsSummary.unsat} />
        <SummaryStat label="Not observed" value={obsSummary.not} />
      </div>

      <h2 className="text-sm uppercase tracking-wider text-muted-foreground mb-2">Unit readiness</h2>
      <div className="space-y-3">
        {unitReadiness.map((row) => (
          <Card key={row.unit.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{row.unit.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {row.perStage.map((p) => (
                <StageProgressRow key={p.stage} stage={p.stage} achieved={p.achieved} total={p.total} />
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-2xl font-semibold tabular-nums mt-0.5">{value}</div>
      </CardContent>
    </Card>
  );
}