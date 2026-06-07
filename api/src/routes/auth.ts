import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../db';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Public — list all logins for the login-page dropdown
router.get('/logins', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, display_name, system_role, unit_ids FROM logins ORDER BY system_role, display_name',
    );
    res.json(rows.map((r) => ({
      id: r.id,
      displayName: r.display_name,
      systemRole: r.system_role,
      unitIds: r.unit_ids ?? undefined,
    })));
  } catch (err) {
    next(err);
  }
});

// Public — exchange a loginId for a JWT
router.post('/login', async (req, res, next) => {
  try {
    const { loginId } = req.body as { loginId?: string };
    if (!loginId) {
      res.status(400).json({ error: 'loginId is required' });
      return;
    }
    const { rows } = await pool.query(
      'SELECT id, display_name, system_role, unit_ids FROM logins WHERE id = $1',
      [loginId],
    );
    if (rows.length === 0) {
      res.status(404).json({ error: 'Login not found' });
      return;
    }
    const row = rows[0];
    const login = {
      id: row.id,
      displayName: row.display_name,
      systemRole: row.system_role,
      unitIds: row.unit_ids ?? undefined,
    };
    const token = jwt.sign(
      { loginId: login.id, displayName: login.displayName, systemRole: login.systemRole, unitIds: login.unitIds },
      process.env.JWT_SECRET!,
      { expiresIn: '12h' },
    );
    res.json({ token, login });
  } catch (err) {
    next(err);
  }
});

// Protected — verify token and return current login
router.get('/me', requireAuth, (req, res) => {
  res.json(req.auth);
});

export default router;
