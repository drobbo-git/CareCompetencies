# Out-of-Scope & Known-Fake List — CareCompetencies

> **Purpose:** Explicitly documents what is *not real* in the prototype and what
> is intentionally out of scope for the initial backend implementation. Without
> this list, developers waste time trying to determine whether missing behavior
> was a deliberate omission or a bug.
>
> **How to read this:** Each item states what the prototype does (or doesn't do),
> what the production behavior should be, and whether it is planned for a future
> phase or explicitly out of scope.

---

## Category A — Prototype Fakes (Must Be Replaced in Production)

These items look functional in the prototype but are not real and must be
replaced before go-live.

### A1. Authentication

| | |
|---|---|
| **Prototype behavior** | Login screen shows a username and password field; any user can log in with their NetID and a shared password (`DEV_PASSWORD`). |
| **Production requirement** | Entra ID SSO via MSAL. Users log in with their DUHS credentials. No shared password. |
| **Impact** | Significant. Requires app registration with DHTS/OIT, MSAL client library integration, and JWT claim mapping. See `06-integration-requirements.md`. |
| **Status** | Planned — Phase 2. ADR in progress. |

### A2. Data Persistence

| | |
|---|---|
| **Prototype behavior** | Data resets on page refresh. The React frontend uses an in-memory store. |
| **Production requirement** | All data persists in Azure SQL Server. API routes handle all reads and writes. |
| **Impact** | Complete. The Express API and Azure SQL database are fully implemented and connected. This item is **resolved**. |
| **Status** | Done. *(Note: in a normal prototype-to-handoff workflow this would be an open item. It is resolved here only because backend development ran in parallel with — and ahead of — this documentation.)* |

### A3. Stage Computation from Start Date

| | |
|---|---|
| **Prototype behavior** | Some demo users had their stage hardcoded as a `stageOverride` value (e.g., `stageOverride: "Orientation"`). This was a seeding convenience. |
| **Production requirement** | Stage is always computed from `startDate`. Only `FullyOriented` and `Nonclinical` may be stored as overrides. Core / Orientation / Education overrides are invalid. |
| **Impact** | Fixed in seed translators (`api/src/seed.ts`, `source/src/data/seed.ts`) as of 2026-06-19. |
| **Status** | Resolved. |

---

## Category B — Missing Features (Planned for Future Phase)

These features were deliberately not built in the prototype or initial backend.
They are expected to be needed but are not in scope for the initial release.

### B1. Email / Push Notifications

| | |
|---|---|
| **Prototype behavior** | No notifications of any kind. Change request approvals, preceptor assignments, and other events are silent. |
| **Production requirement** | Email notifications for: change request approved/rejected (notify submitter); preceptor assignment (notify preceptor and orientee). |
| **Phase** | Future. Requires SMTP relay or Microsoft Graph API access via DHTS. |

### B2. PeopleSoft / HR System Sync

| | |
|---|---|
| **Prototype behavior** | Person data is manually seeded from a JSON file. No live HR connection. |
| **Production requirement** | Nightly sync from SAP (Duke's HR system): name, NetID, unit assignment, job code, employment status. Persons need an `active` flag; inactive employees should be hidden from active views but their records retained. |
| **Phase** | Future. Requires DHTS/HR systems team involvement. See `06-integration-requirements.md`. |


### B4. Report Export

| | |
|---|---|
| **Prototype behavior** | Reports display on screen only. No export button. |
| **Production requirement** | Export to PDF and/or Excel for unit completion reports. |
| **Phase** | Future. |

### B5. Change Request Auto-Apply

| | |
|---|---|
| **Prototype behavior** | Approving a change request updates its status to Approved but does not modify the competency catalog. |
| **Production requirement** | Approving may remain a manual trigger (admin approves and then separately edits the catalog). Auto-apply is a future enhancement. |
| **Phase** | Intentional for initial release; reconsider in Phase 2. |

### B6. Mobile App Packaging

| | |
|---|---|
| **Prototype behavior** | Mobile views are responsive web pages. No app store packaging. |
| **Production requirement** | To be determined based on DHTS MDM policy. Options: PWA (no packaging needed), Capacitor wrapper for app store distribution. |
| **Phase** | Future. Pending DHTS guidance on MDM and app store policies. |

### B7. Offline Support

| | |
|---|---|
| **Prototype behavior** | Fully online. No offline mode. |
| **Production requirement** | Not planned. Network required. If bedside connectivity is an issue, this becomes a Phase 2 concern. |
| **Phase** | Not in scope for initial release. |

---

## Category C — Intentionally Out of Scope

These items were explicitly considered and ruled out. They should not be
re-raised without new SME input.

### C1. Competency Expiry / Renewal

| | |
|---|---|
| **Rationale** | Revalidation workflows are out of scope per SME input. The "Expired" status visible in some UI mockups was explored but not implemented. Do not add an expiry date to `CompetencyAchievement` without revisiting with the nurse education team. |
| **Reference** | `sme-comments.txt` |

### C2. Float Pool Full Workflow

| | |
|---|---|
| **Rationale** | Float pool and travel nurse workflows are partially supported (search-by-name, cross-unit observation) but the full float pool management workflow is not in scope. Confirmed out of scope pending further SME input from Tammi. |
| **Reference** | `sme-comments.txt` |

### C3. Cost Center Mapping

| | |
|---|---|
| **Rationale** | Units in this system are functional nursing units, not cost centers. There is no mapping between units and cost center codes. Confirmed by SME. |

### C4. Multi-Unit Person Assignment

| | |
|---|---|
| **Rationale** | Each person has exactly one home unit. Cross-unit competencies are handled via the cross-train credential model (`earnedAtUnitId`), not by assigning a person to multiple units. |

---

## Category D — Prototype Behaviors That Look Like Bugs But Aren't

These behaviors in the prototype are intentional and should be preserved.

### D1. Sign-Off Without Observations

Sign-off (competency achievement) does not require any prior step observations.
This matches current DUHS workflow. A preceptor may sign off a competency they
have observed informally without recording individual step ratings.

### D2. Append-Only Clinical Records

`step_observations` and `competency_achievements` have no edit or delete UI.
This is intentional. These are clinical records that must be retained intact.

### D3. No CHECK Constraint on `stage_override`

`persons.stage_override` accepts `FullyOriented`, `Nonclinical`, and `null`.
It does not have a CHECK constraint limiting it to those values because the
column's valid value set is defined in application code, not the database.
Do not add a constraint that rejects the full `StageOrFully` value set.

### D5. QR Code Scanning Is URL-Based, Not Camera-Based

QR codes for orientee lookup encode a URL that opens the app in the browser
directly to the correct orientee's record. No in-app camera integration is
required — the device's native camera app scans the code and the OS handles
the URL redirect. This is intentional and fully implemented.

### D4. `CompetencyCategory` in the Data Model

The `categoryId` field on competencies is deprecated and not shown in the UI.
It exists for back-compatibility with seed data. Do not build new features on it.
Use `CompetencyGroup` instead.
