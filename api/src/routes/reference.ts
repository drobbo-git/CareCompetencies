// Read-only reference data: units, person-roles, person-privileges
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
    res.json(rows.map((r) => ({ id: r.id, name: r.name })));
  } catch (err) { next(err); }
});

router.get('/person-privileges', requireAuth, async (req, res, next) => {
  try {
    const { systemRole, loginId, unitIds } = req.auth!;
    let where = '';
    let params: unknown[] = [];

    if (systemRole === 'UnitLeader') {
      const ids = unitIds ?? [];
      if (ids.length > 0) {
        const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
        where = `WHERE unit_id IN (${placeholders})`;
        params = ids;
      } else {
        where = 'WHERE 1=0';
      }
    } else if (systemRole !== 'Administrator') {
      where = 'WHERE person_id = $1';
      params = [loginId];
    }

    const { rows } = await pool.query(
      `SELECT * FROM person_privileges ${where} ORDER BY person_id`,
      params,
    );
    res.json(rows.map((r) => ({
      id: r.id,
      personId: r.person_id,
      privilege: r.privilege,
      unitId: r.unit_id ?? null,
    })));
  } catch (err) { next(err); }
});

export default router;
