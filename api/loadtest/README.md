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

## Findings after the scoping fix (2026-06-16)

Two changes shipped since the first run:

1. **Preceptor scope fixed** — `GET /competency-achievements` and
   `GET /step-observations` now default to `WHERE person_id = loginId` for
   Preceptor role (own rows only, ~32 achievements / 0 observations). Callers
   pass `?personId=` or `?personIds=` on demand. This eliminated the largest
   class of unscoped reads.
2. **Pool.max raised 10 → 50** — reduces connection-wait queuing under
   moderate concurrency.

**Calibration results after the fix** (achievements only, mixed roles):

| Phase | Arrival rate | Failures | p95 |
|---|---|---|---|
| Tier-2 | 2 req/s | 0% | 191ms |
| Tier-5 | 5 req/s | 0% | 198ms |
| Tier-10 | 10 req/s | 0% | 354ms |
| Tier-20 | 20 req/s | 24% | 3534ms |

Previous baseline: majority failures at 10–20 req/sec. Now: 10 req/s is clean.

**Remaining bottleneck**: UnitLeader `GET /step-observations` still returns the
entire unit's observation history (~4970 rows per unit). When 20+ UnitLeaders
are concurrent, Node.js saturates serializing large JSON arrays and the
connection pool backs up. The full load test (`api-load-test.yml`) still fails
under the 50-VU sustained phase because it includes observations.

**Next fix**: server-side aggregation or lazy loading for UnitLeader observations
— the roster/dashboard only needs achievements for progress computation;
observations should be deferred until a specific person is viewed.
