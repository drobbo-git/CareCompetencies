import { Router } from 'express';
import { pool } from '../db';
import { requireAuth } from '../middleware/auth';
import { personScopeFilter } from '../lib/scopeFilter';
import crypto from 'crypto';

const router = Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { where, params } = personScopeFilter(req.auth!, 'person_id');
    const { rows } = await pool.query(
      `SELECT * FROM competency_achievements ${where} ORDER BY achieved_at DESC`,
      params,
    );
    res.json(rows.map(toAch));
  } catch (err) { next(err); }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { personId, competencyId, observerId, achievedAt, notes, earnedAtUnitId } = req.body as {
      personId: string; competencyId: string; observerId: string;
      achievedAt?: string; notes?: string; earnedAtUnitId?: string;
    };
    const id = `ach-${crypto.randomUUID().slice(0, 8)}`;
    const ts = achievedAt ?? new Date().toISOString();
    await pool.query(
      `INSERT INTO competency_achievements (id, person_id, competency_id, observer_id, achieved_at, notes, earned_at_unit_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [id, personId, competencyId, observerId, ts, notes ?? null, earnedAtUnitId ?? null],
    );
    res.status(201).json({ id, personId, competencyId, observerId, achievedAt: ts, notes, earnedAtUnitId });
  } catch (err) { next(err); }
});

function toAch(r: Record<string, unknown>) {
  return {
    id: r.id,
    personId: r.person_id,
    competencyId: r.competency_id,
    observerId: r.observer_id,
    achievedAt: (r.achieved_at as Date).toISOString(),
    notes: r.notes ?? undefined,
    earnedAtUnitId: r.earned_at_unit_id ?? undefined,
  };
}

export default router;
