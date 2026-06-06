---
appName: CareCompetencies
appDescription: CareOps module for DUHS — orientee competency tracking, sign-off workflow, unit-leader dashboards
isPlanMode: false
---

# CareCompetencies — Working Plan

## Current state (end of session 2026-06-01, late)

The reconstructed source tree is in the App Builder sandbox (persistent per-app), with the desktop application working end-to-end against the in-memory store. The ETL SQL set, the deploy package, and the unfinished-work comments file are in Cowork's workspace. Both READMEs are rebranded. The standards-doc skeleton (`enterprise-app-standards-skeleton.md`) is also in the Cowork workspace, ready for the architecture team.

**No code was written this session.** This session was design, decisions, and discovery of a better workflow (see "Workflow correction" below). The mobile build itself happens next session.

## Workflow correction (important — read first next session)

The App Builder sandbox **persists per-app**, not per-session. Opening CareCompetencies via the "Edit" button on the app list reconnects to the existing sandbox with the existing files intact. This was discovered late in this session and corrects the rehydration ritual.

**Correct rehydration at session start:**
1. Open the project via the Edit-CareCompetencies button (not a fresh chat). This restores the sandbox.
2. Attach this `plan.md` to the first message. This restores App Builder's mental context.
3. App Builder uses `list_folders` and `read_files` to inspect the sandbox directly — no source-file pasting needed.

The Cowork workspace remains the durable home for artifacts intended for humans (deploy package, standards skeleton, comments file). Files for App Builder live in the sandbox and don't need to be re-shuttled.

## Inter-channel summary

- **App Builder sandbox** — canonical home for the running demo app. Persistent per-app.
- **Cowork workspace** — durable file store for artifacts intended for humans (deploy package, ETL SQL set, standards skeleton, plan.md backup, comments file).
- **Drift between them is expected and acceptable.** The deploy package is a snapshot for DUHS data/enterprise architects to attempt a deployment with; the App Builder sandbox is where new features land first. They sync when there's a reason to (e.g., a new deploy snapshot).

## Decisions locked this session — mobile preceptor + RN flow

All decisions below are final unless explicitly revisited.

### Scope
Four mobile-optimized views:
1. RN landing (mobile) — read-only, faithful to desktop's per-stage rollup
2. Preceptor landing (mobile) — orientee tiles with stage + progress, tap to drill in
3. Preceptor observe-steps (mobile) — per-step capture with three-state segmented controls
4. Preceptor sign-off (mobile) — attestation page

### Routing — option 3b + 4b
- Existing flat routes (`/observe`, `/sign-off`, `/my-orientees`, `/my-competencies`) stay; they branch internally on `useIsMobile()` to render desktop or mobile components.
- Three new nested routes for mobile drill-in:
  - `/my-orientees/:nurseId` — orientee detail
  - `/my-orientees/:nurseId/observe/:competencyId` — mobile observe
  - `/my-orientees/:nurseId/sign-off/:competencyId` — mobile sign-off
- Mobile users hitting `/observe` or `/sign-off` directly are redirected to `/my-orientees` (mobile flow enters via orientee selection).

### Chrome — 3b with extracted nav model
- Extract `getNavItems()` from `Sidebar.tsx` into `components/layout/nav-items.ts` (shared source of truth).
- Sidebar imports from the new location (one-line change).
- New `MobileChrome.tsx` renders a top header (reusing existing Header look) + bottom tab bar.
- `_layout.tsx` branches: desktop renders `<Sidebar /> + <Header />`, mobile renders `<MobileChrome />`.
- **Discovery:** the existing mobile chrome has *no navigation* — Sidebar is `hidden md:flex` and Header has no menu. The new MobileChrome fills a real gap.

### Mobile breakpoint
- `useIsMobile()` at 768px (Tailwind `md` boundary, matches existing Sidebar/Header).

### Bottom tab bar contents
- **Preceptor / Unit Leader:** My Orientees, Observe, Sign off (3 tabs).
- **Nurse:** My Competencies (single labeled header, not a tab bar — a 1-item bar is silly).
- **Administrator on mobile:** "Open on desktop for full functionality" message with sign-out. Admin work is not a phone use case.

### Observe page mechanics
- Per-competency capture with **three-state segmented controls per step**: Satisfactory / Unsatisfactory / — (Not Observed). Checkboxes can't represent three states.
- Per-step audit row (matches desktop). One `recordObservation` per step with a Sat/Unsat value; "—" skips the step.
- `observedAt` hardcoded to `new Date().toISOString()` — no date picker on mobile.
- One notes textarea applies to the whole competency capture session.
- Voice (Level 1): notes-field dictation only via Web Speech API. No voice commands for rating. Level 2/3 deferred.

### Sign-off page mechanics
- Independent of observations (matches desktop — sign-off does not require prior step observations).
- Captures `preceptorId = currentLogin.id` and writes audit row with actor identity. Conceptual identity capture; production will replace with Entra-backed identity via the same field.
- Includes `earnedAtUnitId = nurse.unitId` for cross-train provenance.
- **No duplicate-signoff soft guard for v1.** Matches desktop behavior. Add later if real preceptors fat-finger sign-offs.

