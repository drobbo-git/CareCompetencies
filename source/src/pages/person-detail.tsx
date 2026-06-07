import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/data/auth";
import { useData } from "@/data/store";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StageBadge } from "@/components/common/StageBadge";
import { StatusBadge } from "@/components/common/StatusBadge";
import { StageProgressRow } from "@/components/common/StageProgressRow";
import { STAGES, type Stage } from "@/data/types";
import { getOtherCompetencyAchievements, getRequiredTotalsByStage } from "@/lib/other-competencies";
import { openCompetencySummaryWindow } from "@/lib/competency-summary";
import { Printer, AlertTriangle } from "lucide-react";

/**
 * Single-person detail page used by Unit Leaders. Shows:
 *   - Identity + current stage
 *   - Per-stage progress with a "prior stages complete?" indicator
 *   - Required competency detail by category
 *   - "Other Competencies" stripe for cross-train and prior-unit credentials
 *   - Recent observations + a "Print competency summary" affordance that
 *     opens the regulator-facing summary window.
 */
export default function PersonDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { currentLogin } = useAuth();
  const navigate = useNavigate();
  const isPreceptor = currentLogin?.systemRole === "Preceptor";
  const data = useData();
  const {
    persons, units, personRoles, competencies, steps,
    categories, groups, assignments, observations, achievements,
    getPersonStage, getDaysSinceStart, getCompetencyProgress,
  } = data;

  const person = useMemo(() => persons.find((n) => n.id === id), [persons, id]);
  const unit = person ? units.find((u) => u.id === person.unitId) : undefined;
  const role = person ? personRoles.find((r) => r.id === (person.roleId ?? "r-rn")) : undefined;
  const primaryPreceptorName = person?.primaryPreceptorId
    ? persons.find((p) => p.id === person.primaryPreceptorId)?.name
    : undefined;

  const stage = person ? getPersonStage(person.id) : "Core";
  const daysSinceStart = person ? getDaysSinceStart(person.id) : 0;

  const myAssignments = useMemo(() => {
    if (!person) return [];
    const roleId = person.roleId ?? "r-rn";
    return assignments.filter((a) => a.unitId === person.unitId && a.roleId === roleId);
  }, [person, assignments]);

  const perStageTotals = useMemo(
    () => getRequiredTotalsByStage(person, assignments),
    [person, assignments],
  );

  const perStage = useMemo(() => {
    if (!person) return [];
    return STAGES.map((s) => {
      const inStage = myAssignments.filter((a) => a.stage === s);
      const achieved = inStage.filter(
        (a) => getCompetencyProgress(person.id, a.competencyId) === "Achieved",
      ).length;
      return { stage: s, total: perStageTotals[s] ?? inStage.length, achieved };
    });
  }, [person, myAssignments, perStageTotals, getCompetencyProgress]);

  // Outstanding prior-stage items
  const STAGE_RANK: Record<Stage, number> = { Core: 0, Orientation: 1, Education: 2 };
  const priorOutstanding = useMemo(() => {
    if (!person || stage === "FullyOriented" || stage === "Nonclinical") return [];
    const curIdx = STAGE_RANK[stage as Stage];
    const out: { stage: Stage; remaining: number }[] = [];
    for (const p of perStage) {
      if (STAGE_RANK[p.stage] < curIdx && p.total > 0 && p.achieved < p.total) {
        out.push({ stage: p.stage, remaining: p.total - p.achieved });
      }
    }
    return out;
  }, [person, stage, perStage]);

  // Required competency detail grouped by category
  const detailByCategory = useMemo(() => {
    if (!person) return new Map<string, { categoryName: string; categoryColor: string; rows: { c: typeof competencies[0]; stage: Stage; status: string }[] }>();
    const map = new Map<string, { categoryName: string; categoryColor: string; rows: { c: typeof competencies[0]; stage: Stage; status: string }[] }>();
    for (const a of myAssignments) {
      const c = competencies.find((x) => x.id === a.competencyId);
      if (!c) continue;
      const cat = categories.find((x) => x.id === c.categoryId);
      const key = cat?.id ?? "uncat";
      const entry = map.get(key) ?? {
        categoryName: cat?.name ?? "Uncategorized",
        categoryColor: cat?.color ?? "#94a3b8",
        rows: [],
      };
      entry.rows.push({
        c,
        stage: a.stage,
        status: getCompetencyProgress(person.id, c.id),
      });
      map.set(key, entry);
    }
    for (const v of map.values()) {
      v.rows.sort((a, b) => {
        const r = (STAGE_RANK[a.stage] ?? 0) - (STAGE_RANK[b.stage] ?? 0);
        return r !== 0 ? r : a.c.name.localeCompare(b.c.name);
      });
    }
    return map;
  }, [person, myAssignments, competencies, categories, getCompetencyProgress]);

  const otherRows = useMemo(
    () => (person ? getOtherCompetencyAchievements(person, achievements, assignments, competencies, units) : []),
    [person, achievements, assignments, competencies, units],
  );

  // Recent observations on this person (latest 8)
  const recentObservations = useMemo(() => {
    if (!person) return [];
    return observations
      .filter((o) => o.personId === person.id)
      .slice()
      .sort((a, b) => b.observedAt.localeCompare(a.observedAt))
      .slice(0, 8);
  }, [person, observations]);

  if (currentLogin?.systemRole !== "UnitLeader" && currentLogin?.systemRole !== "Administrator" && currentLogin?.systemRole !== "Preceptor") {
    return <p className="text-sm text-muted-foreground">Sign in as a Unit Leader, Preceptor, or Administrator.</p>;
  }

  if (!person) {
    return (
      <>
        <PageHeader title="Person not found" />
        <Link to="/persons" className="text-sm text-primary hover:underline">Back to roster</Link>
      </>
    );
  }

  function handlePrint() {
    if (!person) return;
    openCompetencySummaryWindow({
      person,
      unit,
      role,
      primaryPreceptorName,
      persons,
      competencies,
      steps,
      categories,
      groups,
      assignments,
      observations,
      achievements,
      units,
      currentStage: stage,
      daysSinceStart,
    });
  }

  void groups;

  return (
    <>
      <PageHeader
        title={person.name}
        description={`${unit?.name ?? "—"} · ${role?.name ?? "—"} · Day ${daysSinceStart}`}
        actions={
          <div className="flex items-center gap-2">
            <StageBadge stage={stage} />
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-1" /> Competency summary
            </Button>
          </div>
        }
      />

      {priorOutstanding.length > 0 && (
        <Card className="mb-4 border-destructive/40 bg-destructive/5">
          <CardContent className="pt-4 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <strong>Outstanding prior-stage competencies:</strong>{" "}
              {priorOutstanding.map((p) => `${p.stage} (${p.remaining})`).join(" · ")}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="mb-4">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Progress by stage</CardTitle></CardHeader>
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

      <h2 className="text-sm uppercase tracking-wider text-muted-foreground mb-2 mt-6">
        Competency detail by category
      </h2>
      {Array.from(detailByCategory.entries())
        .sort((a, b) => a[1].categoryName.localeCompare(b[1].categoryName))
        .map(([key, group]) => (
          <Card key={key} className="mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: group.categoryColor }} />
                {group.categoryName}
                <span className="font-normal text-muted-foreground">
                  ({group.rows.filter((r) => r.status === "Achieved").length} of {group.rows.length})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y">
                {group.rows.map((r) => (
                  <li key={r.c.id} className="px-4 py-2 flex items-center justify-between gap-3">
                    {isPreceptor ? (
                      <button
                        className="text-sm hover:underline truncate min-w-0 text-left text-primary"
                        onClick={() => navigate("/observe", { state: { personId: person.id, competencyId: r.c.id } })}
                      >
                        {r.c.name}
                      </button>
                    ) : (
                      <Link to={`/competencies/${r.c.id}`} className="text-sm hover:underline truncate min-w-0">
                        {r.c.name}
                      </Link>
                    )}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <StageBadge stage={r.stage} size="sm" />
                      <StatusBadge status={r.status as any} size="sm" />
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}

      {otherRows.length > 0 && (
        <>
          <h2 className="text-sm uppercase tracking-wider text-muted-foreground mb-2 mt-6">
            Other Competencies
          </h2>
          <Card className="mb-4">
            <CardContent className="p-0">
              <ul className="divide-y">
                {otherRows.map((r) => (
                  <li key={r.achievement.id} className="px-4 py-2 flex items-center justify-between gap-3 text-sm">
                    <Link to={`/competencies/${r.competency.id}`} className="hover:underline truncate min-w-0">
                      {r.competency.name}
                    </Link>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      Earned at {r.earnedAtUnit?.name ?? "—"}
                      {r.earnedAtStage ? ` · ${r.earnedAtStage}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </>
      )}

      {recentObservations.length > 0 && (
        <>
          <h2 className="text-sm uppercase tracking-wider text-muted-foreground mb-2 mt-6">
            Recent observations
          </h2>
          <Card>
            <CardContent className="p-0">
              <ul className="divide-y">
                {recentObservations.map((o) => {
                  const c = competencies.find((x) => x.id === o.competencyId);
                  return (
                    <li key={o.id} className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <div className="truncate">{c?.name ?? "—"}</div>
                        {o.notes && <div className="text-xs text-muted-foreground mt-0.5 truncate">{o.notes}</div>}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge
                          variant={o.rating === "Satisfactory" ? "default" : o.rating === "Unsatisfactory" ? "destructive" : "secondary"}
                          className="text-[10px]"
                        >
                          {o.rating}
                        </Badge>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(o.observedAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        </>
      )}
    </>
  );
}