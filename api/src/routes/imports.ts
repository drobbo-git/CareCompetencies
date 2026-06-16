import { Router } from 'express';
import { pool } from '../db';
import { requireAuth } from '../middleware/auth';
import { upsertPersonByNetId } from '../lib/personUpsert';
import crypto from 'crypto';

const router = Router();

// All import endpoints are administrator-only — this models a bulk HR-style
// file load, manually triggered for now (see CLAUDE.md "Integrations").
router.use(requireAuth, (req, res, next) => {
  if (req.auth!.systemRole !== 'Administrator') {
    res.status(403).json({ error: 'Administrator access required' });
    return;
  }
  next();
});

// Artificial per-row pacing so the job is actually observable as an async
// process when polled, instead of completing before the first poll.
const ROW_DELAY_MS = 200;

interface RowResult {
  row: number;
  netid: string;
  name: string;
  action: 'created' | 'updated' | 'error';
  error?: string;
}

const REQUIRED_COLUMNS = ['netid', 'name', 'unit', 'startdate'] as const;
const COLUMN_ALIASES: Record<string, string> = {
  netid: 'netid', username: 'netid', duke_netid: 'netid',
  name: 'name',
  unit: 'unit', homeunit: 'unit', 'home unit': 'unit',
  role: 'role',
  startdate: 'startdate', 'start date': 'startdate',
  jobcode: 'jobcode', 'job code': 'jobcode',
};

function parseCsv(content: string): { headers: string[]; rows: string[][] } {
  const lines = content.split(/\r\n|\n|\r/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  const splitLine = (line: string) => line.split(',').map((cell) => cell.trim().replace(/^"(.*)"$/, '$1'));
  const headers = splitLine(lines[0]).map((h) => h.toLowerCase());
  return { headers, rows: lines.slice(1).map(splitLine) };
}

function resolveColumns(headers: string[]): Record<string, number> {
  const colIdx: Record<string, number> = {};
  headers.forEach((h, i) => {
    const normalized = COLUMN_ALIASES[h];
    if (normalized && colIdx[normalized] === undefined) colIdx[normalized] = i;
  });
  return colIdx;
}

async function processImportJob(jobId: string, rows: string[][], colIdx: Record<string, number>): Promise<void> {
  const { rows: unitRows } = await pool.query('SELECT id, name FROM units');
  const { rows: roleRows } = await pool.query('SELECT id, name FROM person_roles');
  const unitByName = new Map(unitRows.map((u) => [String(u.name).toLowerCase(), u.id as string]));
  const roleByName = new Map(roleRows.map((r) => [String(r.name).toLowerCase(), r.id as string]));

  const results: RowResult[] = [];
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const cells = rows[i];
    const rowNum = i + 2; // 1-based, +1 for header row
    const netid     = colIdx.netid     !== undefined ? cells[colIdx.netid]?.trim()     : undefined;
    const name      = colIdx.name      !== undefined ? cells[colIdx.name]?.trim()      : undefined;
    const unitName  = colIdx.unit      !== undefined ? cells[colIdx.unit]?.trim()      : undefined;
    const roleName  = colIdx.role      !== undefined ? cells[colIdx.role]?.trim()      : undefined;
    const startDate = colIdx.startdate !== undefined ? cells[colIdx.startdate]?.trim() : undefined;
    const jobCode   = colIdx.jobcode   !== undefined ? cells[colIdx.jobcode]?.trim()   : undefined;

    try {
      if (!netid || !name || !unitName || !startDate) {
        throw new Error('Missing required value (NetID, Name, Unit, StartDate)');
      }
      const unitId = unitByName.get(unitName.toLowerCase());
      if (!unitId) throw new Error(`Unknown unit "${unitName}"`);
      let roleId: string | undefined;
      if (roleName) {
        roleId = roleByName.get(roleName.toLowerCase());
        if (!roleId) throw new Error(`Unknown role "${roleName}"`);
      }
      const result = await upsertPersonByNetId({
        netid, name, unitId, roleId, startDate, jobCode: jobCode || undefined,
      });
      results.push({ row: rowNum, netid, name, action: result.action });
      successCount++;
    } catch (err) {
      results.push({
        row: rowNum, netid: netid ?? '', name: name ?? '', action: 'error',
        error: err instanceof Error ? err.message : String(err),
      });
      errorCount++;
    }

    await new Promise((resolve) => setTimeout(resolve, ROW_DELAY_MS));
  }

  await pool.query(
    `UPDATE import_jobs
     SET status=$1, completed_at=$2, total_rows=$3, success_count=$4, error_count=$5, row_results=$6
     WHERE id=$7`,
    ['Completed', new Date().toISOString(), rows.length, successCount, errorCount, JSON.stringify(results), jobId],
  );
}

