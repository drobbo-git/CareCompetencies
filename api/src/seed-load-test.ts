/**
 * Generates a production-scale synthetic dataset for load testing, on top of
 * the existing (small) seed data. Numbers come from the scalability-plan
 * estimate: 300 units, 20,000 learners, 1,000 preceptors, 1,200 competencies
 * with 10-15 steps each, ~20-30 achieved competencies per learner.
 *
 * Idempotent: deletes all synth-* rows first (in FK-safe order), then
 * regenerates. Uses bulk inserts (mssql Table) — row-by-row would take far
 * too long at this volume.
 *
 * SAFETY: refuses to run unless DB_SERVER=localhost. This is a lot of data
 * and must never land in the shared Azure SQL dev DB.
 *
 * Run: npm run seed:load-test   (with .env.test loaded — see package.json)
 */
import 'dotenv/config';
import sql from 'mssql';

if (process.env.DB_SERVER !== 'localhost') {
  throw new Error('Refusing to run: DB_SERVER must be localhost. Point this at the local test container, not the shared dev DB.');
}

const UNIT_COUNT = 300;
const COMPETENCY_COUNT = 1200;
const GROUP_COUNT = 30;
const PRECEPTOR_COUNT = 1000;
const LEARNER_COUNT = 20000;
const ASSIGNMENTS_PER_UNIT = 25;
const UNIT_LEADERS = UNIT_COUNT; // one promoted preceptor per unit
// persons.username has a UNIQUE constraint, and SQL Server (unlike Postgres)
// only allows a single NULL across a unique index/constraint — every person
// needs a distinct username, not just the ones load-test scripts log in as.

const STAGES = ['Core', 'Orientation', 'Education'] as const;
const ROLE_ID = 'r-rn';

const sqlConfig: sql.config = {
  server: process.env.DB_SERVER!,
  port: parseInt(process.env.DB_PORT ?? '1433', 10),
  database: process.env.DB_NAME!,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: { encrypt: false, trustServerCertificate: true },
};

function pad(n: number, width: number): string {
  return String(n).padStart(width, '0');
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function pickN<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  for (let i = 0; i < n && copy.length > 0; i++) {
    out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
  }
  return out;
}
function randomDateWithinDays(days: number): Date {
  const now = Date.now();
  return new Date(now - Math.floor(Math.random() * days) * 86_400_000);
}

interface BulkColumn { name: string; type: unknown; nullable?: boolean }

async function bulkInsert(
  pool: sql.ConnectionPool,
  tableName: string,
  columns: BulkColumn[],
  rows: unknown[][],
  chunkSize = 5000,
): Promise<void> {
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const table = new sql.Table(tableName);
    table.create = false;
    for (const col of columns) {
      table.columns.add(col.name, col.type as sql.ISqlType, { nullable: col.nullable ?? true });
    }
    for (const row of chunk) table.rows.add(...(row as any[]));
    const request = new sql.Request(pool);
    await request.bulk(table);
  }
  console.log(`  ${tableName}: ${rows.length} rows`);
}

