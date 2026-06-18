import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db';
import { requireAuth } from '../middleware/auth';
import { personScopeFilter, parsePersonScopeOpts, parsePagination } from '../lib/scopeFilter';
import { parseBody } from '../lib/validate';
import crypto from 'crypto';

const router = Router();

const achievementSchema = z.object({
  personId: z.string().min(1).max(36),
  competencyId: z.string().min(1).max(64),
  observerId: z.string().min(1).max(36).optional(),
  achievedAt: z.string().datetime().optional(),
  notes: z.string().max(5000).optional(),
  earnedAtUnitId: z.string().max(64).optional(),
});

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { where, params: scopeParams } = personScopeFilter(req.auth!, 'person_id', parsePersonScopeOpts(req.query));
    const pag = parsePagination(req.query, scopeParams.length + 1);
    const [{ rows }, { rows: countRows }] = await Promise.all([
      pool.query(
        `SELECT * FROM competency_achievements ${where} ORDER BY achieved_at DESC
         OFFSET ${pag.offsetParam} ROWS FETCH NEXT ${pag.fetchParam} ROWS ONLY`,
        [...scopeParams, ...pag.params],
      ),
      pool.query(
        `SELECT COUNT(*) AS total FROM competency_achievements ${where}`,
        scopeParams,
      ),
    ]);
    res.json({ data: rows.map(toAch), total: Number(countRows[0].total), page: pag.page, pageSize: pag.pageSize });
  } catch (err) { next(err); }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const body = parseBody(achievementSchema, req.body);
    const { personId, competencyId, achievedAt, notes, earnedAtUnitId } = body;
    // Attribution comes from the authenticated session for everyone except
    // Administrators, who may attribute to a specific preceptor when
    // bootstrapping/importing historical records.
    const observerId = req.auth!.systemRole === 'Administrator' && body.observerId
      ? body.observerId
      : req.auth!.loginId;

    // A preceptor may sign off any competency they've personally achieved
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
        res.status(403).json({ error: 'You have not achieved this competency yourself, so you cannot sign it off for someone else.' });
        return;
      }
    }

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
