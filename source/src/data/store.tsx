// =============================================================================
// CareCompetencies — Data Store (TanStack Query)
// -----------------------------------------------------------------------------
// All domain data is fetched from the API via TanStack Query. Collections are
// available via the same useData() hook interface as the former in-memory store.
// Mutations call the API and invalidate the relevant query cache.
// =============================================================================

import { createContext, useCallback, useContext, useMemo, useRef, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  Unit, PersonRole, Person, PersonPrivilege,
  CompetencyCategory, CompetencyGroup, Competency, CompetencyStep,
  CompetencyAssignment, StepObservation, CompetencyAchievement,
  SelfAssessment, SelfAssessmentConfidence, SelfAssessmentRating,
  ChangeRequest, AuditEvent, Stage, ObservationRating, StageOrFully,
} from "./types";
import { STAGES, getStageDays } from "./types";
import { seedCategories } from "./seed";
import { useAuth } from "./auth";
import { api } from "@/lib/api";
import { todayLocalISODate, localDateStringToISO } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------
interface DataCtx {
  // Collections
  units: Unit[];
  personRoles: PersonRole[];
  privileges: PersonPrivilege[];
  persons: Person[];
  categories: CompetencyCategory[];
  groups: CompetencyGroup[];
  competencies: Competency[];
  steps: CompetencyStep[];
  assignments: CompetencyAssignment[];
  observations: StepObservation[];
  achievements: CompetencyAchievement[];
  selfAssessments: SelfAssessment[];
  changeRequests: ChangeRequest[];
  auditEvents: AuditEvent[];

  // Derived helpers
  getPersonStage: (personId: string) => StageOrFully;
  getDaysSinceStart: (personId: string) => number;
  getCompetencyProgress: (
    personId: string,
    competencyId: string,
  ) => "Achieved" | "InProgress" | "NotStarted";

  // Mutations
  recordSelfAssessment: (input: {
    competencyId: string;
    overallRating: SelfAssessmentRating;
    notes?: string;
    steps: Array<{ stepId: string; confidence: SelfAssessmentConfidence }>;
  }) => Promise<SelfAssessment>;

  recordObservation: (input: Omit<StepObservation, "id" | "observedAt"> & {
    observedAt?: string;
  }) => Promise<StepObservation>;

  recordAchievement: (input: Omit<CompetencyAchievement, "id" | "achievedAt"> & {
    achievedAt?: string;
  }) => Promise<CompetencyAchievement>;

  reassignPreceptor: (personId: string, newPreceptorId: string | null) => Promise<void>;

  upsertCompetency: (c: Competency) => Promise<void>;
  upsertSteps: (competencyId: string, newSteps: CompetencyStep[]) => Promise<void>;
  upsertGroup: (g: CompetencyGroup) => Promise<void>;
  removeGroup: (groupId: string) => Promise<void>;
  upsertAssignment: (a: CompetencyAssignment) => Promise<void>;
  removeAssignment: (assignmentId: string) => Promise<void>;

  submitChangeRequest: (cr: Omit<ChangeRequest, "id" | "submittedAt" | "status">) => Promise<ChangeRequest>;
  decideChangeRequest: (id: string, decision: "Approved" | "Rejected", adminNote?: string) => Promise<void>;
  patchChangeRequest: (id: string, patch: { status?: string; adminNote?: string }) => Promise<void>;

  logAudit: (e: Omit<AuditEvent, "id" | "timestamp">) => Promise<void>;

  // Call when a page needs a specific other person's (or small roster's)
  // observations/achievements — merges that data into the arrays above
  // instead of ever fetching the full table (see scopeFilter.ts).
  ensurePersonDataLoaded: (personId: string) => void;
  ensurePersonsDataLoaded: (personIds: string[]) => void;
}

