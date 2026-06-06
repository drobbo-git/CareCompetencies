# CareCompetencies

A CareOps module for Duke University Health System — orientee competency tracking,
sign-off workflow, and unit-leader dashboards.

> *Part of CareOps — Integrated Healthcare Operations*

This is the **front-end source code** for the CareCompetencies prototype. It pairs with:

- `../etl/` — SQL Server + Microsoft Fabric data loading scripts
- `../deploy/` — deployment plumbing (Static Web Apps, IIS, Docker)
- `public/carecompetencies_seed.json` — the seed data extract

---

## At a glance

| Aspect | Choice |
|---|---|
| Framework | React 18 + TypeScript 5 |
| Build tool | Vite 7 |
| Styling | Tailwind CSS 4 + tw-animate-css |
| Components | shadcn/ui (New York style, neutral base) |
| Routing | react-router-dom v7 (BrowserRouter) |
| Data fetching | TanStack Query 5 (wired but currently unused — in-memory store) |
| Charts | D3 7 + Recharts 3 |
| Forms / state | React hooks; jotai available but not wired |
| Auth | STUB — username dropdown maps to a SystemRole |
| Data | STUB — in-memory store seeded from public/carecompetencies_seed.json |

The prototype intentionally has no real backend. Every interaction (sign-off, observation, change request, audit event) writes to in-memory React state and is lost on refresh. See "Path to a real backend" below for the migration plan.

---

## Quick start

Prereqs: Node 20+ (or Bun 1.0+)

    bun install
    bunx shadcn@latest add accordion alert aspect-ratio avatar badge breadcrumb button calendar card carousel checkbox collapsible command context-menu dialog drawer dropdown-menu input label menubar navigation-menu progress radio-group resizable scroll-area select separator sheet skeleton switch table textarea toggle tabs
    bun run dev          # http://localhost:5173
    bun run build        # output to dist/
    bun run preview      # serve the built bundle locally

If you don't have Bun, `npm install && npm run dev` works identically.

The `bunx shadcn@latest add ...` line generates the primitives in `src/components/ui/`. They are not committed to source; see `src/components/ui/README.md`.

---

## Project structure

    CareCompetencies/source/
      README.md                 — this file
      index.html                — Vite HTML entry
      package.json              — deps + scripts
      vite.config.ts            — Vite config (base "./", inlineDynamicImports)
      tsconfig*.json            — TypeScript project refs
      components.json           — shadcn/ui generator config
      eslint.config.js          — lint rules
      .gitignore
      public/
        carecompetencies_seed.json   — seed data; fetched at app boot
        FAVICON_NOTE.md
      src/
        main.tsx                — React entry; mounts <App />
        App.tsx                 — Routes; QueryClientProvider; AppProviders; AuthGate
        index.css               — Tailwind import + theme tokens (oklch)
        vite-env.d.ts
        types/
          AppMessage.ts         — postMessage error envelope
        data/                   — domain types + in-memory store + auth
          types.ts              — single source of truth for entity shapes
          store.tsx             — <DataProvider> + useData() hook
          auth.tsx              — <AuthProvider> + useAuth() hook (stub)
          audit.ts              — seed audit events (currently empty)
          seed.ts               — loads carecompetencies_seed.json + translates field names
          _other.ts             — misc constants (PRNG seed, default role id)
        lib/                    — pure helpers (no React imports here)
          utils.ts              — cn() + local-date ISO helpers
          query-client.ts       — TanStack Query defaults
          memory-store.ts       — ephemeral kv store
          other-competencies.ts — derives cross-train rows
          competency-summary.ts — printable summary HTML generator
          seed-json-builder.ts  — (admin only) re-export seed as JSON
          zip-writer.ts         — (admin only) tiny STORE-only ZIP writer
        components/
          ui/                   — shadcn/ui primitives (generate; not committed)
          common/               — shared building blocks (badges, page header, etc.)
          layout/               — Sidebar + mobile Header
          system/               — AppErrorBoundary, AppProviders, AuthGate
          forms/                — dialogs for change requests + competency add/edit
          dashboard/            — D3 chart for unit progress trend
        pages/                  — one file per route