async function main() {
  const pool = await sql.connect(sqlConfig);
  console.log('Connected. Clearing prior synth-* data...');

  // Reverse FK-dependency order. step_observations/competency_achievements
  // have no FK (append-only by design — see schema.sql), but still scoped
  // to synth- person ids so cleanup stays correct.
  await pool.request().query(`DELETE FROM step_observations WHERE person_id LIKE 'synth-%'`);
  await pool.request().query(`DELETE FROM competency_achievements WHERE person_id LIKE 'synth-%'`);
  await pool.request().query(`DELETE FROM competency_assignments WHERE id LIKE 'synth-%'`);
  await pool.request().query(`DELETE FROM person_privileges WHERE person_id LIKE 'synth-%'`);
  await pool.request().query(`DELETE FROM persons WHERE id LIKE 'synth-%'`);
  await pool.request().query(`DELETE FROM competency_steps WHERE competency_id LIKE 'synth-%'`);
  await pool.request().query(`DELETE FROM competencies WHERE id LIKE 'synth-%'`);
  await pool.request().query(`DELETE FROM competency_groups WHERE id LIKE 'synth-%'`);
  await pool.request().query(`DELETE FROM units WHERE id LIKE 'synth-%'`);

  console.log('Generating units...');
  const unitIds = Array.from({ length: UNIT_COUNT }, (_, i) => `synth-unit-${pad(i + 1, 4)}`);
  await bulkInsert(pool, 'dbo.units',
    [{ name: 'id', type: sql.NVarChar(64), nullable: false }, { name: 'name', type: sql.NVarChar(200), nullable: false }],
    unitIds.map((id, i) => [id, `Synthetic Unit ${pad(i + 1, 4)}`]),
  );

  console.log('Generating competency groups...');
  const groupIds = Array.from({ length: GROUP_COUNT }, (_, i) => `synth-grp-${pad(i + 1, 2)}`);
  await bulkInsert(pool, 'dbo.competency_groups',
    [
      { name: 'id', type: sql.NVarChar(64), nullable: false }, { name: 'name', type: sql.NVarChar(200), nullable: false },
      { name: 'order_index', type: sql.Int, nullable: true },
    ],
    groupIds.map((id, i) => [id, `Synthetic Group ${pad(i + 1, 2)}`, i]),
  );

  console.log('Generating competencies + steps...');
  const competencyIds = Array.from({ length: COMPETENCY_COUNT }, (_, i) => `synth-comp-${pad(i + 1, 4)}`);
  await bulkInsert(pool, 'dbo.competencies',
    [
      { name: 'id', type: sql.NVarChar(64), nullable: false }, { name: 'name', type: sql.NVarChar(300), nullable: false },
      { name: 'group_id', type: sql.NVarChar(64), nullable: true }, { name: 'unit_ids', type: sql.NVarChar(sql.MAX), nullable: false },
    ],
    competencyIds.map((id, i) => [id, `Synthetic Competency ${pad(i + 1, 4)}`, pick(groupIds), '[]']),
  );

  const stepRows: unknown[][] = [];
  for (const compId of competencyIds) {
    const stepCount = 10 + Math.floor(Math.random() * 6); // 10-15
    for (let s = 0; s < stepCount; s++) {
      stepRows.push([`${compId}-step-${pad(s + 1, 2)}`, compId, `Step ${s + 1}`, s]);
    }
  }
  await bulkInsert(pool, 'dbo.competency_steps',
    [
      { name: 'id', type: sql.NVarChar(64), nullable: false }, { name: 'competency_id', type: sql.NVarChar(64), nullable: false },
      { name: 'name', type: sql.NVarChar(sql.MAX), nullable: false }, { name: 'order_index', type: sql.Int, nullable: false },
    ],
    stepRows, 10000,
  );

  console.log('Generating competency assignments...');
  // Map unit -> the competencies required for it, so achievements can be
  // drawn from the right pool later.
  const unitRequiredComps = new Map<string, string[]>();
  const assignmentRows: unknown[][] = [];
  let assignmentSeq = 0;
  for (const unitId of unitIds) {
    const required = pickN(competencyIds, ASSIGNMENTS_PER_UNIT);
    unitRequiredComps.set(unitId, required);
    required.forEach((compId, idx) => {
      const stage = STAGES[idx % STAGES.length];
      assignmentRows.push([`synth-asn-${pad(++assignmentSeq, 6)}`, compId, unitId, ROLE_ID, stage]);
    });
  }
  await bulkInsert(pool, 'dbo.competency_assignments',
    [
      { name: 'id', type: sql.NVarChar(64), nullable: false }, { name: 'competency_id', type: sql.NVarChar(64), nullable: false },
      { name: 'unit_id', type: sql.NVarChar(64), nullable: false }, { name: 'role_id', type: sql.NVarChar(64), nullable: false },
      { name: 'stage', type: sql.NVarChar(32), nullable: false },
    ],
    assignmentRows,
  );

  console.log('Generating preceptors...');
  const unitPreceptors = new Map<string, string[]>(); // unitId -> preceptor person ids
  const preceptorRows: unknown[][] = [];
  const preceptorIds: string[] = [];
  for (let i = 0; i < PRECEPTOR_COUNT; i++) {
    const id = `synth-prec-${pad(i + 1, 5)}`;
    const unitId = pick(unitIds);
    const username = `synthp${pad(i + 1, 5)}`;
    preceptorIds.push(id);
    (unitPreceptors.get(unitId) ?? unitPreceptors.set(unitId, []).get(unitId)!).push(id);
    preceptorRows.push([id, username, `Synthetic Preceptor ${pad(i + 1, 5)}`, unitId, ROLE_ID, randomDateWithinDays(900)]);
  }
  await bulkInsert(pool, 'dbo.persons',
    [
      { name: 'id', type: sql.NVarChar(36), nullable: false }, { name: 'username', type: sql.NVarChar(64), nullable: true },
      { name: 'name', type: sql.NVarChar(200), nullable: false }, { name: 'unit_id', type: sql.NVarChar(64), nullable: true },
      { name: 'role_id', type: sql.NVarChar(64), nullable: true }, { name: 'start_date', type: sql.Date, nullable: true },
    ],
    preceptorRows,
  );

  console.log('Generating person privileges (Preceptor + UnitLeader)...');
  const privilegeRows: unknown[][] = [];
  let privSeq = 0;
  for (const [unitId, precIds] of unitPreceptors) {
    for (const pid of precIds) {
      privilegeRows.push([`synth-priv-${pad(++privSeq, 6)}`, pid, 'Preceptor', unitId]);
    }
  }
  // Promote one preceptor per unit to UnitLeader as well.
  let unitLeadersAssigned = 0;
  for (const [unitId, precIds] of unitPreceptors) {
    if (unitLeadersAssigned >= UNIT_LEADERS) break;
    privilegeRows.push([`synth-priv-${pad(++privSeq, 6)}`, precIds[0], 'UnitLeader', unitId]);
    unitLeadersAssigned++;
  }
  await bulkInsert(pool, 'dbo.person_privileges',
    [
      { name: 'id', type: sql.NVarChar(64), nullable: false }, { name: 'person_id', type: sql.NVarChar(36), nullable: false },
      { name: 'privilege', type: sql.NVarChar(32), nullable: false }, { name: 'unit_id', type: sql.NVarChar(64), nullable: true },
    ],
    privilegeRows,
  );

  console.log('Generating learners...');
  const learnerRows: unknown[][] = [];
  const learnersByUnit = new Map<string, string[]>();
  const personUnitMap = new Map<string, string>();
  for (const [unitId, precIds] of unitPreceptors) {
    for (const pid of precIds) personUnitMap.set(pid, unitId);
  }
  for (let i = 0; i < LEARNER_COUNT; i++) {
    const id = `synth-learn-${pad(i + 1, 6)}`;
    const unitId = pick(unitIds);
    const precsOnUnit = unitPreceptors.get(unitId) ?? [];
    const assignPreceptor = precsOnUnit.length > 0 && Math.random() < 0.7; // ~30% unassigned, like real float/QR-found learners
    const username = `synthl${pad(i + 1, 6)}`;
    (learnersByUnit.get(unitId) ?? learnersByUnit.set(unitId, []).get(unitId)!).push(id);
    personUnitMap.set(id, unitId);
    learnerRows.push([
      id, username, `Synthetic Learner ${pad(i + 1, 6)}`, unitId, ROLE_ID,
      assignPreceptor ? pick(precsOnUnit) : null, randomDateWithinDays(180),
    ]);
  }
  await bulkInsert(pool, 'dbo.persons',
    [
      { name: 'id', type: sql.NVarChar(36), nullable: false }, { name: 'username', type: sql.NVarChar(64), nullable: true },
      { name: 'name', type: sql.NVarChar(200), nullable: false }, { name: 'unit_id', type: sql.NVarChar(64), nullable: true },
      { name: 'role_id', type: sql.NVarChar(64), nullable: true }, { name: 'primary_preceptor_id', type: sql.NVarChar(36), nullable: true },
      { name: 'start_date', type: sql.Date, nullable: true },
    ],
    learnerRows, 5000,
  );

  console.log('Generating achievements (preceptors\' own unit catalog + learners\' progress)...');
  const achievementRows: unknown[][] = [];
  let achSeq = 0;
  const achievedByPerson = new Map<string, string[]>(); // for observations later

  for (const [unitId, precIds] of unitPreceptors) {
    const required = unitRequiredComps.get(unitId) ?? [];
    for (const precId of precIds) {
      const mine: string[] = [];
      for (const compId of required) {
        achievementRows.push([`synth-ach-${pad(++achSeq, 7)}`, precId, compId, precId, randomDateWithinDays(900), unitId]);
        mine.push(compId);
      }
      achievedByPerson.set(precId, mine);
    }
  }
  for (const [unitId, learnerIds] of learnersByUnit) {
    const required = unitRequiredComps.get(unitId) ?? [];
    const precsOnUnit = unitPreceptors.get(unitId) ?? [];
    for (const learnerId of learnerIds) {
      const achievedCount = Math.min(required.length, 20 + Math.floor(Math.random() * 11)); // 20-30
      const achieved = pickN(required, achievedCount);
      const observer = precsOnUnit.length > 0 ? pick(precsOnUnit) : learnerId;
      for (const compId of achieved) {
        achievementRows.push([`synth-ach-${pad(++achSeq, 7)}`, learnerId, compId, observer, randomDateWithinDays(180), unitId]);
      }
      achievedByPerson.set(learnerId, achieved);
    }
  }
  await bulkInsert(pool, 'dbo.competency_achievements',
    [
      { name: 'id', type: sql.NVarChar(64), nullable: false }, { name: 'person_id', type: sql.NVarChar(36), nullable: false },
      { name: 'competency_id', type: sql.NVarChar(64), nullable: false }, { name: 'observer_id', type: sql.NVarChar(36), nullable: false },
      { name: 'achieved_at', type: sql.DateTime2(0), nullable: false }, { name: 'earned_at_unit_id', type: sql.NVarChar(64), nullable: true },
    ],
    achievementRows, 20000,
  );

  console.log('Generating step observations (sampled per achievement)...');
  const obsRows: unknown[][] = [];
  let obsSeq = 0;
  for (const [personId, achievedComps] of achievedByPerson) {
    const unitId = personUnitMap.get(personId);
    const precsOnUnit = unitId ? unitPreceptors.get(unitId) : undefined;
    const observer = precsOnUnit && precsOnUnit.length > 0 ? pick(precsOnUnit) : personId;
    for (const compId of achievedComps) {
      // 2-4 step observations per achieved competency (partial step coverage, not all 10-15).
      const stepSampleCount = 2 + Math.floor(Math.random() * 3);
      for (let s = 1; s <= stepSampleCount; s++) {
        obsRows.push([
          `synth-obs-${pad(++obsSeq, 8)}`, personId, `${compId}-step-${pad(s, 2)}`, compId, observer,
          'Satisfactory', randomDateWithinDays(180),
        ]);
      }
    }
  }
  await bulkInsert(pool, 'dbo.step_observations',
    [
      { name: 'id', type: sql.NVarChar(64), nullable: false }, { name: 'person_id', type: sql.NVarChar(36), nullable: false },
      { name: 'step_id', type: sql.NVarChar(64), nullable: false }, { name: 'competency_id', type: sql.NVarChar(64), nullable: false },
      { name: 'observer_id', type: sql.NVarChar(36), nullable: false }, { name: 'rating', type: sql.NVarChar(32), nullable: false },
      { name: 'observed_at', type: sql.DateTime2(0), nullable: false },
    ],
    obsRows, 20000,
  );

  console.log('Done.');
  await pool.close();
}

main().catch((err) => { console.error(err); process.exit(1); });
