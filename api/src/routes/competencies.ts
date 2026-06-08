import { Router } from 'express';
import { pool } from '../db';
import { requireAuth } from '../middleware/auth';
import crypto from 'crypto';

const router = Router();

// --- Groups ---

router.get('/groups', requireAuth, async (_req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM competency_groups ORDER BY name');
    res.json(rows.map((r) => ({
      id: r.id,
      name: r.name,
      parentGroupId: r.parent_group_id ?? undefined,
      orderIndex: r.order_index ?? undefined,
      description: r.description ?? undefined,
    })));
  } catch (err) { next(err); }
});

router.post('/groups', requireAuth, async (req, res, next) => {
  try {
    const { id: clientId, name, parentGroupId, orderIndex, description } = req.body as {
      id?: string; name: string; parentGroupId?: string; orderIndex?: number; description?: string;
    };
    const id = clientId ?? `grp-${crypto.randomUUID().slice(0, 8)}`;
    await pool.query(
      'INSERT INTO competency_groups (id, name, parent_group_id, order_index, description) VALUES ($1,$2,$3,$4,$5)',
      [id, name, parentGroupId ?? null, orderIndex ?? null, description ?? null],
    );
    res.status(201).json({ id, name, parentGroupId, orderIndex, description });
  } catch (err) { next(err); }
});

router.put('/groups/:id', requireAuth, async (req, res, next) => {
  try {
    const { name, parentGroupId, orderIndex, description } = req.body as {
      name: string; parentGroupId?: string; orderIndex?: number; description?: string;
    };
    const { rowCount } = await pool.query(
      'UPDATE competency_groups SET name=$1, parent_group_id=$2, order_index=$3, description=$4 WHERE id=$5',
      [name, parentGroupId ?? null, orderIndex ?? null, description ?? null, req.params.id],
    );
    if (!rowCount) { res.status(404).json({ error: 'Group not found' }); return; }
    res.json({ id: req.params.id, name, parentGroupId, orderIndex, description });
  } catch (err) { next(err); }
});

router.delete('/groups/:id', requireAuth, async (req, res, next) => {
  try {
    await pool.query('DELETE FROM competency_groups WHERE id = $1', [req.params.id]);
    res.status(204).end();
  } catch (err) { next(err); }
});

// --- All steps (bulk fetch for app boot) ---

router.get('/steps', requireAuth, async (_req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM competency_steps ORDER BY competency_id, order_index');
    res.json(rows.map((r) => ({
      id: r.id, competencyId: r.competency_id, name: r.name, orderIndex: r.order_index,
    })));
  } catch (err) { next(err); }
});

// --- Competencies ---

router.get('/', requireAuth, async (_req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM competencies ORDER BY name');
    res.json(rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description ?? undefined,
      groupId: r.group_id ?? undefined,
      categoryId: r.category_id ?? undefined,
      unitIds: r.unit_ids as string[],
      validationMethod: r.validation_method ?? undefined,
      knowledgeSource: r.knowledge_source ?? undefined,
      policySource: r.policy_source ?? undefined,
      updateNote: r.update_note ?? undefined,
    })));
  } catch (err) { next(err); }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { id: clientId, name, description, groupId, categoryId, unitIds } = req.body as {
      id?: string; name: string; description?: string; groupId?: string; categoryId?: string; unitIds: string[];
    };
    const id = clientId ?? `comp-${crypto.randomUUID().slice(0, 8)}`;
    await pool.query(
      'INSERT INTO competencies (id, name, description, group_id, category_id, unit_ids) VALUES ($1,$2,$3,$4,$5,$6)',
      [id, name, description ?? null, groupId ?? null, categoryId ?? null, JSON.stringify(unitIds ?? [])],
    );
    res.status(201).json({ id, name, description, groupId, categoryId, unitIds: unitIds ?? [] });
  } catch (err) { next(err); }
});

router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const { name, description, groupId, categoryId, unitIds } = req.body as {
      name: string; description?: string; groupId?: string; categoryId?: string; unitIds: string[];
    };
    const { rowCount } = await pool.query(
      'UPDATE competencies SET name=$1, description=$2, group_id=$3, category_id=$4, unit_ids=$5 WHERE id=$6',
      [name, description ?? null, groupId ?? null, categoryId ?? null, JSON.stringify(unitIds ?? []), req.params.id],
    );
    if (!rowCount) { res.status(404).json({ error: 'Competency not found' }); return; }
    res.json({ id: req.params.id, name, description, groupId, categoryId, unitIds: unitIds ?? [] });
  } catch (err) { next(err); }
});

// --- Steps (replace all steps for a competency) ---

router.get('/:id/steps', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM competency_steps WHERE competency_id = $1 ORDER BY order_index',
      [req.params.id],
    );
    res.json(rows.map((r) => ({
      id: r.id, competencyId: r.competency_id, name: r.name, orderIndex: r.order_index,
    })));
  } catch (err) { next(err); }
});

router.put('/:id/steps', requireAuth, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const steps = req.body as { id?: string; name: string; orderIndex: number }[];
    await client.query('BEGIN');
    await client.query('DELETE FROM competency_steps WHERE competency_id = $1', [req.params.id]);
    const saved = [];
    for (const s of steps) {
      const stepId = s.id ?? `step-${crypto.randomUUID().slice(0, 8)}`;
      await client.query(
        'INSERT INTO competency_steps (id, competency_id, name, order_index) VALUES ($1,$2,$3,$4)',
        [stepId, req.params.id, s.name, s.orderIndex],
      );
      saved.push({ id: stepId, competencyId: req.params.id, name: s.name, orderIndex: s.orderIndex });
    }
    await client.query('COMMIT');
    res.json(saved);
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

export default router;
