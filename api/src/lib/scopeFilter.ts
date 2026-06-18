import type { AuthPayload } from '../middleware/auth';

interface ScopeFilter {
  where: string;
  params: unknown[];
}

/** Parses ?personId=x or ?personIds=a,b,c from a route's req.query. */
export function parsePersonScopeOpts(query: Record<string, unknown>): PersonScopeOpts {
  const personId = typeof query.personId === 'string' ? query.personId : undefined;
  const personIds = typeof query.personIds === 'string'
    ? query.personIds.split(',').map((s) => s.trim()).filter(Boolean)
    : undefined;
  return { personId, personIds };
}

export interface PersonScopeOpts {
  /** Narrow to one specific person (e.g. the learner currently being viewed). */
  personId?: string;
  /** Narrow to a specific small set of people (e.g. a preceptor's roster). */
  personIds?: string[];
}

/**
 * Builds a WHERE clause scoping a query to the caller's visible persons,
 * for tables that reference persons via a foreign-key column (e.g. person_id,
 * requester_id). Admins see everything; unit leaders see their units;
 * persons see only themselves.
 *
 * Preceptors default to their OWN rows only — at production volume (this
 * column backs step_observations/competency_achievements, ~1.5M/500k rows),
 * "no restriction" meant every preceptor's page load fetched the entire
 * table, which load-testing confirmed crashes the API under realistic
 * concurrency (see api/loadtest/README.md). Preceptors can still look up
 * any specific learner's rows — scope is on competencies, not which persons
 * they can observe — but must ask for it via personId/personIds rather than
 * receiving everyone's data by default.
 */
export function personScopeFilter(auth: AuthPayload, column: string, opts?: PersonScopeOpts): ScopeFilter {
  const { systemRole, loginId, unitIds } = auth;
  const requestedIds = opts?.personId ? [opts.personId] : opts?.personIds;

  if (systemRole === 'Administrator') {
    if (requestedIds && requestedIds.length > 0) {
      const placeholders = requestedIds.map((_, i) => `$${i + 1}`).join(',');
      return { where: `WHERE ${column} IN (${placeholders})`, params: requestedIds };
    }
    return { where: '', params: [] };
  }

  if (systemRole === 'Preceptor') {
    const ids = requestedIds && requestedIds.length > 0 ? requestedIds : [loginId];
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
    return { where: `WHERE ${column} IN (${placeholders})`, params: ids };
  }

  if (systemRole === 'Person') {
    return { where: `WHERE ${column} = $1`, params: [loginId] };
  }

  // UnitLeader — bounded by unit size already, so no need to change the
  // default; requestedIds (if given) just narrows further within it.
  const ids = unitIds ?? [];
  if (ids.length === 0) return { where: 'WHERE 1=0', params: [] };
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
  let where = `WHERE ${column} IN (SELECT id FROM persons WHERE unit_id IN (${placeholders}))`;
  const params: unknown[] = [...ids];
  if (requestedIds && requestedIds.length > 0) {
    const idPlaceholders = requestedIds.map((_, i) => `$${i + 1 + params.length}`).join(',');
    where += ` AND ${column} IN (${idPlaceholders})`;
    params.push(...requestedIds);
  }
  return { where, params };
}

/**
 * Same logic but for the persons table itself (filter on id / unit_id /
 * primary_preceptor_id directly rather than via a subquery).
 */
export function personsScopeFilter(auth: AuthPayload): ScopeFilter {
  const { systemRole, loginId, unitIds } = auth;

  if (systemRole === 'Administrator') return { where: '', params: [] };

  // Preceptors can teach any learner — scope is on competencies (unit catalog),
  // not on which persons they can observe.
  if (systemRole === 'Preceptor') return { where: '', params: [] };

  if (systemRole === 'Person') {
    return { where: 'WHERE id = $1', params: [loginId] };
  }

  // UnitLeader
  const ids = unitIds ?? [];
  if (ids.length === 0) return { where: 'WHERE 1=0', params: [] };
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
  return { where: `WHERE unit_id IN (${placeholders})`, params: ids };
}

/**
 * Parses ?page and ?pageSize query params. pageSize is capped at 100.
 * Returns SQL OFFSET/FETCH values and the next-param index to continue
 * building a parameterised query.
 */
export function parsePagination(
  query: Record<string, unknown>,
  startParamIndex = 1,
): { page: number; pageSize: number; offset: number; offsetParam: string; fetchParam: string; params: unknown[] } {
  const page     = Math.max(1, parseInt(String(query.page     ?? '1'),  10) || 1);
  const pageSize = Math.min(2000, Math.max(1, parseInt(String(query.pageSize ?? '500'), 10) || 500));
  const offset   = (page - 1) * pageSize;
  return {
    page,
    pageSize,
    offset,
    offsetParam: `$${startParamIndex}`,
    fetchParam:  `$${startParamIndex + 1}`,
    params: [offset, pageSize],
  };
}
