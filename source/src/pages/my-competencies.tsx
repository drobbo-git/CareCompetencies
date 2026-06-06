import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/data/auth";
import { useData } from "@/data/store";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StageBadge } from "@/components/common/StageBadge";
import { StatusBadge } from "@/components/common/StatusBadge";
import { StageProgressRow } from "@/components/common/StageProgressRow";
import { STAGES } from "@/data/types";
import { getOtherCompetencyAchievements } from "@/lib/other-competencies";

/**
 * Person-facing view of their own assigned competencies and progress.
 * Mirrors the per-stage layout used on the Person Detail page for unit leaders.
 */
export default function MyCompetenciesPage() {
  const { currentLogin } = useAuth();
  const {
    persons, units, competencies, assignments, achievements, observations,
    getPersonStage, getCompetencyProgress,
  } = useData();

  const person = useMemo(
    () => persons.find((n) => n.id === currentLogin?.id),
    [persons, currentLogin],
  );
  const unit = person ? units.find((u) => u.id === person.unitId) : undefined;
  const stage = person ? getPersonStage(person.id) : "Core";

  const myAssignments = useMemo(() => {
    if (!person) return [];
    const roleId = person.roleId ?? "r-rn";
    return assignments.filter((a) => a.unitId === person.unitId && a.roleId === roleId);
  }, [assignments, person]);

  const otherRows = useMemo(
    () => (person ? getOtherCompetencyAchievements(person, achievements, assignments, competencies, units) : []),
    [person, achievements, assignments, competencies, units],
  );

  if (!currentLogin) return null;
  if (!person) {
    return (
      <>
        <PageHeader title="My Competencies" />
        <p className="text-sm text-muted-foreground">
          No matching person record. Ask your administrator to link your sign-in to a person record.
        </p>
      </>
    );
  }

  void observations;

  // Per-stage roll-up
  const perStage = STAGES.map((s) => {
    const inStage = myAssignments.filter((a) => a.stage === s);
    const achievedCount = inStage.filter(
      (a) => getCompetencyProgress(person.id, a.competencyId) === "Achieved",
    ).length;
    return { stage: s, total: inStage.length, achieved: achievedCount };
  });

  return (
    <>
      <PageHeader
        title="My Competencies"
        description={`${unit?.name ?? "—"} · Stage: ${stage}`}
        actions={<StageBadge stage={stage} />}
      />

      <Card className="mb-6">
        <CardHeader><CardTitle className="text-sm">Progress by stage</CardTitle></CardHeader>
        <CardContent className="space-y-2.5">
          {perStage.map((p) => (
            <StageProgressRow
              key={p.stage}
              stage={p.stage}
              achieved={p.achieved}
              total={p.total}
              isCurrent={stage === p.stage}
            />
          ))}
        </CardContent>
      </Card>

      {perStage.map((p) => {
        const inStage = myAssignments.filter((a) => a.stage === p.stage);
        if (inStage.length === 0) return null;
        return (
          <Card key={p.stage} className="mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <StageBadge stage={p.stage} size="sm" />
                <span className="text-muted-foreground font-normal">{p.achieved} of {p.total} achieved</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y">
                {inStage
                  .map((a) => competencies.find((c) => c.id === a.competencyId))
                  .filter((c): c is NonNullable<typeof c> => !!c)
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((c) => {
                    const status = getCompetencyProgress(person.id, c.id);
                    return (
                      <li key={c.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                        <Link to={`/competencies/${c.id}`} className="text-sm hover:underline truncate">
                          {c.name}
                        </Link>
                        <StatusBadge status={status} size="sm" />
                      </li>
                    );
                  })}
              </ul>
            </CardContent>
          </Card>
        );
      })}

      {otherRows.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Other Competencies</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y">
              {otherRows.map((r) => (
                <li key={r.achievement.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                  <Link to={`/competencies/${r.competency.id}`} className="text-sm hover:underline truncate">
                    {r.competency.name}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    Earned at {r.earnedAtUnit?.name ?? "—"}
                    {r.earnedAtStage ? ` · ${r.earnedAtStage}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </>
  );
}