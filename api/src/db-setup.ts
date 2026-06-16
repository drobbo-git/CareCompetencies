/**
 * Applies schema.sql to the SQL Server database.
 * Safe to re-run — all CREATE TABLE / CREATE INDEX statements are guarded.
 * Run once before seeding: npm run db:setup
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import sql from 'mssql';

const isLocal = process.env.DB_SERVER === 'localhost';

const baseConfig: sql.config = {
  server:   process.env.DB_SERVER!,
  port:     parseInt(process.env.DB_PORT ?? '1433', 10),
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt:                !isLocal,
    trustServerCertificate: isLocal,
  },
};

async function setup() {
  const schemaText = fs.readFileSync(
    path.resolve(__dirname, 'schema.sql'),
    'utf-8',
  );

  // A fresh local Docker container has no databases beyond the system ones —
  // create ours if missing. Skipped against Azure SQL, where the database
  // is provisioned ahead of time and a server-level connection works
  // differently.
  if (isLocal) {
    const masterPool = await sql.connect({ ...baseConfig, database: 'master' });
    try {
      await masterPool.request().batch(
        `IF DB_ID(N'${process.env.DB_NAME}') IS NULL CREATE DATABASE [${process.env.DB_NAME}];`,
      );
    } finally {
      await masterPool.close();
    }
  }

  const pool = await sql.connect({ ...baseConfig, database: process.env.DB_NAME! });
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
