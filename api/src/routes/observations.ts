import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db';
import { requireAuth } from '../middleware/auth';
import { personScopeFilter, parsePersonScopeOpts } from '../lib/scopeFilter';
import { parseBody } from '../lib/validate';
import crypto from 'crypto';

const router = Router();

const observationSchema = z.object({
  personId: z.string().min(1).max(36),
  stepId: z.string().min(1).max(64),
  competencyId: z.string().min(1).max(64),
  observerId: z.string().min(1).max(36).optional(),
  rating: z.enum(['Satisfactory', 'Unsatisfactory', 'NotObserved']),
  observedAt: z.string().datetime().optional(),
  notes: z.string().max(5000).optional(),
});

// Returns weekly sat/unsat observation counts for the last 12 weeks, scoped to
// the caller's role (unit for UnitLeader, own rows for Preceptor/Person, all for Admin).
// Result is 0–12 rows — no raw observation rows are sent to the client.
router.get('/weekly-summary', requireAuth, async (req, res, next) => {
  try {
    const { where, params } = personScopeFilter(req.auth!, 'person_id');
    const andOrWhere = where ? `${where}\n  AND` : 'WHERE';
    const { rows } = await pool.query(
      `SELECT
        CONVERT(VARCHAR(10),
          DATEADD(DAY,
            -(( DATEPART(WEEKDAY, CONVERT(DATE, observed_at)) + @@DATEFIRST - 2) % 7),
            CONVERT(DATE, observed_at)
          ), 120
        ) AS week,
        COUNT(CASE WHEN rating = 'Satisfactory'   THEN 1 END) AS sat,
        COUNT(CASE WHEN rating = 'Unsatisfactory' THEN 1 END) AS unsat
       FROM step_observations
       ${andOrWhere} observed_at >= DATEADD(WEEK, -12, GETDATE())
       GROUP BY DATEADD(DAY,
           -(( DATEPART(WEEKDAY, CONVERT(DATE, observed_at)) + @@DATEFIRST - 2) % 7),
           CONVERT(DATE, observed_at)
         )
       ORDER BY week`,
      params,
    );
    res.json(rows.map((r) => ({
      week: r.week as string,
      sat: Number(r.sat),
      unsat: Number(r.unsat),
    })));
  } catch (err) { next(err); }
});

// Returns the most recent observation timestamp per person, scoped to the caller's role.
// Used by the UnitLeader dashboard to identify stalled learners without fetching raw rows.
router.get('/last-activity', requireAuth, async (req, res, next) => {
  try {
    const { where, params } = personScopeFilter(req.auth!, 'person_id');
    const { rows } = await pool.query(
      `SELECT person_id, MAX(observed_at) AS last_observed_at
       FROM step_observations
       ${where}
       GROUP BY person_id`,
      params,
    );
    res.json(rows.map((r) => ({
      personId: r.person_id as string,
      lastObservedAt: (r.last_observed_at as Date).toISOString(),
    })));
  } catch (err) { next(err); }
});

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { where, params } = personScopeFilter(req.auth!, 'person_id', parsePersonScopeOpts(req.query));
    const { rows } = await pool.query(
      `SELECT * FROM step_observations ${where} ORDER BY observed_at DESC`,
      params,
    );
    res.json(rows.map(toObs));
  } catch (err) { next(err); }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const body = parseBody(observationSchema, req.body);
    const { personId, stepId, competencyId, rating, observedAt, notes } = body;
    // Attribution comes from the authenticated session for everyone except
    // Administrators, who may attribute to a specific preceptor when
    // bootstrapping/importing historical records.
    const observerId = req.auth!.systemRole === 'Administrator' && body.observerId
      ? body.observerId
      : req.auth!.loginId;

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
