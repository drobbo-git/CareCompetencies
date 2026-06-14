# CLAUDE.md — CareCompetencies

> This file orients any agent — and any new team member — working in this repository.
> Read this before doing anything else. Keep it current: if you make a decision or
> discover a gotcha that isn't written down anywhere else, it probably belongs here.

## What This System Is

CareCompetencies is a clinical competency tracking tool for Duke University Health System
(DUHS). It allows orientees (newly hired clinical staff) to track their required
competencies across three stages (Core → Orientation → Education), and allows preceptors
and unit leaders to record step-by-step observations and sign off on completed
competencies. Administrators manage the competency catalog and review change requests.

This is a prototype under active development. The React frontend is feature-complete and
runs against an in-memory data store. The Express API and Azure SQL database are built and
seeded but **the frontend is not yet wired to the real backend** — that migration is the
next major work item. See "Current Status" below.

## Architecture at a Glance

- **Frontend:** React 18 + TypeScript, Vite 7, Tailwind CSS 4, shadcn/ui. Lives in
  `source/`. Fetches all data from the Express API via TanStack Query. The API base URL
  is set in `source/.env.local` (`VITE_API_BASE_URL=http://localhost:3001` for local dev).
- **Backend / API:** Node.js + Express + TypeScript. JWT-based auth (dev stub — shared
  password, not Entra). Lives in `api/`. 9 route files covering all entities.
- **Database:** Azure SQL Server. Operational schema at `api/src/schema.sql`.
  ETL/warehouse scripts at `etl/`.
- **Authentication:** Currently a stub — any username in the DB + the `DEV_PASSWORD`
  environment variable grants access; a 12-hour JWT is issued. Planned: Entra ID / MSAL.
- **Integrations:** None currently wired. Planned: PeopleSoft/LDAP nightly HR sync for
  person data.
- **Deployment:** API containerized via `Dockerfile.api`, deployed via `railway.toml`.
  Frontend is a static Vite build, deployable to Azure Static Web Apps, IIS, or any CDN.
  See `deploy/README.md`.

The frontend and API are **connected**. `source/src/data/store.tsx` uses TanStack Query
to fetch from and mutate the API. `source/.env.local` sets `VITE_API_BASE_URL` for local
dev; the Railway dev/prod deployments use their own environment variables for this.

## Domain Concepts You Need to Know

- **Stage** — One of three sequential windows in an orientee's first year: Core (0–30
  days), Orientation (30–90 days), Education (90–180 days). Duration defaults are in
  `STAGE_DAYS` in `source/src/data/types.ts`; some units override them via
  `Unit.stageDays`. Always read via `getStageDays(unit)`, not `STAGE_DAYS` directly.
  Stage applies to *assignments*, not people — `CompetencyAssignment` rows are keyed to
  `(unit, role, stage)`.