### Online-only
- No offline support. Hospital wifi is reliable. Designed so offline can be added later.

### Orientee-first navigation
- Confirmed: preceptor lands on orientee list, taps to drill into competencies for that orientee. Structured so a flip to competency-first later is a small change, not a rewrite.

## Files to be written next session

In rough order:
1. `src/hooks/use-is-mobile.ts` — viewport-width hook at 768px
2. `src/components/layout/nav-items.ts` — extract `getNavItems` from Sidebar
3. `src/components/layout/Sidebar.tsx` — one-line import change
4. `src/components/layout/MobileChrome.tsx` — new top header + bottom tab bar
5. `src/pages/_layout.tsx` — `useIsMobile()` branch
6. `src/App.tsx` — add 3 nested mobile routes
7. `src/pages/mobile/my-orientees-mobile.tsx` (or equivalent — final naming TBD)
8. `src/pages/mobile/orientee-detail-mobile.tsx`
9. `src/pages/mobile/observe-mobile.tsx`
10. `src/pages/mobile/sign-off-mobile.tsx`
11. `src/pages/mobile/my-competencies-mobile.tsx`
12. Wire `/observe`, `/sign-off`, `/my-orientees`, `/my-competencies` to branch internally on `useIsMobile()`.

App Builder verifies build at the end.

## Other in-flight tracks (not next, but queued)

### Track — Programmatic / API access mock
- Admin-only `/admin/api-explorer` page with tabs per endpoint.
- Snake_case JSON shape mirroring `dim.*` / `fact.*` warehouse fields.
- Read A: person → completed competencies. Read B: competencies → qualified people, with N-1 partial matches. Write C: upsert person from ERP.
- All writes capture `X-Source-System` in audit.
- **Treat the JSON shapes as the canonical contract spec** for the future real API tier, not throwaway demo data. The mock becomes the requirements doc for the integration build.

## Unfinished-work punch list (from Cowork workspace comments file)

Production-readiness gaps, **not** blocking the next-session work:
1. Auth is a stub (`data/auth.tsx`, `AuthGate.tsx`, `pages/login.tsx`) — needs Entra/MSAL.
2. Data is in-memory (`data/store.tsx`) — swap path is React Query against a real API.
3. `App.tsx:28` deploy-path handling (root vs subpath); `AppErrorBoundary.tsx:16` telemetry hook.
4. `data/seed.ts:236` — one Unit Leader per unit placeholder until DUHS provides the real org chart.

## Open questions (parked)

**SME input needed:**
- Orientee-first vs competency-first preceptor navigation (tentative orientee-first confirmed; revisit after SME demo)
- Batched observations support
- Natural-language voice utterances (Level 2/3)

**DUHS input needed:**
- Which HR system is master (Workday? PeopleSoft?)
- Sync cadence
- Whether ERP-sourced fields should render read-only with a "managed by" badge

## Architectural framing

Three deliverables on three maturity tracks:
1. **Front end** — design-complete, demo-ready, deployable as static site. Job: prove the experience.
2. **Database** — schema-complete (etl/), deployable as-is. Job: prove the data model.
3. **API tier** — doesn't exist yet, and shouldn't yet. The mock API explorer becomes the spec.

Likely integration path: Power Platform / Copilot Studio + Azure SQL or Fabric, given DUHS's Microsoft-shop context. Path of least resistance for identity, audit, governance.

## Side track — Enterprise standards skeleton

`enterprise-app-standards-skeleton.md` lives in Cowork's workspace. Ten sections (Identity, Data Tier, API Contracts, Audit, Deployment, Schema/Naming, Front-End, Data Classification, Integration, Meta-Rule), each with intent / covers / why and a suggested owner. First-draft strategy: harvest implicit decisions already in CareCompetencies as the empirical basis for v1.

## Tooling gaps to escalate

1. **App Builder lacks a Cowork-style workspace folder.** Concrete feature request: "give App Builder Cowork's workspace tool."
2. **No backend-equivalent of App Builder in the Frontier family yet** that we know of. Worth asking.
3. **File picker rejects `.ts` files; "Custom File Types" dropdown hangs.** Mundane but real friction.
4. **App Builder's session-resumption behavior is not self-evident.** A fresh chat presents a clean tool surface; the persistent sandbox connection is not visible without context. A "you previously wrote N files; here's the manifest" affordance at session start would eliminate confusion. Worth mentioning.

## Session log

- **Session N (prior):** Reconstruction Rounds 1–12. Punch list captured in Cowork comments file.
- **Session 2026-06-01:** Confirmed Cowork-to-App-Builder read channel via file attach. Captured architectural framing (three-tracks vs. two-islands). Drafted enterprise standards skeleton. Locked all mobile-flow decisions. **Discovered persistent-sandbox behavior late in session — corrected rehydration ritual.** No code written; mobile build deferred to next session.
- **Session N+2 (next):** Open via Edit-CareCompetencies button. Attach this plan.md. Build the mobile track per the decisions and file list above.