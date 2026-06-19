# Feature Inventory — CareCompetencies

> **Purpose:** This document captures the business rules behind every screen and
> interaction in the prototype. The prototype shows *what* the UI looks like;
> this document captures *why* each behavior exists. Developers must implement
> the rules, not just reproduce the appearance.
>
> **Status at handoff:** Prototype feature-complete as of 2026-06-19.
> Backend API and database implementation in progress.

---

## 1. Authentication & Login

| Feature | UI Behavior | Business Rule |
|---|---|---|
| Login screen | Username and password fields | **Prototype only.** Real implementation uses Duke SSO (OIT OIDC / Shibboleth). The username/password form exists solely to support demo/dev without an identity provider. Any valid NetID + the shared `DEV_PASSWORD` grants access. |
| Password | Single shared password for all users | **Prototype only.** Shared password (`DEV_PASSWORD` env var) is a dev stub. SSO eliminates per-user passwords. |
| Session | User stays logged in across page refreshes | JWT stored in localStorage. Expires after 12 hours absolute, or after 15 minutes of inactivity (configurable via `SESSION_TIMEOUT_MINUTES`). Both limits enforced. |
| Role determination | Role-specific UI appears immediately after login | System role is derived from privilege rows at login time: Administrator > UnitLeader > Preceptor > Person. Stored in the JWT; not re-queried per request. |
| Session timeout | Warning banner appears 2 minutes before auto-logout | User may click "Stay signed in" to reset timer. Inactivity is defined as no mouse, keyboard, touch, or scroll events. |

---

## 2. Orientee Workspace (My Competencies)

The primary view for clinical staff (RN, NCA, HUC) tracking their own orientation progress.

### 2a. Stage Display

| Feature | UI Behavior | Business Rule |
|---|---|---|
| Current stage label | Shows "Core," "Orientation," "Education," or "Continuous Learning" | Stage is **computed from `startDate`**, never hardcoded. Core = days 0–29; Orientation = days 30–89; Education = days 90–364; FullyOriented (shown as "Continuous Learning") = day 365+. Durations are per-unit defaults; some units override them. Always read via `getStageDays(unit)`. |
| Stage duration overrides | Some units show different stage windows | Units may define custom `stageDays`. If not set, system defaults apply (Core 30d, Orientation 60d, Education 90d). |
| FullyOriented / Nonclinical | No stage badge shown; different UI variant | `stageOverride` field accepts only `FullyOriented` or `Nonclinical`. Core/Orientation/Education must **never** be stored as overrides — they must be computed. |

### 2b. Competencies Achieved Card

| Feature | UI Behavior | Business Rule |
|---|---|---|
| Stage rows | One row per stage (Core, Orientation, Education) showing X of Y achieved | Count is competencies assigned to this person's unit + role + stage that have a `CompetencyAchievement` record for this person. |
| Green shading | Prior stage row has green background | Stage is "complete" if all assigned competencies for that stage are achieved AND the stage is in the past (index < current stage). |
| Amber shading | Prior stage row has amber background | Stage is "incomplete" if it is in the past but has unachieved competencies remaining. This is a valid state — orientees may carry over unfinished prior-stage work. |
| No shading | Current stage row has no background color | Current stage is always unshaded regardless of completion percentage. |
| HoverCard | Hovering a stage row shows competency list for that stage | Lists each competency with achieved/not-achieved indicator. |

### 2c. Competency List

| Feature | UI Behavior | Business Rule |
|---|---|---|
| Competency scope | Only competencies for this person's home unit + role + stage are shown | A person sees **only their own required competencies**. The list does not change based on who is viewing. |
| Achievement indicator | Checkmark / color indicator per competency | Driven by existence of a `CompetencyAchievement` row for this person + competency. |
| Cross-train competencies | "Other Competencies" section below main list | Achievements where `earnedAtUnitId` differs from person's current home unit. Shown with provenance ("Earned at DN 4100"). |
| Competency detail | Clicking a competency shows steps and observation history | Step list + any `StepObservation` records for this person. Most recent observation per step is shown. |

### 2d. Self-Assessment

