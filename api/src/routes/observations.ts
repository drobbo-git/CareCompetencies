import { Router } from 'express';
import { pool } from '../db';
import { requireAuth } from '../middleware/auth';
import crypto from 'crypto';

const router = Router();

router.get('/', requireAuth, async (_req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM step_observations ORDER BY observed_at DESC');
    res.json(rows.map(toObs));
  } catch (err) { next(err); }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { personId, stepId, competencyId, preceptorId, rating, observedAt, notes } = req.body as {
      personId: string; stepId: string; competencyId: string; preceptorId: string;
      rating: string; observedAt?: string; notes?: string;
    };
    const id = `obs-${crypto.randomUUID().slice(0, 8)}`;
    const ts = observedAt ?? new Date().toISOString();
    await pool.query(
      `INSERT INTO step_observations (id, person_id, step_id, competency_id, preceptor_id, rating, observed_at, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, personId, stepId, competencyId, preceptorId, rating, ts, notes ?? null],
    );
    res.status(201).json({ id, personId, stepId, competencyId, preceptorId, rating, observedAt: ts, notes });
  } catch (err) { next(err); }
});

function toObs(r: Record<string, unknown>) {
  return {
    id: r.id,
    personId: r.person_id,
    stepId: r.step_id,
    competencyId: r.competency_id,
    preceptorId: r.preceptor_id,
    rating: r.rating,
    observedAt: (r.observed_at as Date).toISOString(),
    notes: r.notes ?? undefined,
  };
}

export default router;
