# Runbook — CareCompetencies

> Operational reference for deploying, monitoring, and troubleshooting this system.
> Written for someone who has never operated this system before.
> See CLAUDE.md for architecture details.

## System Overview

CareCompetencies has two deployed parts: a static React frontend and a Node/Express API
backed by Azure SQL Server. They are currently independent — the frontend runs against
in-memory data; connecting them is the next development milestone.

## Environments

| Environment | URL | Hosting | Notes |
|---|---|---|---|
| Local dev (frontend) | http://localhost:5173 | Vite dev server | In-memory data, no API needed |
| Local dev (API) | http://localhost:3001 | ts-node-dev | Requires SQL Server |
| Dev (API) | https://carecompetencies-api-dev.up.railway.app | Railway (Docker) | May have features not yet in prod |
| Production (API) | https://carecompetencies-production.up.railway.app | Railway (Docker) | Skunkworks only — see note below |
| Frontend | N/A | Not yet deployed | Static build; target TBD (Azure Static Web Apps or Duke cloud) |

> **Railway is skunkworks infrastructure** owned by the lead developer, not DHTS-managed.
> It is suitable for prototype development but should not be the long-term home for a
> production DUHS application. When this moves beyond prototype, the API should be
> deployed on a Duke-managed cloud environment. See ADR-002 [TODO] for the planned
> hosting direction.

## Deployment

### Frontend

The frontend is a static Vite build. To produce the bundle:

```bash
cd source
bun run build    # output in source/dist/
```

Deploy `source/dist/` to the static host. No environment variables are baked in at
build time for the current in-memory prototype. Once the API is wired:

- Set `VITE_API_BASE_URL`, `VITE_AUTH_CLIENT_ID`, `VITE_AUTH_TENANT_ID` before building.
- For Azure Static Web Apps, route rules go in `staticwebapp.config.json`.
- `vite.config.ts` uses `base: "./"` (relative asset URLs) and
  `inlineDynamicImports: true` (single-bundle output) — both intentional for flexible
  sub-path hosting.

### Backend / API

The API is containerized. `railway.toml` points Railway to `Dockerfile.api` at the
repo root. Railway auto-deploys on push to the configured branch.

**To build and run the container locally:**

```bash
docker build -f Dockerfile.api -t carecompetencies-api .
docker run -p 3001:3001 \
  -e DB_SERVER=... \
  -e DB_PORT=1433 \
  -e DB_NAME=CareCompetencies \
  -e DB_USER=... \
  -e DB_PASSWORD=... \
  -e JWT_SECRET=... \
  -e DEV_PASSWORD=duke24 \
  -e FRONTEND_ORIGIN=https://your-frontend-url \
  carecompetencies-api
```

**Note:** `Dockerfile.api` copies `etl/data/` to `/etl/data/` inside the container.
This is required — `api/src/seed.ts` resolves the seed JSON relative to `__dirname`
and expects to find it at `/etl/data/carecompetencies_seed.json`.

Health check: `GET /health` → `{ status: 'ok' }`. Railway uses this at
`healthcheckPath = "/health"` with a 30-second timeout.

### Database Migrations

The operational schema is `api/src/schema.sql`. All CREATE TABLE and CREATE INDEX
statements are idempotent (guarded by `IF OBJECT_ID ... IS NULL`). Re-running the
file on an existing database is safe.

**To apply schema changes:**

1. Add the new statement to `schema.sql` with an appropriate `IF OBJECT_ID` guard.
2. Run `schema.sql` against the target database.
3. If the change requires a data backfill, write and run a separate one-off script.

There is no migration framework (Flyway, Liquibase, etc.) — `schema.sql` is the single
source of truth. This works at current scale; add versioning if the schema grows complex.

**Seeding:**

```bash
cd api && npx ts-node src/seed.ts
```

Loads `etl/data/carecompetencies_seed.json`. Re-runnable (truncates and reloads).

## Configuration & Secrets

**API environment variables** (set in Railway dashboard or equivalent for prod):

| Var | Purpose | Notes |
|---|---|---|
| `DB_SERVER` | SQL Server hostname | For Azure SQL: `yourserver.database.windows.net` |
| `DB_PORT` | SQL Server port | Default `1433` |
| `DB_NAME` | Database name | `CareCompetencies` |
| `DB_USER` | SQL Server login | |
| `DB_PASSWORD` | SQL Server password | **Never commit** |
| `JWT_SECRET` | Signs JWTs | Generate: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` — **Never commit** |
| `DEV_PASSWORD` | Shared login password (stub auth only) | Remove when Entra auth is live |
| `FRONTEND_ORIGIN` | CORS allowed origin | e.g. `https://your-app.vercel.app` |
| `PORT` | API listen port | Railway sets this automatically |

**What must never be committed:** `DB_PASSWORD`, `JWT_SECRET`. The `api/.env` file is
gitignored. `.env.example` intentionally contains no real values.

**Stale var in `.env.example`:** The `DATABASE_URL=postgresql://...` line is a leftover
from before the SQL Server migration. It is not used by the application. Ignore it.

## Monitoring & Logs

Currently nothing beyond Railway's built-in container logs. No error tracking, no uptime
monitoring, no dashboards. This is a known gap.

**Notable behavior — Azure SQL serverless auto-resume:** The database pauses after a
period of inactivity. The first request after a pause triggers auto-resume, which can
take 30–60 seconds. The API handles this via extended `connectionTimeout` and
`acquireTimeoutMillis` when `DB_SERVER !== 'localhost'` (see `api/src/db.ts`). If the
first request after a cold start times out, retry once — it should succeed.

## Common Issues & Troubleshooting

| Symptom | Likely Cause | What To Do |
|---|---|---|
| First API request times out / 500 after idle | Azure SQL serverless auto-resume | Retry once; DB should be awake on second attempt |
| `LOGIN FAILED` on startup | Wrong `DB_USER`/`DB_PASSWORD`, or Azure SQL firewall blocking the host | Verify env vars; check Azure SQL firewall rules for the API server's IP |
| Frontend shows no data after seeding | Seed ran against wrong DB, or frontend is still reading in-memory store | Confirm `DB_NAME`; note frontend is not yet wired to the API |
| `Invalid or expired token` on API calls | `JWT_SECRET` changed or token >12h old | Re-login to get a fresh token |
| E2E tests fail with unexpected display name | Seed data person names changed | Update hardcoded names in `source/e2e/helpers.ts` |
| shadcn/ui components missing after clone | Primitives are generated, not committed | Run `bunx shadcn@latest add ...` per `source/README.md` |

## Backup & Recovery

[TODO — Azure SQL backup policy: retention period, point-in-time restore procedure,
whether a restore has ever been tested.]

## Incident Response

[TODO — no on-call or escalation path defined yet. For a production incident, contact
the lead developer directly.]

## Access & Permissions

| Role | What's needed | How to request |
|---|---|---|
| Developer | GitHub repo, Railway dashboard, Azure SQL connection string | Ask lead developer |
| Data / ETL engineer | Azure SQL read access, Fabric workspace | Ask DHTS |
| DHTS operations | Railway dashboard or future AKS access | DHTS internal process |

## Cost / Resource Notes

[TODO — Railway tier, Azure SQL tier (serverless? provisioned?), expected monthly cost.]