| Feature | UI Behavior | Business Rule |
|---|---|---|
| Self-assessment form | RN rates own confidence per step before working with preceptor | Optional. Submitted before a preceptor session. Does not affect achievement status. |
| Confidence scale per step | 3-point scale: High confidence / Low confidence / No experience | Stored per step. The preceptor sees this before recording observations. |
| Mark-all buttons | "All high / All low / All no" buttons rate every step at once | Convenience shortcut; individual steps can still be overridden after. |
| Overall readiness | 3-point scale: Ready for assessment / Need practice / Need instruction | Each option includes a short sub-label explaining its meaning. One per self-assessment submission. |
| Notes field | Optional free-text field for context to the preceptor | Stored with the assessment. Placeholder: "Any context for your preceptor…" |
| Submit validation | Submit button disabled until all steps are rated AND overall readiness is selected | Both are required. A count reminder ("Rate all N steps to continue") appears below the button until complete. |
| One active assessment | Only the most recent self-assessment per competency is shown | Historical assessments are retained in the database but not displayed. |

---

## 3. Preceptor Workspace

Experienced RNs who observe and sign off orientee competencies.

### 3a. My Orientees List

| Feature | UI Behavior | Business Rule |
|---|---|---|
| Paired orientees | List shows orientees where `primaryPreceptorId` = current user | A preceptor is paired one-to-one with an orientee via the person record. Pairing is managed by the Unit Leader or Administrator. |
| Search for other orientees | Search field finds any orientee by name | For float/travel nurses and unassigned learners. A preceptor may observe any orientee they find via search, subject to the achievement-scope rule below. |

### 3b. Competency Scope (Critical Business Rule)

| Feature | UI Behavior | Business Rule |
|---|---|---|
| What a preceptor can teach | Preceptor sees the orientee's competency list | The **orientee's** home unit + stage determines what competencies are shown. |
| What a preceptor can sign off | Preceptor can only sign off competencies they have personally achieved | A preceptor may sign off (or record observations for) a competency only if they have a `CompetencyAchievement` row for that competency themselves. This is checked server-side using the authenticated caller's ID — not client-supplied data. |
| Exception: Administrators | Administrators may sign off any competency | Admins bypass the achievement check to allow bootstrapping brand-new competencies with no prior achievers. |
| Same-unit common case | A preceptor can teach all their home unit's competencies | Because preceptors are achievers of their unit's full catalog, the achievement check passes automatically for home-unit competencies. No special-casing needed. |

### 3c. Observation Recording

| Feature | UI Behavior | Business Rule |
|---|---|---|
| Step ratings | Per-step rating: Satisfactory / Unsatisfactory / Not Observed | Stored as `StepObservation` rows. Append-only — no editing or deletion. |
| Multiple observations | Same step can be observed multiple times | All observations are retained. Most recent rating is what the UI surfaces. |
| Observer identity | Observer is always the authenticated user | Client cannot supply a different observerId. Server uses the JWT to determine who is recording. |

### 3d. Sign-Off (Competency Achievement)

| Feature | UI Behavior | Business Rule |
|---|---|---|
| Sign-off button | One-tap sign-off on whole competency | Creates a `CompetencyAchievement` record. |
| No observation prerequisite | Sign-off does not require prior step observations | This matches current DUHS workflow. A preceptor may sign off a competency without having recorded any step observations. Intentional. |
| Achievement is permanent | No UI to remove an achievement | `competency_achievements` is append-only. Achievements survive person-record updates. |
| Self-assessment visibility | Preceptor sees the orientee's self-assessment before observing | Shown read-only. Helps preceptor understand where the orientee feels confident vs. uncertain. |

---

## 4. Unit Leader Dashboard

Unit Leaders hold both Preceptor and UnitLeader privileges. They inherit all preceptor capabilities and gain additional visibility.

