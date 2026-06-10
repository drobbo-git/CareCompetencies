import type { AuthPayload } from '../middleware/auth';

interface ScopeFilter {
  where: string;
  params: unknown[];
}

/**
 * Builds a WHERE clause scoping a query to the caller's visible persons,
 * for tables that reference persons via a foreign-key column (e.g. person_id,
 * requester_id). Admins see everything; unit leaders see their units;
 * preceptors see their orientees; persons see only themselves.
 */
export function personScopeFilter(auth: AuthPayload, column: string): ScopeFilter {
  const { systemRole, loginId, unitIds } = auth;

  if (systemRole === 'Administrator') return { where: '', params: [] };

  if (systemRole === 'Person') {
    return { where: `WHERE ${column} = $1`, params: [loginId] };
  }

  if (systemRole === 'Preceptor') {
    return {
      where: `WHERE ${column} IN (SELECT id FROM persons WHERE primary_preceptor_id = $1)`,
      params: [loginId],
    };
  }

  // UnitLeader
  const ids = unitIds ?? [];
  if (ids.length === 0) return { where: 'WHERE 1=0', params: [] };
  const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
  return {
    where: `WHERE ${column} IN (SELECT id FROM persons WHERE unit_id IN (${placeholders}))`,
    params: ids,
  };
}

/**
 * Same logic but for the persons table itself (filter on id / unit_id /
 * primary_preceptor_id directly rather than via a subquery).
 */
export function personsScopeFilter(auth: AuthPayload): ScopeFilter {
  const { systemRole, loginId, unitIds } = auth;

  if (systemRole === 'Administrator') return { where: '', params: [] };

  if (systemRole === 'Person') {
    return { where: 'WHERE id = $1', params: [loginId] };
  }

  if (systemRole === 'Preceptor') {
    return { where: 'WHERE primary_preceptor_id = $1', params: [loginId] };
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
  const pageSize = Math.min(100, Math.max(1, parseInt(String(query.pageSize ?? '50'), 10) || 50));
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
