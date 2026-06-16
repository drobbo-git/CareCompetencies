import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db';
import { requireAuth } from '../middleware/auth';
import { upsertPersonByNetId } from '../lib/personUpsert';
import { parseBody } from '../lib/validate';

const upsertPersonSchema = z.object({
  name: z.string().trim().min(1).max(200),
  unitId: z.string().min(1).max(64),
  roleId: z.string().max(64).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be in YYYY-MM-DD format'),
  jobCode: z.string().max(32).optional(),
  stageOverride: z.enum(['Core', 'Orientation', 'Education', 'FullyOriented', 'Nonclinical']).optional(),
});

const router = Router();

// All integration endpoints are administrator-only.
router.use(requireAuth, (req, res, next) => {
  if (req.auth!.systemRole !== 'Administrator') {
    res.status(403).json({ error: 'Administrator access required' });
    return;
  }
  next();
});

// ---------------------------------------------------------------------------
// GET /integration/persons/:netid/competencies
// Returns a person's signed-off competencies; optionally includes assigned-but-
// not-yet-achieved competencies when include_in_progress=true.
// ---------------------------------------------------------------------------
router.get('/persons/:netid/competencies', async (req, res, next) => {
  try {
    const { netid } = req.params;
    const includeInProgress = req.query.include_in_progress === 'true';

    const { rows: pRows } = await pool.query(
      `SELECT p.id, p.username, p.duke_netid, p.name, p.unit_id, p.role_id, p.start_date,
              u.name AS unit_name, pr.name AS role_name
       FROM persons p
       LEFT JOIN units u ON u.id = p.unit_id
       LEFT JOIN person_roles pr ON pr.id = p.role_id
       WHERE p.username = $1 OR p.duke_netid = $2`,
      [netid, netid],
    );

    if (pRows.length === 0) {
      res.status(404).json({ error: `No person found with NetID '${netid}'` });
      return;
    }

    const p = pRows[0];

    const { rows: achRows } = await pool.query(
      `SELECT ca.competency_id, ca.achieved_at, ca.notes, ca.earned_at_unit_id, c.name AS competency_name
       FROM competency_achievements ca
       JOIN competencies c ON c.id = ca.competency_id
       WHERE ca.person_id = $1
       ORDER BY ca.achieved_at DESC`,
      [p.id],
    );

    const result: Record<string, unknown> = {
      person_id: p.id,
      netid: p.username ?? p.duke_netid,
      display_name: p.name,
      home_unit: p.unit_name,
      home_unit_id: p.unit_id,
      clinical_role: p.role_name,
      signed_off_competencies: achRows.map((r) => ({
        competency_id: r.competency_id,
        name: r.competency_name,
        achieved_at: (r.achieved_at as Date).toISOString(),
        ...(r.notes ? { notes: r.notes } : {}),
        ...(r.earned_at_unit_id ? { earned_at_unit_id: r.earned_at_unit_id } : {}),
      })),
    };

    if (includeInProgress && p.unit_id && p.role_id) {
      const achievedIds = new Set(achRows.map((r) => r.competency_id as string));
      const { rows: asgRows } = await pool.query(
        `SELECT a.competency_id, a.stage, c.name AS competency_name
         FROM competency_assignments a
         JOIN competencies c ON c.id = a.competency_id
         WHERE a.unit_id = $1 AND a.role_id = $2`,
        [p.unit_id, p.role_id],
      );
      result.in_progress_competencies = asgRows
        .filter((r) => !achievedIds.has(r.competency_id as string))
        .map((r) => ({
          competency_id: r.competency_id,
          name: r.competency_name,
          required_at_stage: r.stage,
        }));
    }

    res.json(result);
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// GET /integration/competencies/:id/persons
// Returns everyone who has signed off a given competency.
// Optional query params:
//   unit_ids=u1,u2         — restrict to these home units
//   exclude_unit_ids=u3    — exclude these home units
// ---------------------------------------------------------------------------
router.get('/competencies/:id/persons', async (req, res, next) => {
  try {
    const { id } = req.params;
    const unitIds      = (req.query.unit_ids         as string | undefined)?.split(',').filter(Boolean) ?? [];
    const excludeIds   = (req.query.exclude_unit_ids as string | undefined)?.split(',').filter(Boolean) ?? [];

    const { rows: cRows } = await pool.query(
      'SELECT id, name FROM competencies WHERE id = $1',
      [id],
    );
    if (cRows.length === 0) {
      res.status(404).json({ error: 'Competency not found' });
      return;
    }

    const params: unknown[] = [id];
    let unitFilter = '';
    if (unitIds.length > 0) {
      const ph = unitIds.map((_, i) => `$${i + 2}`).join(',');
      unitFilter = ` AND p.unit_id IN (${ph})`;
      params.push(...unitIds);
    } else if (excludeIds.length > 0) {
      const ph = excludeIds.map((_, i) => `$${i + 2}`).join(',');
      unitFilter = ` AND p.unit_id NOT IN (${ph})`;
      params.push(...excludeIds);
    }

    const { rows } = await pool.query(
      `SELECT ca.person_id, ca.achieved_at,
              p.name, p.username, p.duke_netid, p.unit_id,
              u.name AS unit_name, pr.name AS role_name
       FROM competency_achievements ca
       JOIN persons p ON p.id = ca.person_id
       LEFT JOIN units u ON u.id = p.unit_id
       LEFT JOIN person_roles pr ON pr.id = p.role_id
       WHERE ca.competency_id = $1${unitFilter}
       ORDER BY u.name, p.name`,
      params,
    );

    res.json({
      competency_id: id,
      competency_name: cRows[0].name,
      count: rows.length,
      persons: rows.map((r) => ({
        person_id: r.person_id,
        netid: r.username ?? r.duke_netid,
        name: r.name,
        home_unit: r.unit_name,
        home_unit_id: r.unit_id,
        clinical_role: r.role_name,
        achieved_at: (r.achieved_at as Date).toISOString(),
      })),
    });
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// PUT /integration/persons/:netid
// HR-sync upsert: creates or updates a person record keyed on NetID.
// Required body: { name, unitId, startDate }
// Optional body: { roleId, jobCode, stageOverride }
// ---------------------------------------------------------------------------
router.put('/persons/:netid', async (req, res, next) => {
  try {
    const { netid } = req.params;
    const { name, unitId, roleId, startDate, jobCode, stageOverride } = parseBody(upsertPersonSchema, req.body);

    const result = await upsertPersonByNetId({ netid, name, unitId, roleId, startDate, jobCode, stageOverride });
    res.json(result);
  } catch (err) { next(err); }
});

export default router;
