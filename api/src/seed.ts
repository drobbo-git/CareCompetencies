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
const DEFAULT_ROLE_ID = 'r-rn';

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

function toPersonPrivilege(p: any) {
  return {
    id: p.id,
    person_id: p.personId,
    privilege: p.privilege,
    unit_id: p.unitId ?? null,
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
    observer_id: o.preceptorId ?? o.observerId,
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
    observer_id: a.preceptorId ?? a.observerId,
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

function synthesizeLogins(persons: any[], privileges: any[], units: any[]) {
  const logins: any[] = [];

  const unitNameMap = new Map(units.map((u: any) => [u.id, u.name]));

  const adminPersonIds = new Set(
    privileges.filter((p: any) => p.privilege === 'Administrator').map((p: any) => p.personId)
  );

  for (const personId of adminPersonIds) {
    const person = persons.find((n: any) => n.id === personId);
    if (!person) continue;
    logins.push({
      id: person.id,
      display_name: `${person.fullName ?? person.name ?? ''} (Administrator)`,
      system_role: 'Administrator',
      unit_ids: null,
    });
  }

  const ulMap = new Map<string, string[]>();
  for (const p of privileges.filter((pp: any) => pp.privilege === 'UnitLeader')) {
    if (!ulMap.has(p.personId)) ulMap.set(p.personId, []);
    if (p.unitId) ulMap.get(p.personId)!.push(p.unitId);
  }
  for (const [personId, unitIds] of ulMap) {
    const person = persons.find((n: any) => n.id === personId);
    if (!person) continue;
    const unitNames = unitIds.map((uid) => unitNameMap.get(uid) ?? uid).join(', ');
    logins.push({
      id: person.id,
      display_name: `${person.fullName ?? person.name ?? ''} (Unit Leader — ${unitNames})`,
      system_role: 'UnitLeader',
      unit_ids: JSON.stringify(unitIds),
    });
  }

  const precMap = new Map<string, string[]>();
  for (const p of privileges.filter((pp: any) => pp.privilege === 'Preceptor')) {
    if (!precMap.has(p.personId)) precMap.set(p.personId, []);
    if (p.unitId) precMap.get(p.personId)!.push(p.unitId);
  }
  for (const [personId, unitIds] of precMap) {
    const person = persons.find((n: any) => n.id === personId);
    if (!person) continue;
    logins.push({
      id: person.id,
      display_name: `${person.fullName ?? person.name ?? ''} (Preceptor)`,
      system_role: 'Preceptor',
      unit_ids: JSON.stringify(unitIds),
    });
  }

  const orientee = persons.find(
    (n: any) => !adminPersonIds.has(n.id) && !precMap.has(n.id) && !ulMap.has(n.id)
  );
  if (orientee) {
    logins.push({
      id: orientee.id,
      display_name: `${orientee.fullName ?? orientee.name ?? ''} (Orientee)`,
      system_role: 'Person',
      unit_ids: null,
    });
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
        logins, person_privileges, persons,
        person_roles, units
      RESTART IDENTITY CASCADE
    `);

    const units = raw.units ?? [];
    const personRoles = raw.personRoles ?? [];
    const persons = raw.persons ?? [];
    const personPrivileges = raw.personPrivileges ?? [];
    const groups = raw.competencyGroups ?? [];
    const competencies = raw.competencies ?? [];
    const steps = raw.competencySteps ?? [];
    const assignments = raw.competencyAssignments ?? [];
    const observations = raw.stepObservations ?? [];
    const achievements = raw.competencyAchievements ?? [];
    const changeRequests = raw.changeRequests ?? [];

    await insertAll(client, 'units',
      ['id', 'name', 'description', 'cost_center', 'stage_days', 'created_at', 'updated_at'],
      units.map(toUnit));

    await insertAll(client, 'person_roles',
      ['id', 'name'],
      personRoles.map(toPersonRole));

    await insertAll(client, 'persons',
      ['id', 'name', 'unit_id', 'role_id', 'primary_preceptor_id', 'start_date', 'stage_override', 'duke_id', 'job_code'],
      persons.map(toPerson));

    await insertAll(client, 'person_privileges',
      ['id', 'person_id', 'privilege', 'unit_id'],
      personPrivileges.map(toPersonPrivilege));

    const logins = synthesizeLogins(persons, personPrivileges, units);

    await insertAll(client, 'logins',
      ['id', 'display_name', 'system_role', 'unit_ids'],
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
      ['id', 'person_id', 'step_id', 'competency_id', 'observer_id', 'rating', 'observed_at', 'notes'],
      observations.map(toObservation));

    await insertAll(client, 'competency_achievements',
      ['id', 'person_id', 'competency_id', 'observer_id', 'achieved_at', 'notes', 'earned_at_unit_id'],
      achievements.map(toAchievement));

    await insertAll(client, 'change_requests',
      ['id', 'requester_id', 'requester_role', 'type', 'competency_id', 'rationale', 'status', 'submitted_at', 'admin_note'],
      changeRequests.map(toChangeRequest));

    await client.query('COMMIT');
    console.log('Seed complete.');
    console.log(`  units: ${units.length}`);
    console.log(`  person_roles: ${personRoles.length}`);
    console.log(`  persons: ${persons.length}`);
    console.log(`  person_privileges: ${personPrivileges.length}`);
    console.log(`  logins: ${logins.length}`);
    console.log(`  competency_groups: ${groups.length}`);
    console.log(`  competencies: ${competencies.length}`);
    console.log(`  competency_steps: ${steps.length}`);
    console.log(`  competency_assignments: ${assignments.length}`);
    console.log(`  step_observations: ${observations.length}`);
    console.log(`  competency_achievements: ${achievements.length}`);
    console.log(`  change_requests: ${changeRequests.length}`);
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
