import type {
  Unit, PersonRole, Person, PersonPrivilege,
  CompetencyGroup, Competency, CompetencyStep,
  CompetencyAssignment, StepObservation, CompetencyAchievement,
  SelfAssessment, SelfAssessmentConfidence, SelfAssessmentRating,
  ChangeRequest, AuditEvent, Login,
  ImportJobSummary, ImportJobDetail,
} from '@/data/types';

const BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:3001';
const TOKEN_KEY = 'carecompetencies.auth.token';

function getToken(): string {
  try { return localStorage.getItem(TOKEN_KEY) ?? ''; } catch { return ''; }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const t = getToken();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(`${method} ${path} → ${res.status}: ${msg}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

function personScopeQuery(opts?: { personId?: string; personIds?: string[] }): string {
  if (opts?.personId) return `?personId=${encodeURIComponent(opts.personId)}`;
  if (opts?.personIds?.length) return `?personIds=${opts.personIds.map(encodeURIComponent).join(',')}`;
  return '';
}

const get = <T>(path: string) => request<T>('GET', path);
const post = <T>(path: string, body: unknown) => request<T>('POST', path, body);
const put = <T>(path: string, body: unknown) => request<T>('PUT', path, body);
const patch = <T>(path: string, body: unknown) => request<T>('PATCH', path, body);
const del = (path: string) => request<void>('DELETE', path);

export const api = {
  // auth — public endpoints (no token required)
  login: (username: string, password: string) => post<{ token: string; login: Login }>('/auth/login', { username, password }),

  // reference — read-only
  getUnits:           () => get<Unit[]>('/units'),
  getPersonRoles:     () => get<PersonRole[]>('/person-roles'),
  getPersonPrivileges: () => get<PersonPrivilege[]>('/person-privileges'),

  // persons — pageSize=2000 covers the largest realistic unit roster in one page
  getPersons: () =>
    get<{ data: Person[]; hasMore: boolean; page: number; pageSize: number }>('/persons?pageSize=2000')
      .then((r) => r.data),
  patchPerson: (id: string, data: { primaryPreceptorId?: string | null }) => patch<Person>(`/persons/${id}`, data),

  // groups
  getGroups:    () => get<CompetencyGroup[]>('/competencies/groups'),
  createGroup:  (g: Omit<CompetencyGroup, 'id'> & { id?: string }) => post<CompetencyGroup>('/competencies/groups', g),
  updateGroup:  (id: string, g: Omit<CompetencyGroup, 'id'>) => put<CompetencyGroup>(`/competencies/groups/${id}`, g),
  deleteGroup:  (id: string) => del(`/competencies/groups/${id}`),

  // competencies
  getCompetencies:    () => get<Competency[]>('/competencies'),
  createCompetency:   (c: Omit<Competency, 'id'> & { id?: string }) => post<Competency>('/competencies', c),
  updateCompetency:   (id: string, c: Omit<Competency, 'id'>) => put<Competency>(`/competencies/${id}`, c),

  // steps — bulk load for app boot; per-competency update
  getAllSteps:   () => get<CompetencyStep[]>('/competencies/steps'),
  updateSteps:  (competencyId: string, steps: Array<{ id?: string; name: string; orderIndex: number }>) =>
    put<CompetencyStep[]>(`/competencies/${competencyId}/steps`, steps),

  // assignments
  getAssignments:    () => get<CompetencyAssignment[]>('/competency-assignments'),
  createAssignment:  (a: Omit<CompetencyAssignment, 'id'> & { id?: string }) => post<CompetencyAssignment>('/competency-assignments', a),
  deleteAssignment:  (id: string) => del(`/competency-assignments/${id}`),

  // observations — scoped to own rows for Preceptors; UnitLeaders use the
  // aggregation endpoints below. pageSize=2000 covers any realistic roster.
  getObservations:   (opts?: { personId?: string; personIds?: string[] }) =>
    get<StepObservation[]>(`/step-observations${personScopeQuery(opts)}`),
  createObservation: (o: Omit<StepObservation, 'id' | 'observedAt'> & { observedAt?: string }) =>
    post<StepObservation>('/step-observations', o),

  // Aggregated observation data — tiny payloads for UnitLeader dashboard widgets.
  // weekly-summary: 0–12 rows (one per week) instead of ~5k raw observation rows.
  // last-activity: one row per person who has any observations in scope.
  getObsWeeklySummary: () =>
    get<{ week: string; sat: number; unsat: number }[]>('/step-observations/weekly-summary'),
  getObsLastActivity: () =>
    get<{ personId: string; lastObservedAt: string }[]>('/step-observations/last-activity'),

  // achievements — same personId/personIds scoping as observations above.
  // pageSize=2000 covers any single unit's achievements in one page; the
  // global fetch for Administrators is disabled in store.tsx to avoid
  // pulling 500k rows (see api/loadtest/README.md for context).
  getAchievements:   (opts?: { personId?: string; personIds?: string[] }) => {
    let qs = '?pageSize=2000';
    if (opts?.personId) qs += `&personId=${encodeURIComponent(opts.personId)}`;
    else if (opts?.personIds?.length) qs += `&personIds=${opts.personIds.map(encodeURIComponent).join(',')}`;
    return get<{ data: CompetencyAchievement[]; hasMore: boolean; page: number; pageSize: number }>(
      `/competency-achievements${qs}`,
    ).then((r) => r.data);
  },
  createAchievement: (a: Omit<CompetencyAchievement, 'id' | 'achievedAt'> & { achievedAt?: string }) =>
    post<CompetencyAchievement>('/competency-achievements', a),

  // self-assessments — person rates own confidence per step before working with a preceptor
  getSelfAssessments: (opts?: { personId?: string; personIds?: string[] }) => {
    let qs = '?pageSize=2000';
    if (opts?.personId) qs += `&personId=${encodeURIComponent(opts.personId)}`;
    else if (opts?.personIds?.length) qs += `&personIds=${opts.personIds.map(encodeURIComponent).join(',')}`;
    return get<{ data: SelfAssessment[]; hasMore: boolean; page: number; pageSize: number }>(
      `/self-assessments${qs}`,
    ).then((r) => r.data);
  },
  createSelfAssessment: (sa: {
    competencyId: string;
    overallRating: SelfAssessmentRating;
    notes?: string;
    steps: Array<{ stepId: string; confidence: SelfAssessmentConfidence }>;
  }) => post<SelfAssessment>('/self-assessments', sa),

  // change requests
  getChangeRequests:    () => get<ChangeRequest[]>('/change-requests'),
  createChangeRequest:  (cr: Omit<ChangeRequest, 'id' | 'submittedAt' | 'status'>) =>
    post<ChangeRequest>('/change-requests', cr),
  decideChangeRequest:  (id: string, decision: 'Approved' | 'Rejected', adminNote?: string) =>
    put<{ id: string; status: string; adminNote?: string }>(`/change-requests/${id}/decision`, { decision, adminNote }),
  patchChangeRequest:   (id: string, body: { status?: string; adminNote?: string }) =>
    patch<{ id: string }>(`/change-requests/${id}`, body),

  // audit
  getAuditEvents:   () => get<{ data: AuditEvent[] }>('/audit-events').then((r) => r.data),
  createAuditEvent: (e: Omit<AuditEvent, 'id' | 'timestamp'>) => post<AuditEvent>('/audit-events', e),

  // integration (admin only — direct API calls, not TanStack-cached)
  integrationGetPersonCompetencies: (netid: string, includeInProgress: boolean) =>
    get<Record<string, unknown>>(
      `/integration/persons/${encodeURIComponent(netid)}/competencies${includeInProgress ? '?include_in_progress=true' : ''}`,
    ),
  integrationGetCompetencyPersons: (competencyId: string, unitIds: string[], excludeUnitIds: string[]) => {
    const qs = new URLSearchParams();
    if (unitIds.length) qs.set('unit_ids', unitIds.join(','));
    else if (excludeUnitIds.length) qs.set('exclude_unit_ids', excludeUnitIds.join(','));
    const q = qs.toString();
    return get<Record<string, unknown>>(
      `/integration/competencies/${encodeURIComponent(competencyId)}/persons${q ? `?${q}` : ''}`,
    );
  },
  integrationUpsertPerson: (netid: string, body: {
    name: string; unitId: string; roleId?: string;
    startDate: string; jobCode?: string; stageOverride?: string;
  }) => put<Record<string, unknown>>(`/integration/persons/${encodeURIComponent(netid)}`, body),

  // imports — admin-triggered bulk loads (e.g. person CSV upload)
  getImportJobs:    () => get<ImportJobSummary[]>('/imports'),
  getImportJob:     (id: string) => get<ImportJobDetail>(`/imports/${id}`),
  createPersonImportJob: (filename: string, content: string) =>
    post<ImportJobSummary>('/imports/users', { filename, content }),
};
