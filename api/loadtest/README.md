# Load testing

Requires the production-scale synthetic dataset (`npm run seed:load-test`, see
CLAUDE.md) loaded into the local SQL Server container, and the API running
against it (`.env.test`).

```bash
cd api
npm run seed:load-test          # generates 300 units / 21k persons / ~2M observations+achievements
npx dotenv -e .env.test -- npm run dev   # or export the .env.test vars and `npm run dev`
cd loadtest
npx artillery run calibration.yml   # low arrival rates (2-20/sec) — find the actual ceiling
npx artillery run api-load-test.yml # ramps toward the 500-1000 concurrent user target
```

`accounts.csv` is a fixture of synthetic NetIDs across all four roles
(Administrator/UnitLeader/Preceptor/Person), generated from the load-test
seed data — regenerate it if you re-run `seed:load-test` (the IDs are
randomized per run). All accounts use the shared dev password (`duke24`).

## Findings from the first run (2026-06-16)

At this data volume (497k achievements, 1.49M observations), the API failed
well below the 500-1000 concurrent user target — even 10-20 req/sec caused
majority failure rates. Two compounding causes, confirmed by isolating each:

1. **Connection pool exhaustion** (`api/src/db.ts`, `pool.max: 10`) — `SQL
   Server pool error: TimeoutError` floods the logs almost immediately under
   any concurrency. Raising `max` to 50 measurably helped (145→390 successes
   on the same calibration run) but did not fix it alone.
2. **Unscoped reads at volume** — `personScopeFilter`/`personsScopeFilter`
   intentionally return no WHERE clause for Preceptor and Administrator
   roles (Preceptor scope is achievement-based, not person-based — see
   CLAUDE.md "Preceptor"). At this volume that means every Preceptor or
   Administrator request to `GET /persons`, `/step-observations`, or
   `/competency-achievements` pulls the *entire* table — confirmed by
   `http.downloaded_bytes` averaging hundreds of KB per response, some
   requests transferring the full multi-hundred-thousand-row table. This is
   what's actually holding connections open long enough to exhaust even a
   50-connection pool, and is the scalability-plan memory's original
   "fetch everything" concern — the role-based WHERE-clause scoping added
   since then protects UnitLeader/Person from cross-unit data, but does
   nothing to cap *row count* for Preceptor/Administrator.

Pool size alone is a quick partial mitigation; the real fix is pagination
(or a reasonable hard cap) on these list endpoints regardless of role.