- **StageOrFully** — The broader type for a person's current status. Extends `Stage` with
  `FullyOriented` (all three stages complete; shown as "Continuous Learning" in the UI)
  and `Nonclinical` (stage concept doesn't apply, e.g. admin staff). Stored as
  `persons.stage_override` when set; `null` means stage is computed from `start_date`.

- **Preceptor** — An experienced RN paired one-to-one with an orientee via
  `persons.primary_preceptor_id`. Signs off competency steps and whole competencies for
  their paired orientees. **Any preceptor on the unit can sign off any competency** —
  there is no competency-level preceptor qualification (confirmed by SME; see
  `sme-comments.txt`).

- **Unit Leader** — Holds both `Preceptor` and `UnitLeader` privilege rows in
  `person_privileges`. Sees all incomplete orientees on their unit (not just their paired
  ones). The JWT for a UnitLeader merges unit IDs from both privilege rows.

- **Privilege vs SystemRole** — `person_privileges` stores fine-grained rows (`Preceptor`,
  `UnitLeader`, `Administrator`). The JWT and all API auth checks use a derived
  `systemRole` (highest privilege wins: Administrator > UnitLeader > Preceptor > Person).
  These are different things. Don't conflate them.

- **CompetencyAssignment** — Assigns a competency to a `(unit, role, stage)` tuple. Every
  person on that unit with that clinical role inherits the competency requirement at that
  stage. This is *not* an assignment to a specific person.

- **Sign-off vs Observation** — A `StepObservation` records a preceptor's per-step rating
  (Satisfactory / Unsatisfactory / NotObserved). A `CompetencyAchievement` is the sign-off
  on the whole competency. **Sign-off does not require prior step observations** — this
  matches current DUHS workflow and is intentional.

- **Cross-train credential** — A `CompetencyAchievement` where `earned_at_unit_id` differs
  from the person's current home unit. Shown separately as "Other Competencies" with
  provenance. See `source/src/lib/other-competencies.ts`.

- **CompetencyCategory** — Legacy color-tag classification. **Deprecated in the UI.**
  Still in the DB and TypeScript types for back-compat with existing data. Do not build
  new features on `categoryId` / `category_id`. Use `CompetencyGroup` instead.

- **Unit** — A functional nursing unit (e.g. "DN 4100 General Medicine"), not a cost
  center. One home unit per person. Units are not mapped to cost centers (confirmed SME).

## Repository Structure

```
CareCompetencies/
  CLAUDE.md          — this file
  source/            — React frontend (see source/README.md for full details)
    src/
      data/          — types.ts (domain types), store.tsx (in-memory store), auth.tsx
      lib/           — pure helpers: utils, query-client, competency-summary, etc.
      components/    — UI components (shadcn/ui primitives are generated, not committed)
      pages/         — one file per route
    e2e/             — Playwright tests (run against in-memory frontend, not the API)
    public/
      carecompetencies_seed.json   — seed data loaded at frontend boot
  api/               — Express API (Node 20 + TypeScript)
    src/
      routes/        — one file per resource (auth, persons, competencies, etc.)
      middleware/    — auth.ts: JWT verification, AuthPayload type
      lib/           — scopeFilter.ts: role-scoped WHERE clauses
      schema.sql     — SQL Server operational schema (idempotent, safe to re-run)
      seed.ts        — loads etl/data/carecompetencies_seed.json into the DB
      db.ts          — mssql connection pool with pg-compatible query interface
  etl/               — SQL Server + Fabric ETL scripts (see etl/README.md)
    data/
      carecompetencies_seed.json   — canonical seed extract (source of truth for seeding)
    sqlserver/       — numbered SQL scripts (run in order: 01 → 06)
    fabric/          — Lakehouse PySpark notebook + Fabric Warehouse SQL
  doc/               — documentation
    adr/             — Architecture Decision Records
  deploy/            — deployment runbook and config
  Dockerfile.api     — Docker image for the API tier
  railway.toml       — Railway deployment config
  plan.md            — session planning notes (not project documentation)
  sme-comments.txt   — SME email responses on data model questions
```

## Conventions

- **Path alias:** `@/foo` resolves to `source/src/foo`. Configured in
  `source/tsconfig.app.json` and `source/vite.config.ts`.
- **Stage durations:** Always use `getStageDays(unit)` from `types.ts`, not `STAGE_DAYS`
  directly — per-unit overrides exist on `Unit.stageDays`.
- **Local-time dates:** Use `todayLocalISODate()` and `localDateStringToISO()` from
  `@/lib/utils` for any UI date input. Raw `new Date().toISOString()` produces UTC and
  will silently shift sign-off dates by a day for users in negative-offset timezones.
- **Audit logging:** Every API write should pair with a POST to `/audit-events`. The
  caller provides the human-readable summary; routes do not log automatically.
- **API parameter syntax:** Route files use PostgreSQL `$1/$2` placeholder syntax.
  `api/src/db.ts` translates these to SQL Server `@p1/@p2` at runtime. This is
  intentional — do not switch route files to `@p` syntax.
- **shadcn/ui primitives:** Generated on install, not committed to source. Run the
  `bunx shadcn@latest add ...` command from `source/README.md` after cloning.
- **NOTE(ai): / TODO(ai): comments** in frontend code are guardrails from the original
  generation process. Safe to delete; they don't affect runtime.

## Where to Look For...

- **API contract:** `doc/api-contract.md` [TODO]
- **Data model:** `api/src/schema.sql` (operational schema) + `source/src/data/types.ts`
  (TypeScript source of truth with inline business-meaning comments) + `etl/README.md`
  (ETL/warehouse schema)
- **Architecture decisions:** `doc/adr/`
- **Deployment & operations:** `deploy/README.md`
- **Frontend-specific guidance:** `source/README.md`
- **ETL guidance:** `etl/README.md`
- **SME input on data model:** `sme-comments.txt`

## Known Gotchas / Things That Look Wrong But Aren't

- **`api/.env.example` opens with `DATABASE_URL=postgresql://...`** — this is a stale
  leftover from before the SQL Server migration. Only the `DB_SERVER / DB_PORT / DB_NAME /
  DB_USER / DB_PASSWORD` vars are used. The `DATABASE_URL` line is dead; ignore it.

- **Route files use `$1`, `$2` PostgreSQL-style params against SQL Server.** This is
  intentional. `api/src/db.ts` translates `$N` placeholders to `@pN` before executing.
  Do not change route files to use `@p` syntax.

- **`assignments.ts` contains a T-SQL MERGE statement alongside `$N` params.** The `$N`
  params in the MERGE VALUES clause are translated normally; the MERGE construct itself
  passes through as T-SQL. This is the one place T-SQL constructs appear directly in
  route code; it's unavoidable because SQL Server doesn't support `ON CONFLICT DO UPDATE`.

- **`dbo.competencies.unit_ids` is a JSON column, not a bridge table.** The ETL schema
  normalizes this to `dim.competency_unit_bridge`, but the operational API reads and
  writes it as a JSON array. Don't add a bridge table to the operational schema without
  migrating the API routes.

- **`CompetencyCategory` still exists in DB and TypeScript types.** It's deprecated;
  the UI no longer exposes it. Kept for back-compat with existing seed data. Don't build
  new features on `categoryId` / `category_id`.

- **`step_observations` and `competency_achievements` have no FK to `persons`.** This is
  intentional — these are append-only clinical records and must survive person-record
  updates without cascade deletion. The comment in `schema.sql` explains this.

- **`persons.stage_override` has no CHECK constraint.** It accepts the full `StageOrFully`
  value set (`FullyOriented`, `Nonclinical`, plus the three Stage values). Do not add a
  CHECK constraint that only allows `Core/Orientation/Education`.

- **`/auth/logins` is a public (unauthenticated) endpoint** that lists all persons. This
  is intentional for the dev-stub login dropdown. It must be gated when real Entra auth
  is wired.

- **E2E tests run against the in-memory frontend, not the API.** `playwright.config.ts`
  starts `npm run dev` at port 5174. The API is not involved. Test failures do not
  indicate API bugs.

- **E2E tests use hardcoded seed credentials** (`sh27 / duke24`, `ms41 / duke24`, etc.)
  and hardcoded display names. If seed data changes, tests fail on wrong names — not
  "unknown user."

## Getting Started (Local Development)

### Frontend only (no backend needed)

```bash
cd source
bun install    # or: npm install
bun run dev    # http://localhost:5173
```

The app runs fully against in-memory seed data. Login with the dropdown — any name works.

### API + Database

**Prerequisites:** Node 20+, access to a SQL Server instance.

```bash
cd api
cp .env.example .env    # edit the DB_* and JWT_SECRET vars; ignore DATABASE_URL
npm install
npx ts-node src/seed.ts   # loads etl/data/carecompetencies_seed.json into the DB
npm run dev               # http://localhost:3001/health
```

**Required env vars for local dev:**

| Var | Example |
|---|---|
| `DB_SERVER` | `localhost` |
| `DB_PORT` | `1433` |
| `DB_NAME` | `CareCompetencies` |
| `DB_USER` | `sa` |
| `DB_PASSWORD` | your SA password |
| `JWT_SECRET` | any 64-char random string |
| `DEV_PASSWORD` | `duke24` (matches seed credentials) |
| `FRONTEND_ORIGIN` | `http://localhost:5173` |

*Note: `DB_SERVER !== 'localhost'` triggers `encrypt: true` and longer timeouts in
`db.ts`. This is how the Azure SQL serverless auto-resume delay is handled.*

**Local SQL Server:** [TODO — Docker one-liner or setup instructions]

### E2E Tests

```bash
cd source
npx playwright test
```

Starts the frontend dev server at port 5174 and runs Playwright against it. Tests the
in-memory frontend only; the API is not involved.

## Current Status / In-Flight Work

- **Frontend ↔ API wiring:** Complete. `source/src/data/store.tsx` uses TanStack Query
  against the real API. `source/README.md` is stale on this point — it still describes
  the old in-memory approach.
- **Mobile views:** Preceptor and RN mobile-optimized views are fully designed (see
  `plan.md`) but not yet built.
- **Authentication:** Dev stub only. Real Entra ID / MSAL integration is planned;
  see `doc/adr/` for the auth decision record.
- **HR sync:** PeopleSoft/LDAP nightly sync planned but not built. Person data is
  currently seeded manually.

## Who Owns What (by role, not name)

- **Clinical requirements / competency content:** Nurse Education team (DUHS)
- **SME for data model questions:** Unit clinical leads (see `sme-comments.txt`)
- **Enterprise deployment / hosting decisions:** DHTS (Duke Health Technology Solutions)
- **Application development:** Derek Robinson (lead developer)
