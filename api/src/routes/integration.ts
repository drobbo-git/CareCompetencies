import { Router } from 'express';
import { pool } from '../db';
import { requireAuth } from '../middleware/auth';
import crypto from 'crypto';

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
    const { name, unitId, roleId, startDate, jobCode, stageOverride } = req.body as {
      name: string; unitId: string; roleId?: string; startDate: string;
      jobCode?: string; stageOverride?: string;
    };

    if (!name?.trim() || !unitId || !startDate) {
      res.status(400).json({ error: 'name, unitId, and startDate are required' });
      return;
    }

    const { rows: existing } = await pool.query(
      'SELECT id FROM persons WHERE username = $1 OR duke_netid = $2',
      [netid, netid],
    );

    if (existing.length > 0) {
      const personId = existing[0].id;
      await pool.query(
        `UPDATE persons
         SET name=$1, unit_id=$2, role_id=$3, start_date=$4,
             job_code=$5, stage_override=$6, username=$7, duke_netid=$8
         WHERE id=$9`,
        [name.trim(), unitId, roleId ?? null, startDate,
         jobCode ?? null, stageOverride ?? null, netid, netid, personId],
      );
      const { rows } = await pool.query('SELECT * FROM persons WHERE id = $1', [personId]);
      res.json({ action: 'updated', person: toPerson(rows[0]) });
    } else {
      const id = crypto.randomUUID();
      await pool.query(
        `INSERT INTO persons (id, username, duke_netid, name, unit_id, role_id, start_date, job_code, stage_override)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [id, netid, netid, name.trim(), unitId, roleId ?? null, startDate,
         jobCode ?? null, stageOverride ?? null],
      );
      const { rows } = await pool.query('SELECT * FROM persons WHERE id = $1', [id]);
      res.json({ action: 'created', person: toPerson(rows[0]) });
    }
  } catch (err) { next(err); }
});

function toPerson(r: Record<string, unknown>) {
  return {
    id: r.id,
    netid: r.username ?? r.duke_netid,
    name: r.name,
    unitId: r.unit_id,
    roleId: r.role_id ?? undefined,
    startDate: (r.start_date as Date).toISOString().slice(0, 10),
    stageOverride: r.stage_override ?? undefined,
    jobCode: r.job_code ?? undefined,
  };
}

export default router;
