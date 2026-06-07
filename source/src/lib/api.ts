import type {
  Unit, PersonRole, Person, PersonPrivilege,
  CompetencyGroup, Competency, CompetencyStep,
  CompetencyAssignment, StepObservation, CompetencyAchievement,
  ChangeRequest, AuditEvent, Login,
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

const get = <T>(path: string) => request<T>('GET', path);
const post = <T>(path: string, body: unknown) => request<T>('POST', path, body);
const put = <T>(path: string, body: unknown) => request<T>('PUT', path, body);
const del = (path: string) => request<void>('DELETE', path);

export const api = {
  // auth — public endpoints (no token required)
  login: (username: string, password: string) => post<{ token: string; login: Login }>('/auth/login', { username, password }),

  // reference — read-only
  getUnits:           () => get<Unit[]>('/units'),
  getPersonRoles:     () => get<PersonRole[]>('/person-roles'),
  getPersonPrivileges: () => get<PersonPrivilege[]>('/person-privileges'),

  // persons
  getPersons: () => get<Person[]>('/persons'),

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

  // observations
  getObservations:   () => get<StepObservation[]>('/step-observations'),
  createObservation: (o: Omit<StepObservation, 'id' | 'observedAt'> & { observedAt?: string }) =>
    post<StepObservation>('/step-observations', o),

  // achievements
  getAchievements:   () => get<CompetencyAchievement[]>('/competency-achievements'),
  createAchievement: (a: Omit<CompetencyAchievement, 'id' | 'achievedAt'> & { achievedAt?: string }) =>
    post<CompetencyAchievement>('/competency-achievements', a),

  // change requests
  getChangeRequests:    () => get<ChangeRequest[]>('/change-requests'),
  createChangeRequest:  (cr: Omit<ChangeRequest, 'id' | 'submittedAt' | 'status'>) =>
    post<ChangeRequest>('/change-requests', cr),
  decideChangeRequest:  (id: string, decision: 'Approved' | 'Rejected', adminNote?: string) =>
    put<{ id: string; status: string; adminNote?: string }>(`/change-requests/${id}/decision`, { decision, adminNote }),

  // audit
  getAuditEvents:   () => get<AuditEvent[]>('/audit-events'),
  createAuditEvent: (e: Omit<AuditEvent, 'id' | 'timestamp'>) => post<AuditEvent>('/audit-events', e),
};
