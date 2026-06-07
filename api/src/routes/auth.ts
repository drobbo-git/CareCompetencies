import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../db';
import { requireAuth } from '../middleware/auth';

const router = Router();

// ---------------------------------------------------------------------------
// Synthesize login objects from persons + person_privileges.
// Each person gets one login entry; effective role = highest privilege.
// Precedence: Administrator > UnitLeader > Preceptor > Person
// ---------------------------------------------------------------------------
const ROLE_RANK: Record<string, number> = {
  Administrator: 3,
  UnitLeader: 2,
  Preceptor: 1,
  Person: 0,
};

async function buildLogins() {
  const { rows: privRows } = await pool.query(
    'SELECT person_id, privilege, unit_id FROM person_privileges',
  );

  // Group privileges by person
  const byPerson = new Map<string, { role: string; unitIds: string[] }>();
  for (const r of privRows) {
    const existing = byPerson.get(r.person_id);
    const rank = ROLE_RANK[r.privilege] ?? 0;
    if (!existing || rank > (ROLE_RANK[existing.role] ?? 0)) {
      byPerson.set(r.person_id, { role: r.privilege, unitIds: r.unit_id ? [r.unit_id] : [] });
    } else if (existing.role === r.privilege && r.unit_id) {
      existing.unitIds.push(r.unit_id);
    }
  }

  const { rows: personRows } = await pool.query(
    'SELECT id, name FROM persons ORDER BY name',
  );

  const logins: any[] = [];
  let orienteeAdded = false;

  for (const p of personRows) {
    const priv = byPerson.get(p.id);
    if (!priv) {
      // Only add one orientee entry to keep the dropdown manageable
      if (!orienteeAdded) {
        logins.push({ id: p.id, displayName: `${p.name} (Orientee)`, systemRole: 'Person', unitIds: undefined });
        orienteeAdded = true;
      }
      continue;
    }
    const unitIds = priv.unitIds.length > 0 ? priv.unitIds : undefined;
    logins.push({ id: p.id, displayName: formatDisplayName(p.name, priv.role), systemRole: priv.role, unitIds });
  }

  return logins;
}

function formatDisplayName(name: string, role: string): string {
  switch (role) {
    case 'Administrator': return `${name} (Administrator)`;
    case 'UnitLeader':    return `${name} (Unit Leader)`;
    case 'Preceptor':     return `${name} (Preceptor)`;
    default:              return `${name} (Orientee)`;
  }
}

// Public — list all logins for the login-page dropdown
router.get('/logins', async (_req, res, next) => {
  try {
    res.json(await buildLogins());
  } catch (err) {
    next(err);
  }
});

// Public — exchange username + password for a JWT
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body as { username?: string; password?: string };
    if (!username || !password) {
      res.status(400).json({ error: 'username and password are required' });
      return;
    }

    const devPassword = process.env.DEV_PASSWORD ?? 'duke24';
    if (password !== devPassword) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const { rows } = await pool.query(
      'SELECT id, name FROM persons WHERE username = $1',
      [username.toLowerCase().trim()],
    );
    if (rows.length === 0) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const person = rows[0];
    const { rows: privRows } = await pool.query(
      'SELECT privilege, unit_id FROM person_privileges WHERE person_id = $1',
      [person.id],
    );

    // Determine effective role and collect unit IDs for that role
    let role = 'Person';
    const unitIdsByPriv = new Map<string, string[]>();
    for (const r of privRows) {
      if (!unitIdsByPriv.has(r.privilege)) unitIdsByPriv.set(r.privilege, []);
      if (r.unit_id) unitIdsByPriv.get(r.privilege)!.push(r.unit_id);
      if ((ROLE_RANK[r.privilege] ?? 0) > (ROLE_RANK[role] ?? 0)) role = r.privilege;
    }

    // For UnitLeaders, combine Preceptor + UnitLeader unit IDs (they may differ)
    const unitIds = role === 'UnitLeader'
      ? [...new Set([...(unitIdsByPriv.get('UnitLeader') ?? []), ...(unitIdsByPriv.get('Preceptor') ?? [])])]
      : (unitIdsByPriv.get(role) ?? []);

    const login = {
      id: person.id,
      displayName: formatDisplayName(person.name, role),
      systemRole: role,
      unitIds: unitIds.length > 0 ? unitIds : undefined,
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