| Feature | UI Behavior | Business Rule |
|---|---|---|
| All orientees visible | Dashboard shows every orientee on the unit | Not limited to paired orientees. Scope is determined by the UnitLeader privilege rows in `person_privileges`. |
| Aggregate metrics | Weekly observation counts, orientee progress summaries | Displayed as charts/counts. Data is aggregated server-side — not computed from full row loads. |
| Orientee detail | Can click any orientee to see their full competency record | Same view as preceptor orientee detail. Subject to same achievement-scope rule for sign-off. |
| Preceptor assignment | Can assign a primary preceptor to an orientee | Sets `primaryPreceptorId` on the person record. Only one primary preceptor per orientee at a time. |

---

## 5. Administrator — Competency Catalog

| Feature | UI Behavior | Business Rule |
|---|---|---|
| Create competency | Form with name, description, group, unit assignment, steps | The unit field on a competency indicates which units' catalogs it belongs to (stored as a JSON array of unit IDs). This is distinct from the requirement assignment — *who* must complete the competency is determined by (unit + clinical role + stage) in the Competency Assignments screen (Section 6). Group assignment is optional. |
| Edit competency | Edit any field including steps | Step edits are a full replace — the PUT endpoint replaces all steps for a competency. Order is explicit via `orderIndex`. |
| Delete competency | Remove from catalog | Cascades to `CompetencyAssignment` rows. Does **not** delete `CompetencyAchievement` or `StepObservation` records (those are append-only clinical records). |
| Groups | Competencies are organized into named groups with color coding | Groups are ordered via `orderIndex`. A competency may belong to at most one group. |
| CompetencyCategory | Category field exists in data model | **Deprecated.** Do not build new features on `categoryId`. Kept for back-compat with existing seed data only. Use `CompetencyGroup` instead. |

---

## 6. Administrator — Competency Assignments

| Feature | UI Behavior | Business Rule |
|---|---|---|
| Assignment scope | Assign a competency to a (unit, role, stage) tuple | Every person on that unit with that clinical role inherits the requirement at that stage. This is not a person-level assignment. |
| Unique constraint | One assignment per (competency, unit, role, stage) | Duplicate assignments are rejected. |
| Stage applies to assignments | "Core" assignment means all Core-stage orientees in that unit+role | Stage on an assignment does not follow the person — it is a static property of the requirement. |

---

## 7. Administrator — Change Requests

| Feature | UI Behavior | Business Rule |
|---|---|---|
| Submit change request | Any logged-in user may submit a request to add, modify, or remove a competency | `requestType` is one of: Add, Modify, Remove. Includes free-text description. |
| Review queue | Administrators see all pending change requests | Sorted by submission date. |
| Approve / Reject | Admin clicks Approve or Reject, optionally adds a note | Creates a decision record with timestamp and admin identity. Does **not** automatically modify the catalog — the Administrator must make catalog changes separately after approving. |
| Notification | Submitter notified of decision | **Not implemented in prototype.** See out-of-scope list. |

---

## 8. Administrator — Reports

| Feature | UI Behavior | Business Rule |
|---|---|---|
| Competency completion rates | Table of competencies with achievement counts by unit | Scoped to units the administrator has authority over. |
| Filter by unit | Dropdown to filter report to a specific unit | Administrators with multi-unit scope see all units. |
| Export | Download report as PDF or Excel | **Not implemented in prototype.** See out-of-scope list. |

---

## 9. Mobile: Observe (Preceptor)

Mobile-optimized view for recording step observations at the bedside.

| Feature | UI Behavior | Business Rule |
|---|---|---|
| Orientee selection | Search by name or scan QR code | QR code encodes a URL; the device's native camera app scans it and the OS opens the app directly to the orientee's record. No in-app camera integration required. Same achievement-scope rule applies as desktop. |
| Step-by-step rating | Large tap targets: Satisfactory / Unsatisfactory / Not Observed | Identical business rules to desktop observe. Server enforces observer identity via JWT. |
| Offline support | **Not implemented.** | Network required. No offline queuing. |

---

## 10. Mobile: Sign-Off (Preceptor)

| Feature | UI Behavior | Business Rule |
|---|---|---|
| One-tap sign-off | Large button to record competency achievement | Identical rules to desktop sign-off. Achievement-scope check enforced server-side. |
| QR code scan | Scan orientee QR to navigate directly to their sign-off screen | QR encodes a URL. Device native camera handles the scan; no in-app camera permission required. |
