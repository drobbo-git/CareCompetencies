import { Router } from 'express';
import { pool } from '../db';
import { requireAuth } from '../middleware/auth';
import crypto from 'crypto';

const router = Router();

router.get('/', requireAuth, async (_req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM competency_assignments');
    res.json(rows.map((r) => ({
      id: r.id,
      competencyId: r.competency_id,
      unitId: r.unit_id,
      roleId: r.role_id,
      stage: r.stage,
    })));
  } catch (err) { next(err); }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { id: clientId, competencyId, unitId, roleId, stage } = req.body as {
      id?: string; competencyId: string; unitId: string; roleId: string; stage: string;
    };
    const id = clientId ?? `as-${crypto.randomUUID().slice(0, 8)}`;
    // SQL Server MERGE replaces PostgreSQL ON CONFLICT DO UPDATE.
    // Each $N appears exactly once in the USING clause; the rest reference src.col.
    await pool.query(
      `MERGE INTO competency_assignments AS tgt
       USING (VALUES ($1,$2,$3,$4,$5))
         AS src(id, competency_id, unit_id, role_id, stage)
       ON tgt.id = src.id
       WHEN MATCHED THEN
         UPDATE SET competency_id = src.competency_id, unit_id = src.unit_id,
                    role_id = src.role_id, stage = src.stage
       WHEN NOT MATCHED THEN
         INSERT (id, competency_id, unit_id, role_id, stage)
         VALUES (src.id, src.competency_id, src.unit_id, src.role_id, src.stage);`,
      [id, competencyId, unitId, roleId, stage],
    );
    res.status(201).json({ id, competencyId, unitId, roleId, stage });
  } catch (err) { next(err); }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    await pool.query('DELETE FROM competency_assignments WHERE id = $1', [req.params.id]);
    res.status(204).end();
  } catch (err) { next(err); }
});

export default router;
