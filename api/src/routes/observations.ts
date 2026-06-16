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
      `SELECT * FROM step_observations ${where} ORDER BY observed_at DESC`,
      params,
    );
    res.json(rows.map(toObs));
  } catch (err) { next(err); }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { personId, stepId, competencyId, observerId, rating, observedAt, notes } = req.body as {
      personId: string; stepId: string; competencyId: string; observerId: string;
      rating: string; observedAt?: string; notes?: string;
    };

    // A preceptor may observe any competency they've personally achieved
    // themselves — not just their home unit's catalog (see CLAUDE.md
    // "Preceptor"). Checked against the authenticated caller, not the
    // client-supplied observerId, so it can't be spoofed. Administrators
    // bypass this so they can bootstrap a brand-new competency's first achiever.
    if (req.auth!.systemRole !== 'Administrator') {
      const { rows } = await pool.query(
        `SELECT 1 FROM competency_achievements WHERE person_id = $1 AND competency_id = $2`,
        [req.auth!.loginId, competencyId],
      );
      if (rows.length === 0) {
        res.status(403).json({ error: 'You have not achieved this competency yourself, so you cannot observe it for someone else.' });
        return;
      }
    }

    const id = `obs-${crypto.randomUUID().slice(0, 8)}`;
    const ts = observedAt ?? new Date().toISOString();
    await pool.query(
      `INSERT INTO step_observations (id, person_id, step_id, competency_id, observer_id, rating, observed_at, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, personId, stepId, competencyId, observerId, rating, ts, notes ?? null],
    );
    res.status(201).json({ id, personId, stepId, competencyId, observerId, rating, observedAt: ts, notes });
  } catch (err) { next(err); }
});

function toObs(r: Record<string, unknown>) {
  return {
    id: r.id,
    personId: r.person_id,
    stepId: r.step_id,
    competencyId: r.competency_id,
    observerId: r.observer_id,
    rating: r.rating,
    observedAt: (r.observed_at as Date).toISOString(),
    notes: r.notes ?? undefined,
  };
}

export default router;
