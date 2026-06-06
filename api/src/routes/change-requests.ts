import { Router } from 'express';
import { pool } from '../db';
import { requireAuth } from '../middleware/auth';
import crypto from 'crypto';

const router = Router();

router.get('/', requireAuth, async (_req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM change_requests ORDER BY submitted_at DESC');
    res.json(rows.map(toCR));
  } catch (err) { next(err); }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { requesterId, requesterRole, type, competencyId, rationale } = req.body as {
      requesterId: string; requesterRole: string; type: string;
      competencyId?: string; rationale?: string;
    };
    const id = `cr-${crypto.randomUUID().slice(0, 8)}`;
    const submittedAt = new Date().toISOString();
    await pool.query(
      `INSERT INTO change_requests (id, requester_id, requester_role, type, competency_id, rationale, status, submitted_at)
       VALUES ($1,$2,$3,$4,$5,$6,'Pending',$7)`,
      [id, requesterId, requesterRole, type, competencyId ?? null, rationale ?? null, submittedAt],
    );
    res.status(201).json({ id, requesterId, requesterRole, type, competencyId, rationale, status: 'Pending', submittedAt });
  } catch (err) { next(err); }
});

// PUT /change-requests/:id/decision  { decision: "Approved"|"Rejected", adminNote?: string }
router.put('/:id/decision', requireAuth, async (req, res, next) => {
  try {
    const { decision, adminNote } = req.body as { decision: 'Approved' | 'Rejected'; adminNote?: string };
    if (decision !== 'Approved' && decision !== 'Rejected') {
      res.status(400).json({ error: 'decision must be Approved or Rejected' });
      return;
    }
    const { rowCount } = await pool.query(
      'UPDATE change_requests SET status=$1, admin_note=$2 WHERE id=$3',
      [decision, adminNote ?? null, req.params.id],
    );
    if (!rowCount) { res.status(404).json({ error: 'Change request not found' }); return; }
    res.json({ id: req.params.id, status: decision, adminNote });
  } catch (err) { next(err); }
});

function toCR(r: Record<string, unknown>) {
  return {
    id: r.id,
    requesterId: r.requester_id,
    requesterRole: r.requester_role,
    type: r.type,
    competencyId: r.competency_id ?? undefined,
    rationale: r.rationale ?? undefined,
    status: r.status,
    submittedAt: (r.submitted_at as Date).toISOString(),
    adminNote: r.admin_note ?? undefined,
  };
}

export default router;