const Ctx = createContext<DataCtx | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
export function DataProvider({ children }: { children: React.ReactNode }) {
  const { currentLogin } = useAuth();
  const queryClient = useQueryClient();
  const enabled = !!currentLogin;
  const isUnitLeader = currentLogin?.systemRole === 'UnitLeader';
  const isAdministrator = currentLogin?.systemRole === 'Administrator';

  // -------------------------------------------------------------------------
  // Queries — only run when authenticated
  // -------------------------------------------------------------------------
  const unitsQ       = useQuery({ queryKey: ['units'],            queryFn: api.getUnits,             enabled, staleTime: 60_000 });
  const personRolesQ = useQuery({ queryKey: ['person-roles'],     queryFn: api.getPersonRoles,       enabled, staleTime: 60_000 });
  const privilegesQ  = useQuery({ queryKey: ['person-privileges'], queryFn: api.getPersonPrivileges, enabled, staleTime: 60_000 });
  const personsQ     = useQuery({ queryKey: ['persons'],           queryFn: api.getPersons,          enabled, staleTime: 30_000 });
  const groupsQ         = useQuery({ queryKey: ['groups'],          queryFn: api.getGroups,         enabled, staleTime: 30_000 });
  const competenciesQ   = useQuery({ queryKey: ['competencies'],    queryFn: api.getCompetencies,   enabled, staleTime: 30_000 });
  const stepsQ          = useQuery({ queryKey: ['steps'],           queryFn: api.getAllSteps,        enabled, staleTime: 30_000 });
  const assignmentsQ    = useQuery({ queryKey: ['assignments'],     queryFn: api.getAssignments,    enabled, staleTime: 30_000 });
  // No args: scoped server-side to "my own rows" for Preceptors (the
  // unscoped table is ~1.5M/~500k rows at production volume — see
  // scopeFilter.ts). Pages that need a SPECIFIC other person's (or a small
  // roster's) data call ensurePersonDataLoaded/ensurePersonsDataLoaded
  // below, which merges that person's rows into these same arrays — so
  // getCompetencyProgress and every existing .filter(a => a.personId===X)
  // call site keep working unchanged, just against a dynamically-grown,
  // still-bounded set instead of the full table.
  //
  // UnitLeaders skip this query entirely — the unit-scoped default returns
  // ~5k raw rows per unit, which at production concurrency exhausts the
  // connection pool (see api/loadtest/README.md). Their dashboard uses
  // server-side aggregation endpoints instead; other pages call
  // ensurePersonsDataLoaded to load observations lazily per person.
  const observationsQ   = useQuery({ queryKey: ['observations'],    queryFn: () => api.getObservations(), enabled: enabled && !isUnitLeader, staleTime: 10_000 });
  // Administrators skip the global fetch — the unscoped table is 500k rows
  // at production volume and would exhaust the connection pool under concurrent
  // load (see api/loadtest/README.md). They rely on ensurePersonDataLoaded
  // for per-person work; pages showing aggregate stats are a known follow-up.
  const achievementsQ     = useQuery({ queryKey: ['achievements'],     queryFn: () => api.getAchievements(),     enabled: enabled && !isAdministrator, staleTime: 10_000 });
  const selfAssessmentsQ  = useQuery({ queryKey: ['self-assessments'], queryFn: () => api.getSelfAssessments(), enabled, staleTime: 10_000 });
  const changeRequestsQ   = useQuery({ queryKey: ['change-requests'],  queryFn: api.getChangeRequests,          enabled, staleTime: 10_000 });
  const auditQ          = useQuery({ queryKey: ['audit-events'],    queryFn: api.getAuditEvents,    enabled: enabled && currentLogin?.systemRole === 'Administrator', staleTime: 10_000 });

  // -------------------------------------------------------------------------
  // Extra person-scoped observations/achievements — merged into the arrays
  // below on demand (see ensurePersonDataLoaded/ensurePersonsDataLoaded).
  // -------------------------------------------------------------------------
  const [extraPersonIds, setExtraPersonIds] = useState<readonly string[]>([]);

  const ensurePersonsDataLoaded = useCallback((personIds: string[]) => {
    setExtraPersonIds((prev) => {
      const prevSet = new Set(prev);
      const merged = [...prev];
      let changed = false;
      for (const id of personIds) {
        if (!prevSet.has(id)) { merged.push(id); prevSet.add(id); changed = true; }
      }
      return changed ? merged.sort() : prev;
    });
  }, []);
  const ensurePersonDataLoaded = useCallback(
    (personId: string) => ensurePersonsDataLoaded([personId]),
    [ensurePersonsDataLoaded],
  );

  const extraAchievementsQ = useQuery({
    queryKey: ['achievements', 'extra', extraPersonIds],
    queryFn: () => api.getAchievements({ personIds: [...extraPersonIds] }),
    enabled: enabled && extraPersonIds.length > 0,
    staleTime: 10_000,
  });
  const extraObservationsQ = useQuery({
    queryKey: ['observations', 'extra', extraPersonIds],
    queryFn: () => api.getObservations({ personIds: [...extraPersonIds] }),
    enabled: enabled && extraPersonIds.length > 0,
    staleTime: 10_000,
  });
  const extraSelfAssessmentsQ = useQuery({
    queryKey: ['self-assessments', 'extra', extraPersonIds],
    queryFn: () => api.getSelfAssessments({ personIds: [...extraPersonIds] }),
    enabled: enabled && extraPersonIds.length > 0,
    staleTime: 10_000,
  });

  const units       = unitsQ.data       ?? [];
  const personRoles = personRolesQ.data ?? [];
  const privileges  = privilegesQ.data  ?? [];
  const persons     = personsQ.data     ?? [];
  const groups         = groupsQ.data         ?? [];
  const competencies   = competenciesQ.data   ?? [];
  const steps          = stepsQ.data          ?? [];
  const assignments    = assignmentsQ.data    ?? [];
  const changeRequests = changeRequestsQ.data ?? [];
  const auditEvents    = auditQ.data          ?? [];

  const observations = useMemo(() => {
    const base = observationsQ.data ?? [];
    const extra = extraObservationsQ.data;
    if (!extra || extra.length === 0) return base;
    const seen = new Set(base.map((o) => o.id));
    return [...base, ...extra.filter((o) => !seen.has(o.id))];
  }, [observationsQ.data, extraObservationsQ.data]);

  const achievements = useMemo(() => {
    const base = achievementsQ.data ?? [];
    const extra = extraAchievementsQ.data;
    if (!extra || extra.length === 0) return base;
    const seen = new Set(base.map((a) => a.id));
    return [...base, ...extra.filter((a) => !seen.has(a.id))];
  }, [achievementsQ.data, extraAchievementsQ.data]);

  const selfAssessments = useMemo(() => {
    const base = selfAssessmentsQ.data ?? [];
    const extra = extraSelfAssessmentsQ.data;
    if (!extra || extra.length === 0) return base;
    const seen = new Set(base.map((a) => a.id));
    return [...base, ...extra.filter((a) => !seen.has(a.id))];
  }, [selfAssessmentsQ.data, extraSelfAssessmentsQ.data]);

  // Show a loading screen while initial data fetches settle (authenticated only)
  const isPending = enabled && (
    unitsQ.isPending || personsQ.isPending || competenciesQ.isPending
  );

  // -------------------------------------------------------------------------
  // Refs — let mutation callbacks access latest data without deps churn
  // -------------------------------------------------------------------------
  const competenciesRef = useRef(competencies);
  const groupsRef       = useRef(groups);
  useEffect(() => { competenciesRef.current = competencies; }, [competencies]);
  useEffect(() => { groupsRef.current = groups; }, [groups]);

  // -------------------------------------------------------------------------
  // Derived helpers
  // -------------------------------------------------------------------------
  const getDaysSinceStart = useCallback(
    (personId: string): number => {
      const n = persons.find((x) => x.id === personId);
      if (!n) return 0;
      const start = new Date(n.startDate + "T12:00:00").getTime();
      const today = new Date(todayLocalISODate() + "T12:00:00").getTime();
      return Math.max(0, Math.floor((today - start) / (1000 * 60 * 60 * 24)));
    },
    [persons],
  );

  const getPersonStage = useCallback(
    (personId: string): StageOrFully => {
      const n = persons.find((x) => x.id === personId);
      if (!n) return "Core";
      if (n.stageOverride) return n.stageOverride;
      const unit = units.find((u) => u.id === n.unitId);
      const days = getStageDays(unit);
      const elapsed = getDaysSinceStart(personId);
      let acc = 0;
      for (const s of STAGES) {
        acc += days[s];
        if (elapsed < acc) return s;
      }
      return "FullyOriented";
    },
    [persons, units, getDaysSinceStart],
  );

  const getCompetencyProgress = useCallback(
    (personId: string, competencyId: string): "Achieved" | "InProgress" | "NotStarted" => {
      if (achievements.some((a) => a.personId === personId && a.competencyId === competencyId)) {
        return "Achieved";
      }
      if (observations.some((o) => o.personId === personId && o.competencyId === competencyId)) {
        return "InProgress";
      }
      return "NotStarted";
    },
    [achievements, observations],
  );

  // -------------------------------------------------------------------------
  // Mutations — activity
  // -------------------------------------------------------------------------
  const recordSelfAssessment = useCallback(async (input: {
    competencyId: string;
    overallRating: SelfAssessmentRating;
    notes?: string;
    steps: Array<{ stepId: string; confidence: SelfAssessmentConfidence }>;
  }): Promise<SelfAssessment> => {
    const result = await api.createSelfAssessment(input);
    await queryClient.invalidateQueries({ queryKey: ['self-assessments'] });
    return result;
  }, [queryClient]);

  const recordObservation = useCallback(async (
    input: Omit<StepObservation, "id" | "observedAt"> & { observedAt?: string },
  ): Promise<StepObservation> => {
    const result = await api.createObservation(input);
    await queryClient.invalidateQueries({ queryKey: ['observations'] });
    return result;
  }, [queryClient]);

  const recordAchievement = useCallback(async (
    input: Omit<CompetencyAchievement, "id" | "achievedAt"> & { achievedAt?: string },
  ): Promise<CompetencyAchievement> => {
    const result = await api.createAchievement(input);
    await queryClient.invalidateQueries({ queryKey: ['achievements'] });
    return result;
  }, [queryClient]);

  // -------------------------------------------------------------------------
  // Mutations — persons
  // -------------------------------------------------------------------------
  const reassignPreceptor = useCallback(async (
    personId: string,
    newPreceptorId: string | null,
  ): Promise<void> => {
    await api.patchPerson(personId, { primaryPreceptorId: newPreceptorId });
    await queryClient.invalidateQueries({ queryKey: ['persons'] });
  }, [queryClient]);

  // -------------------------------------------------------------------------
  // Mutations — catalog
  // -------------------------------------------------------------------------
  const upsertCompetency = useCallback(async (c: Competency): Promise<void> => {
    const exists = competenciesRef.current.some((x) => x.id === c.id);
    const { id, ...rest } = c;
    if (exists) {
      await api.updateCompetency(id, rest);
    } else {
      await api.createCompetency({ id, ...rest });
    }
    await queryClient.invalidateQueries({ queryKey: ['competencies'] });
  }, [queryClient]);

  const upsertSteps = useCallback(async (competencyId: string, newSteps: CompetencyStep[]): Promise<void> => {
    await api.updateSteps(
      competencyId,
      newSteps.map((s) => ({ id: s.id, name: s.name, orderIndex: s.orderIndex })),
    );
    await queryClient.invalidateQueries({ queryKey: ['steps'] });
  }, [queryClient]);

  const upsertGroup = useCallback(async (g: CompetencyGroup): Promise<void> => {
    const exists = groupsRef.current.some((x) => x.id === g.id);
    const { id, ...rest } = g;
    if (exists) {
      await api.updateGroup(id, rest);
    } else {
      await api.createGroup({ id, ...rest });
    }
    await queryClient.invalidateQueries({ queryKey: ['groups'] });
  }, [queryClient]);

  const removeGroup = useCallback(async (groupId: string): Promise<void> => {
    await api.deleteGroup(groupId);
    await queryClient.invalidateQueries({ queryKey: ['groups'] });
  }, [queryClient]);

  const upsertAssignment = useCallback(async (a: CompetencyAssignment): Promise<void> => {
    await api.createAssignment(a); // server uses ON CONFLICT DO UPDATE
    await queryClient.invalidateQueries({ queryKey: ['assignments'] });
  }, [queryClient]);

  const removeAssignment = useCallback(async (assignmentId: string): Promise<void> => {
    await api.deleteAssignment(assignmentId);
    await queryClient.invalidateQueries({ queryKey: ['assignments'] });
  }, [queryClient]);

  // -------------------------------------------------------------------------
  // Mutations — workflow
  // -------------------------------------------------------------------------
  const submitChangeRequest = useCallback(async (
    cr: Omit<ChangeRequest, "id" | "submittedAt" | "status">,
  ): Promise<ChangeRequest> => {
    const result = await api.createChangeRequest(cr);
    await queryClient.invalidateQueries({ queryKey: ['change-requests'] });
    return result;
  }, [queryClient]);

  const decideChangeRequest = useCallback(async (
    id: string, decision: "Approved" | "Rejected", adminNote?: string,
  ): Promise<void> => {
    await api.decideChangeRequest(id, decision, adminNote);
    await queryClient.invalidateQueries({ queryKey: ['change-requests'] });
  }, [queryClient]);

  const patchChangeRequest = useCallback(async (
    id: string, body: { status?: string; adminNote?: string },
  ): Promise<void> => {
    await api.patchChangeRequest(id, body);
    await queryClient.invalidateQueries({ queryKey: ['change-requests'] });
  }, [queryClient]);

  // -------------------------------------------------------------------------
  // Mutations — audit
  // -------------------------------------------------------------------------
  const logAudit = useCallback(async (e: Omit<AuditEvent, "id" | "timestamp">): Promise<void> => {
    await api.createAuditEvent(e);
    await queryClient.invalidateQueries({ queryKey: ['audit-events'] });
  }, [queryClient]);

  void localDateStringToISO;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  const value: DataCtx = {
    units, personRoles, privileges, persons,
    categories: seedCategories,
    groups, competencies, steps,
    assignments, observations, achievements, selfAssessments,
    changeRequests, auditEvents,
    getPersonStage, getDaysSinceStart, getCompetencyProgress,
    recordSelfAssessment, recordObservation, recordAchievement,
    reassignPreceptor,
    upsertCompetency, upsertSteps,
    upsertGroup, removeGroup,
    upsertAssignment, removeAssignment,
    submitChangeRequest, decideChangeRequest, patchChangeRequest,
    logAudit,
    ensurePersonDataLoaded, ensurePersonsDataLoaded,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData(): DataCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useData must be used within <DataProvider>");
  return v;
}
