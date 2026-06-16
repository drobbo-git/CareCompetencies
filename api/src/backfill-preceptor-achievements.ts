/**
 * Backfills competency_achievements for every Preceptor so they personally
 * hold every competency required on their privilege unit(s) — preceptors are
 * assumed to already be qualified on their home unit's full catalog (see
 * CLAUDE.md "Preceptor"); this grandfathers that assumption into actual
 * achievement rows so the achievement-based teaching gate has data to check.
 *
 * Idempotent: only inserts pairs that don't already exist. Safe to re-run.
 * Run: npx ts-node src/backfill-preceptor-achievements.ts
 */
import 'dotenv/config';
import crypto from 'crypto';
import { pool } from './db';

async function main() {
  const { rows: privRows } = await pool.query(
    `SELECT pp.person_id, pp.unit_id, p.role_id, p.start_date
     FROM dbo.person_privileges pp
     JOIN dbo.persons p ON p.id = pp.person_id
     WHERE pp.privilege = 'Preceptor' AND pp.unit_id IS NOT NULL`,
  );

  let inserted = 0;
  let skipped = 0;

  for (const priv of privRows) {
    const roleId = priv.role_id ?? 'r-rn';
    const { rows: assignmentRows } = await pool.query(
      `SELECT DISTINCT competency_id FROM dbo.competency_assignments WHERE unit_id = $1 AND role_id = $2`,
      [priv.unit_id, roleId],
    );

    for (const a of assignmentRows) {
      const { rows: existing } = await pool.query(
        `SELECT 1 FROM dbo.competency_achievements WHERE person_id = $1 AND competency_id = $2`,
        [priv.person_id, a.competency_id],
      );
      if (existing.length > 0) { skipped++; continue; }

      const id = `ach-bf-${crypto.randomUUID().slice(0, 8)}`;
      const achievedAt = priv.start_date ? new Date(priv.start_date).toISOString() : new Date().toISOString();
      await pool.query(
        `INSERT INTO dbo.competency_achievements (id, person_id, competency_id, observer_id, achieved_at, notes, earned_at_unit_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          id, priv.person_id, a.competency_id, priv.person_id, achievedAt,
          'Backfilled: preceptor grandfathered as qualified on home unit catalog',
          priv.unit_id,
        ],
      );
      inserted++;
    }
  }

  console.log(`Backfill complete: ${inserted} achievement(s) inserted, ${skipped} already existed.`);
  await pool.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
