/**
 * Loads carecompetencies_seed.json into the SQL Server database.
 * Run once against a fresh database: npm run seed
 *
 * Idempotent: clears all tables before inserting, so re-running is safe.
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { pool } from './db';

const seedPath = path.resolve(__dirname, '../../etl/data/carecompetencies_seed.json');
const raw = JSON.parse(fs.readFileSync(seedPath, 'utf-8'));

// ---------------------------------------------------------------------------
// Person ID remapping
// The seed JSON's stepObservations and competencyAchievements still reference
// the legacy n-XXXXXX person IDs. This map translates them to the UUIDs used
// in the synthetic persons section so FK integrity is maintained.
// ---------------------------------------------------------------------------
const OLD_TO_NEW_PERSON_ID: Record<string, string> = {
  'n-96948':   '2f4a6c8e-0b1d-4e3f-a789-512345678001',
  'n-205051':  '3a5b7c9d-1e2f-4a0b-b890-512345678002',
  'n-813703':  '4b6c8d0e-2f3a-4b1c-c901-512345678003',
  'n-1474684': '5c7d9e1f-3a4b-4c2d-d012-512345678004',
  'n-1583340': '6d8e0f2a-4b5c-4d3e-e123-512345678005',
  'n-1130738': '7e9f1a3b-5c6d-4e4f-f234-512345678006',
  'n-1560857': '8f0a2b4c-6d7e-4f5a-a345-512345678007',
  'n-488930':  '9a1b3c5d-7e8f-4a6b-b456-512345678008',
  'n-988556':  '0b2c4d6e-8f9a-4b7c-c567-512345678009',
  'n-1160174': '1c3d5e7f-9a0b-4c8d-d678-512345678010',
  'n-1335362': '2d4e6f8a-0b1c-4d9e-e789-512345678011',
  'n-628807':  '3e5f7a9b-1c2d-4e0f-f890-512345678012',
  'n-1034024': '4f6a8b0c-2d3e-4f1a-a901-512345678013',
  'n-1529896': '5a7b9c1d-3e4f-4a2b-b012-512345678014',
  'n-722643':  '6b8c0d2e-4f5a-4b3c-c123-512345678015',
  'n-1538479': '7c9d1e3f-5a6b-4c4d-d234-512345678016',
  'n-984835':  '8d0e2f4a-6b7c-4d5e-e345-512345678017',
  'n-914781':  '9e1f3a5b-7c8d-4e6f-f456-512345678018',
  'n-1434690': '0f2a4b6c-8d9e-4f7a-a567-512345678019',
  'n-602435':  '1a3b5c7d-9e0f-4a8b-b678-512345678020',
  'n-361404':  '2b4c6d8e-0f1a-4b9c-c789-512345678021',
  'n-224104':  '3c5d7e9f-1a2b-4c0d-d890-512345678022',
  'n-311406':  '4d6e8f0a-2b3c-4d1e-e901-512345678023',
  'n-1125158': '5e7f9a1b-3c4d-4e2f-f012-512345678024',
  'n-1197462': '6f8a0b2c-4d5e-4f3a-a123-512345678025',
  'n-1194888': '7a9b1c3d-5e6f-4a4b-b234-512345678026',
  'n-330460':  '8b0c2d4e-6f7a-4b5c-c345-512345678027',
  'n-573641':  '9c1d3e5f-7a8b-4c6d-d456-512345678028',
  'n-480015':  '0d2e4f6a-8b9c-4d7e-e567-512345678029',
};

function remapPersonId(id: string | undefined): string | undefined {
  if (!id) return undefined;
  return OLD_TO_NEW_PERSON_ID[id] ?? id;
}

// ---------------------------------------------------------------------------
// Translation helpers
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
    id: n.id,
    username: n.username ?? null,
    name: n.fullName ?? n.name ?? '',
    unit_id: n.unitId,
    role_id: n.roleId ?? DEFAULT_ROLE_ID,
    primary_preceptor_id: n.primaryPreceptorId ?? null,
    start_date: n.startDate ?? n.hireDate ?? null,
    stage_override: n.stage ?? n.stageOverride ?? null,
    duke_netid: n.dukeNetid ?? null,
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
    validation_method: c.validationMethod ?? null,
    knowledge_source: c.knowledgeSource ?? null,
    policy_source: c.policySource ?? null,
    update_note: c.updateNote ?? null,
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
    person_id:    remapPersonId(o.personId ?? o.nurseId) ?? '',
    step_id:      o.stepId,
    competency_id: o.competencyId,
    observer_id:  remapPersonId(o.preceptorId ?? o.observerId) ?? '',
    rating:       o.outcome ?? o.rating,
    observed_at:  o.observedAt,
    notes:        o.note ?? o.notes ?? null,
  };
}

function toAchievement(a: any) {
  return {
    id: a.id,
    person_id:         remapPersonId(a.personId ?? a.nurseId) ?? '',
    competency_id:     a.competencyId,
    observer_id:       remapPersonId(a.preceptorId ?? a.observerId) ?? '',
    achieved_at:       a.achievedAt,
    notes:             a.note ?? a.notes ?? null,
    earned_at_unit_id: a.earnedAtUnitId ?? null,
  };
}

const STATUS_NORMALIZE: Record<string, string> = {
  Open: 'Pending', Declined: 'Rejected',
};
const TYPE_NORMALIZE: Record<string, string> = {
  'Change Steps': 'ChangeSteps', 'Re-associate': 'Edit',
};

function toChangeRequest(cr: any) {
  const rawStatus = cr.status ?? 'Pending';
  const rawType = cr.requestType ?? cr.type ?? 'Edit';
  return {
    id: cr.id,
    requester_id:   cr.requesterId,
    requester_role: cr.requesterRole ?? 'Preceptor',
    type:           TYPE_NORMALIZE[rawType] ?? rawType,
    competency_id:  cr.targetId ?? cr.competencyId ?? null,
    rationale:      cr.payload?.rationale ?? cr.rationale ?? cr.note ?? '',
    status:         STATUS_NORMALIZE[rawStatus] ?? rawStatus,
    submitted_at:   cr.createdAt ?? cr.submittedAt ?? new Date().toISOString(),
    admin_note:     cr.payload?.adminNote ?? cr.adminNote ?? null,
  };
}

// ---------------------------------------------------------------------------
// Batched INSERT — splits into chunks to stay under SQL Server's 2100-param limit
// ---------------------------------------------------------------------------
const BATCH_SIZE = 50;

async function insertAll(client: any, table: string, cols: string[], rows: any[]) {
  if (!rows.length) return;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const placeholders = chunk.map(
      (_, ri) => `(${cols.map((_, ci) => `$${ri * cols.length + ci + 1}`).join(',')})`,
    ).join(',');
    const values = chunk.flatMap(r => cols.map(c => r[c]));
    await client.query(`INSERT INTO ${table} (${cols.join(',')}) VALUES ${placeholders}`, values);
  }
}

// ---------------------------------------------------------------------------
// Main seed
// ---------------------------------------------------------------------------
async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Clear in reverse FK order. For the self-referencing competency_groups,
    // NULL out parent refs before deleting so leaf/parent order doesn't matter.
    for (const stmt of [
      'DELETE FROM audit_events',
      'DELETE FROM change_requests',
      'DELETE FROM competency_achievements',
      'DELETE FROM step_observations',
      'DELETE FROM person_privileges',
      'DELETE FROM competency_assignments',
      'DELETE FROM competency_steps',
      'DELETE FROM competencies',
      'UPDATE competency_groups SET parent_group_id = NULL',
      'DELETE FROM competency_groups',
      'DELETE FROM persons',
      'DELETE FROM person_roles',
      'DELETE FROM units',
    ]) {
      await client.query(stmt);
    }

    const units            = raw.units ?? [];
    const personRoles      = raw.personRoles ?? [];
    const persons          = raw.persons ?? [];
    const personPrivileges = raw.personPrivileges ?? [];
    const groups           = raw.competencyGroups ?? [];
    const competencies     = raw.competencies ?? [];
    const steps            = raw.competencySteps ?? [];
    const assignments      = raw.competencyAssignments ?? [];
    const observations     = raw.stepObservations ?? [];
    const achievements     = raw.competencyAchievements ?? [];
    const changeRequests   = raw.changeRequests ?? [];

    await insertAll(client, 'units',
      ['id', 'name', 'description', 'cost_center', 'stage_days', 'created_at', 'updated_at'],
      units.map(toUnit));

    await insertAll(client, 'person_roles',
      ['id', 'name'],
      personRoles.map(toPersonRole));

    await insertAll(client, 'persons',
      ['id', 'username', 'name', 'unit_id', 'role_id', 'primary_preceptor_id',
       'start_date', 'stage_override', 'duke_netid', 'job_code'],
      persons.map(toPerson));

    await insertAll(client, 'person_privileges',
      ['id', 'person_id', 'privilege', 'unit_id'],
      personPrivileges.map(toPersonPrivilege));

    await insertAll(client, 'competency_groups',
      ['id', 'name', 'parent_group_id', 'order_index', 'description'],
      groups.map(toGroup));

    await insertAll(client, 'competencies',
      ['id', 'name', 'description', 'group_id', 'category_id', 'unit_ids',
       'validation_method', 'knowledge_source', 'policy_source', 'update_note'],
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
