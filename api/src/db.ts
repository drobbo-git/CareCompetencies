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
  pool: {
    max:                10,
    idleTimeoutMillis:  30_000,
    acquireTimeoutMillis: 5_000,
  },
};

let _pool: sql.ConnectionPool | undefined;

async function getPool(): Promise<sql.ConnectionPool> {
  if (!_pool || !_pool.connected) {
    _pool = await sql.connect(sqlConfig);
    _pool.on('error', (err: Error) => console.error('SQL Server pool error:', err));
  }
  return _pool;
}

// Translate PostgreSQL $1,$2,... positional params to SQL Server @p1,@p2,...
// and bind each value on the request object.
function prepareRequest(
  req: sql.Request,
  text: string,
  values?: unknown[],
): string {
  if (!values || values.length === 0) return text;
  let i = 1;
  const translated = text.replace(/\$\d+/g, () => `@p${i++}`);
  values.forEach((v, idx) => req.input(`p${idx + 1}`, v ?? null));
  return translated;
}

interface QueryResult {
  rows: Record<string, any>[];
  rowCount: number;
}

// pg-compatible pool interface — routes call pool.query() exactly as before.
export const pool = {
  query: async (text: string, values?: unknown[]): Promise<QueryResult> => {
    const p = await getPool();
    const req = p.request();
    const sqlText = prepareRequest(req, text, values);
    const result = await req.query(sqlText);
    return {
      rows: (result.recordset ?? []) as Record<string, any>[],
      rowCount: result.rowsAffected?.[0] ?? 0,
    };
  },

  // Returns a transaction-backed client. Callers use client.query('BEGIN'),
  // client.query('COMMIT'), client.query('ROLLBACK') as before.
  connect: async () => {
    const p = await getPool();
    let transaction: sql.Transaction | null = null;

    const client = {
      query: async (text: string, values?: unknown[]): Promise<QueryResult> => {
        const trimmed = text.trim().toUpperCase();

        if (trimmed === 'BEGIN') {
          transaction = new sql.Transaction(p);
          await transaction.begin();
          return { rows: [], rowCount: 0 };
        }
        if (trimmed === 'COMMIT') {
          await transaction!.commit();
          transaction = null;
          return { rows: [], rowCount: 0 };
        }
        if (trimmed === 'ROLLBACK') {
          await transaction!.rollback();
          transaction = null;
          return { rows: [], rowCount: 0 };
        }

        const req = transaction ? new sql.Request(transaction) : p.request();
        const sqlText = prepareRequest(req, text, values);
        const result = await req.query(sqlText);
        return {
          rows: (result.recordset ?? []) as Record<string, any>[],
          rowCount: result.rowsAffected?.[0] ?? 0,
        };
      },
      release: () => { /* pool manages connections automatically */ },
    };

    return client;
  },

  end: async () => {
    if (_pool) {
      await _pool.close();
      _pool = undefined;
    }
  },
};
