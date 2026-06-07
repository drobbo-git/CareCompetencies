/**
 * Drops and recreates the public schema — wipes all tables and data.
 * Used by the db:reset script before db:setup + seed.
 */
import 'dotenv/config';
import { pool } from './db';

async function drop() {
  await pool.query('DROP SCHEMA public CASCADE');
  await pool.query('CREATE SCHEMA public');
  await pool.query('GRANT ALL ON SCHEMA public TO PUBLIC');
  console.log('Schema dropped and recreated.');
  await pool.end();
}

drop().catch((err) => { console.error('Drop failed:', err); process.exit(1); });
