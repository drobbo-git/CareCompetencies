// Read-only reference data: units, person-roles, preceptors, administrators
import { Router } from 'express';
import { pool } from '../db';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.get('/units', requireAuth, async (_req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM units ORDER BY name');
    res.json(rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description ?? undefined,
      createdAt: r.created_at?.toISOString(),
      updatedAt: r.updated_at?.toISOString(),
    })));
  } catch (err) { next(err); }
});

router.get('/person-roles', requireAuth, async (_req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM person_roles ORDER BY name');
    res.json(rows.map((r) => ({ id: r.id, code: r.code, name: r.name })));
  } catch (err) { next(err); }
});

router.get('/preceptors', requireAuth, async (_req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM preceptors ORDER BY name');
    res.json(rows.map((r) => ({
      id: r.id,
      name: r.name,
      unitId: r.unit_id,
      email: r.email ?? undefined,
    })));
  } catch (err) { next(err); }
});

router.get('/administrators', requireAuth, async (_req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM administrators ORDER BY name');
    res.json(rows.map((r) => ({
      id: r.id,
      name: r.name,
      email: r.email ?? undefined,
      title: r.title ?? undefined,
    })));
  } catch (err) { next(err); }
});

export default router;
