import { pool } from '../db';
import crypto from 'crypto';

export interface PersonUpsertInput {
  netid: string;
  name: string;
  unitId: string;
  roleId?: string;
  startDate: string;
  jobCode?: string;
  stageOverride?: string;
}

export interface PersonUpsertResult {
  action: 'created' | 'updated';
  person: {
    id: string;
    netid: string;
    name: string;
    unitId: string;
    roleId?: string;
    startDate: string;
    stageOverride?: string;
    jobCode?: string;
  };
}

// HR-sync style upsert keyed on NetID — shared by the integration API
// (one record at a time) and the bulk user-load import job (one row per
// person in a CSV).
export async function upsertPersonByNetId(input: PersonUpsertInput): Promise<PersonUpsertResult> {
  const { netid, name, unitId, roleId, startDate, jobCode, stageOverride } = input;

  const { rows: existing } = await pool.query(
    'SELECT id FROM persons WHERE username = $1 OR duke_netid = $2',
    [netid, netid],
  );

  let personId: string;
  let action: 'created' | 'updated';

  if (existing.length > 0) {
    personId = existing[0].id;
    action = 'updated';
    await pool.query(
      `UPDATE persons
       SET name=$1, unit_id=$2, role_id=$3, start_date=$4,
           job_code=$5, stage_override=$6, username=$7, duke_netid=$8
       WHERE id=$9`,
      [name.trim(), unitId, roleId ?? null, startDate,
       jobCode ?? null, stageOverride ?? null, netid, netid, personId],
    );
  } else {
    personId = crypto.randomUUID();
    action = 'created';
    await pool.query(
      `INSERT INTO persons (id, username, duke_netid, name, unit_id, role_id, start_date, job_code, stage_override)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [personId, netid, netid, name.trim(), unitId, roleId ?? null, startDate,
       jobCode ?? null, stageOverride ?? null],
    );
  }

  const { rows } = await pool.query('SELECT * FROM persons WHERE id = $1', [personId]);
  const r = rows[0];
  return {
    action,
    person: {
      id: r.id,
      netid: r.username ?? r.duke_netid,
      name: r.name,
      unitId: r.unit_id,
      roleId: r.role_id ?? undefined,
      startDate: (r.start_date as Date).toISOString().slice(0, 10),
      stageOverride: r.stage_override ?? undefined,
      jobCode: r.job_code ?? undefined,
    },
  };
}