---

## Where to look for common changes

| If you want to… | Edit |
|---|---|
| Add a new route | src/App.tsx + new file in src/pages/ + entry in src/components/layout/Sidebar.tsx |
| Change which roles see a route | getNavItems() in Sidebar.tsx AND add a server-side guard (see Authorization below) |
| Change theme colors | src/index.css (CSS custom properties in :root) |
| Add a new field to nurses | src/data/types.ts (interface) + src/data/seed.ts (translation) + the JSON shape if needed |
| Add a new entity type | src/data/types.ts + src/data/store.tsx (state + mutations) + src/data/seed.ts (load from JSON) |
| Change stage durations | STAGE_DAYS in src/data/types.ts, OR per-unit stageDays override on the Unit |
| Add a chart | src/components/dashboard/ for shared, or directly in the page file for single-use |
| Add a new audit event type | Pass any string in logAudit({ type: "..." }) calls; the Audit Log page filters on substring match |

---

## Roles

There are four System Roles. Routes are filtered in the sidebar by role. Route-level guards must be added when real auth is wired (see Authorization below).

| Role | Sees | Lands on |
|---|---|---|
| Administrator | Catalog, Manage Groups, Assignments, People, Change Requests, Reports, Audit Log | Home (quicklinks) |
| UnitLeader | Unit Orientees, Observe, Sign off, Nurse Roster, Competency Matrix, Catalog, Change Requests, Reports | /unit-leader-dashboard |
| Preceptor | My Orientees, Observe, Sign off, Catalog, Change Requests | Home (quicklinks) |
| Nurse | My Competencies, Catalog | /my-competencies |

A few specific UI behaviors built up across the prototype:

- The "My Orientees" link displays as "Unit Orientees" for Unit Leaders (same route, different label, different scope — preceptor sees their paired orientees; unit leader sees all incomplete orientees on the unit).
- Administrators do NOT see Nurse Roster or Competency Matrix — those are Unit Leader workspaces.
- Default sort on the Nurse Roster is ascending by progress (least-progress nurses at the top).
- The Add Competency dialog shows Group only, not Category. Category is kept in the data model for back-compat but no longer surfaced — see etl/README.md "Recent changes".

---

## Environment variables

These are build-time Vite vars. Set them on the build agent or in `.env.local` for local dev.

| Var | Required? | Example |
|---|---|---|
| VITE_API_BASE_URL | Yes once a real API exists | https://api.carecompetencies.duhs.duke.edu |
| VITE_AUTH_CLIENT_ID | Only with Entra ID | (entra app registration client id) |
| VITE_AUTH_TENANT_ID | Only with Entra ID | (duke tenant id) |
| VITE_APP_ENV | Optional | dev / test / prod |

Until the backend exists, these can be left blank. The app continues to render against the bundled seed JSON.

For one-build-many-environments, see ../deploy/config/runtime-config.md.

---

## Authorization (READ ME)

The current AuthGate is client-side only. Hiding a nav item or rendering an "access denied" message stops nothing — anyone who knows the URL can request it.

When you wire real auth (Entra ID / MSAL), add server-side guards for these routes at minimum:

| Route | Allowed roles |
|---|---|
| /nurses, /nurses/:id | UnitLeader, Administrator |
| /competency-matrix | UnitLeader |
| /unit-leader-dashboard | UnitLeader |
| /groups, /assignments, /people, /audit | Administrator |
| /observe, /sign-off | Preceptor, UnitLeader |
| /my-orientees | Preceptor, UnitLeader |
| /my-competencies | Nurse |

If you deploy to Azure Static Web Apps, the role rules go in staticwebapp.config.json (route.allowedRoles). For IIS / Docker, enforce at the API layer once it exists; for static hosting alone, accept that defense-in-depth depends on the API.

Also update AuditEvent.actor to use the authenticated user identity (not the stub login id).
---

## Path to a real backend

