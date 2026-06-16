import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db';
import { requireAuth, requireRole } from '../middleware/auth';
import { personsScopeFilter } from '../lib/scopeFilter';
import { parseBody } from '../lib/validate';

const router = Router();

const reassignSchema = z.object({
  primaryPreceptorId: z.string().max(36).nullable().optional(),
});

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { where, params } = personsScopeFilter(req.auth!);
    const { rows } = await pool.query(
      `SELECT * FROM persons ${where} ORDER BY name`,
      params,
    );
    res.json(rows.map(toPerson));
  } catch (err) { next(err); }
});

router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM persons WHERE id = $1', [req.params.id]);
    if (rows.length === 0) { res.status(404).json({ error: 'Person not found' }); return; }
    res.json(toPerson(rows[0]));
  } catch (err) { next(err); }
});

router.patch('/:id', requireAuth, requireRole('Administrator', 'UnitLeader'), async (req, res, next) => {
  try {
    const { primaryPreceptorId } = parseBody(reassignSchema, req.body);

    if (req.auth!.systemRole === 'UnitLeader') {
      const { rows: targetRows } = await pool.query('SELECT unit_id FROM persons WHERE id = $1', [req.params.id]);
      if (targetRows.length === 0) { res.status(404).json({ error: 'Person not found' }); return; }
      if (!req.auth!.unitIds?.includes(targetRows[0].unit_id)) {
        res.status(403).json({ error: 'Not authorized for this person\'s unit' });
        return;
      }
    }

    const { rowCount } = await pool.query(
      'UPDATE persons SET primary_preceptor_id = $1 WHERE id = $2',
      [primaryPreceptorId ?? null, req.params.id],
    );
    if (!rowCount) { res.status(404).json({ error: 'Person not found' }); return; }
    const { rows } = await pool.query('SELECT * FROM persons WHERE id = $1', [req.params.id]);
    res.json(toPerson(rows[0]));
  } catch (err) { next(err); }
});

function toPerson(r: Record<string, unknown>) {
  return {
    id: r.id,
    username: r.username ?? undefined,
    name: r.name,
    unitId: r.unit_id,
    roleId: r.role_id ?? undefined,
    primaryPreceptorId: r.primary_preceptor_id ?? undefined,
    startDate: (r.start_date as Date).toISOString().slice(0, 10),
    stageOverride: r.stage_override ?? undefined,
    dukeNetid: r.duke_netid ?? undefined,
    jobCode: r.job_code ?? undefined,
  };
}

export default router;
