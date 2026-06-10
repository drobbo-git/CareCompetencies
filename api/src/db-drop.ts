/**
 * Drops all application tables from the SQL Server database.
 * Used by the db:reset script before db:setup + seed.
 */
import 'dotenv/config';
import sql from 'mssql';

const sqlConfig: sql.config = {
  server:   process.env.DB_SERVER!,
  port:     parseInt(process.env.DB_PORT ?? '1433', 10),
  database: process.env.DB_NAME!,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt:                process.env.DB_SERVER !== 'localhost',
    trustServerCertificate: process.env.DB_SERVER === 'localhost',
  },
};

// Drop in reverse FK dependency order; constraints are disabled first so
// the order of the DROP TABLE statements doesn't matter.
const DROP_SQL = `
  IF OBJECT_ID('dbo.audit_events',           'U') IS NOT NULL DROP TABLE dbo.audit_events;
  IF OBJECT_ID('dbo.change_requests',        'U') IS NOT NULL DROP TABLE dbo.change_requests;
  IF OBJECT_ID('dbo.competency_achievements','U') IS NOT NULL DROP TABLE dbo.competency_achievements;
  IF OBJECT_ID('dbo.step_observations',      'U') IS NOT NULL DROP TABLE dbo.step_observations;
  IF OBJECT_ID('dbo.person_privileges',      'U') IS NOT NULL DROP TABLE dbo.person_privileges;
  IF OBJECT_ID('dbo.competency_assignments', 'U') IS NOT NULL DROP TABLE dbo.competency_assignments;
  IF OBJECT_ID('dbo.competency_steps',       'U') IS NOT NULL DROP TABLE dbo.competency_steps;
  IF OBJECT_ID('dbo.competencies',           'U') IS NOT NULL DROP TABLE dbo.competencies;
  IF OBJECT_ID('dbo.competency_groups',      'U') IS NOT NULL DROP TABLE dbo.competency_groups;
  IF OBJECT_ID('dbo.persons',               'U') IS NOT NULL DROP TABLE dbo.persons;
  IF OBJECT_ID('dbo.person_roles',          'U') IS NOT NULL DROP TABLE dbo.person_roles;
  IF OBJECT_ID('dbo.units',                 'U') IS NOT NULL DROP TABLE dbo.units;
`;

async function drop() {
  const pool = await sql.connect(sqlConfig);
  try {
    await pool.request().batch(DROP_SQL);
    console.log('All tables dropped.');
  } finally {
    await pool.close();
  }
}

drop().catch((err) => {
  console.error('Drop failed:', err);
  process.exit(1);
});