The in-memory store is intentionally a thin facade so the migration is contained. Here's the recipe:

1. Define an API surface that mirrors the entity shapes in src/data/types.ts. The shapes already match the warehouse — see ../etl/sqlserver/03_create_dim_fact_tables.sql.
2. Replace the body of src/data/store.tsx. Keep the useData() hook signature unchanged. Inside:
   - Replace each useState([...]) with useQuery({ queryKey, queryFn }) from TanStack Query (already wired in src/lib/query-client.ts).
   - Replace each mutation (recordObservation, recordAchievement, upsertCompetency, etc.) with useMutation + queryClient.invalidateQueries(...) so dependent screens re-fetch.
3. Replace src/data/seed.ts with a no-op (or delete it and remove imports). The JSON file in public/ is for the prototype only.
4. Wire auth in src/data/auth.tsx to MSAL. Replace seedLogins with the real identity provider; map Entra group membership to SystemRole.
5. No changes to components or pages should be required. If any are, the abstraction broke — fix the data layer, not the component.

For analytics and reporting, point Power BI at the rpt.* views in SQL Server or at the Fabric Gold tables. The in-app Reports page is intentionally minimal.

---

## Build notes

- base: "./" in vite.config.ts — produces relative asset URLs so the bundle can be served from any sub-path without rebuild. Useful for IIS sub-app and Static Web Apps both.
- inlineDynamicImports: true — collapses all chunks into one JS bundle. Simplifies deployment; you trade code-splitting benefits. Remove if your bundle gets large enough that lazy routes start to matter.
- The bundle is large by SPA standards (charts + d3 + recharts + 30+ Radix primitives). At a real DUHS scale that's still fine; if you want it smaller, the easiest wins are removing recharts (we only use it minimally) and removing unused shadcn primitives.

---

## What's NOT included

| Thing | Why | Where to find it |
|---|---|---|
| node_modules/ | Generated by `bun install` | n/a |
| dist/ | Generated by `bun run build` | n/a |
| bun.lock | Lock file is environment-specific | Generated on first install |
| favicon.ico | Binary; can't ride a text-only channel | See public/FAVICON_NOTE.md |
| shadcn/ui primitives | Generate from source | See src/components/ui/README.md |

---

## Conventions worth knowing

- Path alias — `@/foo` resolves to `src/foo`. Configured in tsconfig.app.json and vite.config.ts.
- Stage durations — always read via `getStageDays(unit)` rather than the global STAGE_DAYS constant, so per-unit overrides are honored.
- Local-time dates — use `todayLocalISODate()` and `localDateStringToISO()` from `@/lib/utils` for any UI date input. Naively using `new Date()` and `.toISOString()` will silently roll over to UTC dates and shift sign-off dates by a day in negative-offset timezones.
- NOTE(ai): / TODO(ai): comments — these were guardrails for the original generation process. Safe to delete during cleanup; they don't affect runtime.
- Audit logging — every store mutation should be paired with a `logAudit(...)` call from the caller. The store doesn't do this automatically because the caller has the right context for the human-readable summary.
- Cross-train credentials — competency achievements outside a nurse's home unit + role show up as "Other Competencies" with provenance ("Earned at DN 4100 · Core"). See src/lib/other-competencies.ts.

---

## How to ask for changes

If this app needs new features, two paths:

1. Self-serve — make the change locally, build, deploy. Everything you need is here.
2. Back to App Builder — paste the contents of this folder (or the relevant files) into a fresh App Builder chat with a clear request. The architecture and conventions in this README give the next assistant enough to pick up where this left off.

For ETL or deployment changes, see ../etl/README.md and ../deploy/README.md respectively.

---

## License / attribution

Internal Duke University Health System prototype. Not for distribution.

The CareCompetencies wordmark, four-pointed star logo, and "CareOps" naming
are working titles for DUHS-internal use. The visual palette is subtly
Duke-inspired but uses no Duke logo, wordmark, or registered marks. Replace
or refine with DUHS Brand Standards approval before any external sharing.