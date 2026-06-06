import { Router } from 'express';
import { pool } from '../db';
import { requireAuth } from '../middleware/auth';
import crypto from 'crypto';

const router = Router();

router.get('/', requireAuth, async (_req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM audit_events ORDER BY timestamp DESC LIMIT 500');
    res.json(rows.map(toEvent));
  } catch (err) { next(err); }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { actor, actorRole, type, summary, targetLabel, detail } = req.body as {
      actor: string; actorRole: string; type: string; summary: string;
      targetLabel?: string; detail?: string;
    };
    const id = `aud-${crypto.randomUUID().slice(0, 8)}`;
    const timestamp = new Date().toISOString();
    await pool.query(
      `INSERT INTO audit_events (id, timestamp, actor, actor_role, type, summary, target_label, detail)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, timestamp, actor, actorRole, type, summary, targetLabel ?? null, detail ?? null],
    );
    res.status(201).json({ id, timestamp, actor, actorRole, type, summary, targetLabel, detail });
  } catch (err) { next(err); }
});

function toEvent(r: Record<string, unknown>) {
  return {
    id: r.id,
    timestamp: (r.timestamp as Date).toISOString(),
    actor: r.actor,
    actorRole: r.actor_role,
    type: r.type,
    summary: r.summary,
    targetLabel: r.target_label ?? undefined,
    detail: r.detail ?? undefined,
  };
}

export default router;
