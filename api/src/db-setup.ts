/**
 * Applies schema.sql to the SQL Server database.
 * Safe to re-run — all CREATE TABLE / CREATE INDEX statements are guarded.
 * Run once before seeding: npm run db:setup
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
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

async function setup() {
  const schemaText = fs.readFileSync(
    path.resolve(__dirname, 'schema.sql'),
    'utf-8',
  );

  const pool = await sql.connect(sqlConfig);
  try {
    // Execute the entire schema as a single batch.
    // mssql's batch() handles multi-statement SQL without needing GO separators.
    await pool.request().batch(schemaText);
    console.log('Schema applied.');
  } finally {
    await pool.close();
  }
}

setup().catch((err) => {
  console.error('Schema setup failed:', err);
  process.exit(1);
});
