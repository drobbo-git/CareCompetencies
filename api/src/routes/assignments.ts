import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db';
import { requireAuth, requireRole } from '../middleware/auth';
import { parseBody } from '../lib/validate';
import crypto from 'crypto';

const router = Router();

const STAGES = ['Core', 'Orientation', 'Education'] as const;

const assignmentSchema = z.object({
  competencyId: z.string().min(1).max(64),
  unitId: z.string().min(1).max(64),
  roleId: z.string().min(1).max(64),
  stage: z.enum(STAGES),
});

// Catalog/curriculum authoring — Administrators manage any unit; UnitLeaders
// only their own unit(s) (checked per-route below, since the target unit is
// in the request body for POST and looked up from the row for DELETE).
const canAuthorAssignments = requireRole('Administrator', 'UnitLeader');

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

router.post('/', requireAuth, canAuthorAssignments, async (req, res, next) => {
  try {
    const { id: clientId, ...body } = req.body as { id?: string } & Record<string, unknown>;
    const { competencyId, unitId, roleId, stage } = parseBody(assignmentSchema, body);

    if (req.auth!.systemRole === 'UnitLeader') {
      if (!req.auth!.unitIds?.includes(unitId)) {
        res.status(403).json({ error: 'Not authorized for this unit' });
        return;
      }
      // The client picks the id, and this is an upsert (MERGE) — without this
      // check a UnitLeader could supply another unit's existing assignment id
      // and silently repurpose that row instead of creating their own.
      if (clientId) {
        const { rows: existingRows } = await pool.query(
          'SELECT unit_id FROM competency_assignments WHERE id = $1',
          [clientId],
        );
        if (existingRows.length > 0 && !req.auth!.unitIds?.includes(existingRows[0].unit_id)) {
          res.status(403).json({ error: 'Not authorized to modify this assignment' });
          return;
        }
      }
    }

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

router.delete('/:id', requireAuth, canAuthorAssignments, async (req, res, next) => {
  try {
    if (req.auth!.systemRole === 'UnitLeader') {
      const { rows } = await pool.query(
        'SELECT unit_id FROM competency_assignments WHERE id = $1',
        [req.params.id],
      );
      if (rows.length > 0 && !req.auth!.unitIds?.includes(rows[0].unit_id)) {
        res.status(403).json({ error: 'Not authorized for this unit' });
        return;
      }
    }
    await pool.query('DELETE FROM competency_assignments WHERE id = $1', [req.params.id]);
    res.status(204).end();
  } catch (err) { next(err); }
});

export default router;
