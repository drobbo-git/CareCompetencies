import { Router } from 'express';
import { pool } from '../db';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.get('/', requireAuth, async (_req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM persons ORDER BY name');
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

router.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    const { primaryPreceptorId } = req.body as { primaryPreceptorId?: string | null };
    const { rows } = await pool.query(
      'UPDATE persons SET primary_preceptor_id = $1 WHERE id = $2 RETURNING *',
      [primaryPreceptorId ?? null, req.params.id],
    );
    if (rows.length === 0) { res.status(404).json({ error: 'Person not found' }); return; }
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
    dukeId: r.duke_id ?? undefined,
    jobCode: r.job_code ?? undefined,
  };
}

export default router;
