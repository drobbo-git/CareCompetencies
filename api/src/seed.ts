/**
 * Loads carecompetencies_seed.json into the PostgreSQL database.
 * Run once against a fresh database: npm run seed
 *
 * Idempotent: truncates all tables before inserting, so re-running is safe.
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { pool } from './db';

// ---------------------------------------------------------------------------
// Load seed JSON
// ---------------------------------------------------------------------------
const seedPath = path.resolve(__dirname, '../../etl/data/carecompetencies_seed.json');
const raw = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));

// ---------------------------------------------------------------------------
// Translation helpers (mirror source/src/data/seed.ts logic)
// ---------------------------------------------------------------------------
const DEFAULT_ROLE_ID = 'role-rn';

function toUnit(u: any) {
  return {
    id: u.id, name: u.name,
    description: u.description ?? null,
    cost_center: u.costCenter ?? null,
    stage_days: u.stageDays ? JSON.stringify(u.stageDays) : null,
    created_at: u.createdAt ?? null,
    updated_at: u.updatedAt ?? null,
  };
}

function toPersonRole(r: any) {
  return { id: r.id, name: r.name };
}

function toPreceptor(p: any) {
  return {
    id: p.id, name: p.fullName ?? p.name ?? '',
    unit_id: p.unitId, email: p.email ?? null,
  };
}

function toAdmin(a: any) {
  return {
    id: a.id, name: a.fullName ?? a.name ?? '',
    email: a.email ?? null, title: a.title ?? null,
  };
}

function toPerson(n: any) {
  return {
    id: n.id, name: n.fullName ?? n.name ?? '',
    unit_id: n.unitId,
    role_id: n.roleId ?? DEFAULT_ROLE_ID,
    primary_preceptor_id: n.primaryPreceptorId ?? null,
    start_date: n.startDate ?? n.hireDate ?? null,
    stage_override: n.stage ?? n.stageOverride ?? null,
    duke_id: n.dukeId ?? null,
    job_code: n.jobCode ?? null,
  };
}

function toGroup(g: any) {
  return {
    id: g.id, name: g.name,
    parent_group_id: g.parentGroupId ?? null,
    order_index: typeof g.sortOrder === 'number' ? g.sortOrder : (g.orderIndex ?? 0),
    description: g.description ?? null,
  };
}

function toCompetency(c: any) {
  return {
    id: c.id, name: c.name,
    description: c.description ?? null,
    group_id: c.groupId ?? null,
    category_id: c.categoryId ?? null,
    unit_ids: JSON.stringify(Array.isArray(c.unitIds) ? c.unitIds : []),
  };
}

function toStep(s: any) {
  return {
    id: s.id, competency_id: s.competencyId,
    name: s.description ?? s.name ?? '',
    order_index: typeof s.sortOrder === 'number' ? s.sortOrder : (s.orderIndex ?? 0),
  };
}

function toAssignment(a: any) {
  return {
    id: a.id, competency_id: a.competencyId,
    unit_id: a.unitId, role_id: a.roleId, stage: a.stage,
  };
}

function toObservation(o: any) {
  return {
    id: o.id,
    person_id: o.personId ?? o.nurseId,
    step_id: o.stepId, competency_id: o.competencyId,
    preceptor_id: o.preceptorId,
    rating: o.outcome ?? o.rating,
    observed_at: o.observedAt,
    notes: o.note ?? o.notes ?? null,
  };
}

function toAchievement(a: any) {
  return {
    id: a.id,
    person_id: a.personId ?? a.nurseId,
    competency_id: a.competencyId,
    preceptor_id: a.preceptorId,
    achieved_at: a.achievedAt,
    notes: a.note ?? a.notes ?? null,
    earned_at_unit_id: a.earnedAtUnitId ?? null,
  };
}

function toChangeRequest(cr: any) {
  return {
    id: cr.id,
    requester_id: cr.requesterId,
    requester_role: cr.requesterRole ?? 'Preceptor',
    type: cr.requestType ?? cr.type ?? 'Edit',
    competency_id: cr.targetId ?? cr.competencyId ?? null,
    rationale: cr.payload?.rationale ?? cr.rationale ?? cr.note ?? '',
    status: cr.status ?? 'Pending',
    submitted_at: cr.createdAt ?? cr.submittedAt ?? new Date().toISOString(),
    admin_note: cr.payload?.adminNote ?? cr.adminNote ?? null,
  };
}

function synthesizeLogins(admins: any[], preceptors: any[], persons: any[], units: any[]) {
  const logins: any[] = [];
  for (const a of admins) {
    const name = a.fullName ?? a.name ?? '';
    logins.push({ id: a.id, display_name: `${name} (Administrator)`, system_role: 'Administrator', unit_id: null });
  }
  for (const u of units) {
    logins.push({ id: `ul-${u.id}`, display_name: `Unit Leader — ${u.name}`, system_role: 'UnitLeader', unit_id: u.id });
  }
  for (const p of preceptors) {
    const name = p.fullName ?? p.name ?? '';
    logins.push({ id: p.id, display_name: `${name} (Preceptor)`, system_role: 'Preceptor', unit_id: null });
  }
  if (persons.length > 0) {
    const n = persons[0];
    const name = n.fullName ?? n.name ?? '';
    logins.push({ id: n.id, display_name: `${name} (Orientee)`, system_role: 'Person', unit_id: null });
  }
  return logins;
}

// ---------------------------------------------------------------------------
// Insert helpers
// ---------------------------------------------------------------------------
async function insertAll(client: any, table: string, cols: string[], rows: any[]) {
  if (!rows.length) return;
  const placeholders = rows.map(
    (_, ri) => `(${cols.map((_, ci) => `$${ri * cols.length + ci + 1}`).join(',')})`
  ).join(',');
  const values = rows.flatMap(r => cols.map(c => r[c]));
  await client.query(`INSERT INTO ${table} (${cols.join(',')}) VALUES ${placeholders}`, values);
}

// ---------------------------------------------------------------------------
// Main seed
// ---------------------------------------------------------------------------
async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Truncate in reverse FK order
    await client.query(`
      TRUNCATE TABLE
        audit_events, change_requests,
        competency_achievements, step_observations,
        competency_assignments, competency_steps,
        competencies, competency_groups,
        logins, persons, administrators, preceptors,
        person_roles, units
      RESTART IDENTITY CASCADE
    `);

    // Reference data
    const units = raw.units ?? [];
    const personRoles = raw.personRoles ?? [];
    const preceptors = raw.preceptors ?? [];
    const administrators = raw.administrators ?? [];
    const persons = raw.persons ?? [];
    const groups = raw.competencyGroups ?? [];
    const competencies = raw.competencies ?? [];
    const steps = raw.competencySteps ?? [];
    const assignments = raw.competencyAssignments ?? [];
    const observations = raw.stepObservations ?? [];
    const achievements = raw.competencyAchievements ?? [];
    const changeRequests = raw.changeRequests ?? [];
    const auditEvents = raw.auditEvents ?? [];

    await insertAll(client, 'units',
      ['id', 'name', 'description', 'cost_center', 'stage_days', 'created_at', 'updated_at'],
      units.map(toUnit));

    await insertAll(client, 'person_roles',
      ['id', 'name'],
      personRoles.map(toPersonRole));

    await insertAll(client, 'administrators',
      ['id', 'name', 'email', 'title'],
      administrators.map(toAdmin));

    await insertAll(client, 'preceptors',
      ['id', 'name', 'unit_id', 'email'],
      preceptors.map(toPreceptor));

    await insertAll(client, 'persons',
      ['id', 'name', 'unit_id', 'role_id', 'primary_preceptor_id', 'start_date', 'stage_override', 'duke_id', 'job_code'],
      persons.map(toPerson));

    // Synthesize logins (seed JSON may not have them)
    const logins = (raw.logins && raw.logins.length > 0)
      ? raw.logins.map((l: any) => ({ id: l.id, display_name: l.displayName ?? l.display_name, system_role: l.systemRole ?? l.system_role, unit_id: l.unitId ?? l.unit_id ?? null }))
      : synthesizeLogins(administrators, preceptors, persons, units);

    await insertAll(client, 'logins',
      ['id', 'display_name', 'system_role', 'unit_id'],
      logins);

    await insertAll(client, 'competency_groups',
      ['id', 'name', 'parent_group_id', 'order_index', 'description'],
      groups.map(toGroup));

    await insertAll(client, 'competencies',
      ['id', 'name', 'description', 'group_id', 'category_id', 'unit_ids'],
      competencies.map(toCompetency));

    await insertAll(client, 'competency_steps',
      ['id', 'competency_id', 'name', 'order_index'],
      steps.map(toStep));

    await insertAll(client, 'competency_assignments',
      ['id', 'competency_id', 'unit_id', 'role_id', 'stage'],
      assignments.map(toAssignment));

    await insertAll(client, 'step_observations',
      ['id', 'person_id', 'step_id', 'competency_id', 'preceptor_id', 'rating', 'observed_at', 'notes'],
      observations.map(toObservation));

    await insertAll(client, 'competency_achievements',
      ['id', 'person_id', 'competency_id', 'preceptor_id', 'achieved_at', 'notes', 'earned_at_unit_id'],
      achievements.map(toAchievement));

    await insertAll(client, 'change_requests',
      ['id', 'requester_id', 'requester_role', 'type', 'competency_id', 'rationale', 'status', 'submitted_at', 'admin_note'],
      changeRequests.map(toChangeRequest));

    if (auditEvents.length) {
      await insertAll(client, 'audit_events',
        ['id', 'timestamp', 'actor', 'actor_role', 'type', 'summary', 'target_label', 'detail'],
        auditEvents.map((e: any) => ({
          id: e.id,
          timestamp: e.timestamp ?? new Date().toISOString(),
          actor: e.actor,
          actor_role: e.actorRole ?? e.actor_role,
          type: e.type,
          summary: e.summary,
          target_label: e.targetLabel ?? e.target_label ?? null,
          detail: e.detail ?? null,
        })));
    }

    await client.query('COMMIT');
    console.log('Seed complete.');
    console.log(`  units: ${units.length}`);
    console.log(`  person_roles: ${personRoles.length}`);
    console.log(`  administrators: ${administrators.length}`);
    console.log(`  preceptors: ${preceptors.length}`);
    console.log(`  persons: ${persons.length}`);
    console.log(`  logins: ${logins.length}`);
    console.log(`  competency_groups: ${groups.length}`);
    console.log(`  competencies: ${competencies.length}`);
    console.log(`  competency_steps: ${steps.length}`);
    console.log(`  competency_assignments: ${assignments.length}`);
    console.log(`  step_observations: ${observations.length}`);
    console.log(`  competency_achievements: ${achievements.length}`);
    console.log(`  change_requests: ${changeRequests.length}`);
    console.log(`  audit_events: ${auditEvents.length}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed, rolled back:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