// ---------------------------------------------------------------------------
// POST /imports/users
// Body: { filename?: string, content: string }  — content is raw CSV text.
// Creates the job row, kicks off background processing, and returns
// immediately so the caller can poll GET /imports/:id for results.
// ---------------------------------------------------------------------------
router.post('/users', async (req, res, next) => {
  try {
    const { filename, content } = req.body as { filename?: string; content?: string };
    if (!content?.trim()) {
      res.status(400).json({ error: 'content (CSV text) is required' });
      return;
    }

    const { headers, rows } = parseCsv(content);
    const colIdx = resolveColumns(headers);
    const missing = REQUIRED_COLUMNS.filter((c) => colIdx[c] === undefined);
    if (missing.length > 0) {
      res.status(400).json({ error: `CSV is missing required column(s): ${missing.join(', ')}` });
      return;
    }
    if (rows.length === 0) {
      res.status(400).json({ error: 'CSV has no data rows' });
      return;
    }

    const jobId = `imp-${crypto.randomUUID().slice(0, 8)}`;
    await pool.query(
      `INSERT INTO import_jobs (id, type, status, filename, submitted_by, total_rows)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [jobId, 'PersonBulkLoad', 'Processing', filename ?? null, req.auth!.loginId, rows.length],
    );

    // Fire-and-forget: do not await. The HTTP response represents "job
    // accepted," not "job done" — that's the whole point of the async model.
    void processImportJob(jobId, rows, colIdx).catch((err) => {
      console.error(`Import job ${jobId} failed:`, err);
      void pool.query(
        `UPDATE import_jobs SET status=$1, completed_at=$2 WHERE id=$3`,
        ['Failed', new Date().toISOString(), jobId],
      );
    });

    const { rows: jobRows } = await pool.query('SELECT * FROM import_jobs WHERE id = $1', [jobId]);
    res.status(202).json(toJobSummary(jobRows[0]));
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// GET /imports — job history, newest first.
// ---------------------------------------------------------------------------
router.get('/', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT i.*, p.name AS submitted_by_name
       FROM import_jobs i
       LEFT JOIN persons p ON p.id = i.submitted_by
       ORDER BY i.submitted_at DESC`,
    );
    res.json(rows.map(toJobSummary));
  } catch (err) { next(err); }
});

// ---------------------------------------------------------------------------
// GET /imports/:id — full detail including per-row results.
// ---------------------------------------------------------------------------
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT i.*, p.name AS submitted_by_name
       FROM import_jobs i
       LEFT JOIN persons p ON p.id = i.submitted_by
       WHERE i.id = $1`,
      [req.params.id],
    );
    if (rows.length === 0) {
      res.status(404).json({ error: 'Import job not found' });
      return;
    }
    res.json(toJobDetail(rows[0]));
  } catch (err) { next(err); }
});

function toJobSummary(r: Record<string, unknown>) {
  return {
    id: r.id,
    type: r.type,
    status: r.status,
    filename: r.filename ?? undefined,
    submittedBy: r.submitted_by,
    submittedByName: r.submitted_by_name ?? undefined,
    submittedAt: (r.submitted_at as Date).toISOString(),
    completedAt: r.completed_at ? (r.completed_at as Date).toISOString() : undefined,
    totalRows: r.total_rows ?? undefined,
    successCount: r.success_count ?? undefined,
    errorCount: r.error_count ?? undefined,
  };
}

function toJobDetail(r: Record<string, unknown>) {
  return {
    ...toJobSummary(r),
    rowResults: r.row_results ? JSON.parse(r.row_results as string) as RowResult[] : undefined,
  };
}

export default router;
