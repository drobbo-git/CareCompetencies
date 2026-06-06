/**
 * Applies schema.sql to the database. Safe to re-run (uses CREATE TABLE IF NOT EXISTS).
 * Run once before seeding: npm run db:setup
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { pool } from './db';

async function setup() {
  const sql = fs.readFileSync(path.resolve(__dirname, 'schema.sql'), 'utf-8');
  await pool.query(sql);
  console.log('Schema applied.');
  await pool.end();
}

setup().catch((err) => { console.error('Schema setup failed:', err); process.exit(1); });
