# Role & Permission Matrix — CareCompetencies

> **Purpose:** Defines who can see and do what in the system. This is the
> authoritative reference for API authorization logic. Every row in this matrix
> must be enforced server-side — client-side hiding is a UX convenience only,
> not a security control.

---

## Roles

| Role | How Assigned | Description |
|---|---|---|
| **Person** | Default (no privilege rows) | Any DUHS employee with a system account. Can only access their own record. Most clinical staff (RN, NCA, HUC) who are not preceptors or leaders. |
| **Preceptor** | `PersonPrivilege` row with `privilegeType = Preceptor` | Experienced RN authorized to observe and sign off orientees. Scoped to one or more units. |
| **UnitLeader** | `PersonPrivilege` row with `privilegeType = UnitLeader` | Holds both UnitLeader and Preceptor privileges. Sees all orientees on their unit, not just assigned ones. |
| **Administrator** | `PersonPrivilege` row with `privilegeType = Administrator` | System-wide access. Manages competency catalog, assignments, and change requests. |

**Privilege hierarchy:** Administrator > UnitLeader > Preceptor > Person. The JWT carries `systemRole` = highest privilege. Middleware enforces minimum required role per endpoint.

**Unit scoping:** Preceptor and UnitLeader privileges are unit-scoped. A preceptor on Unit A cannot observe orientees on Unit B (unless they also have a privilege row for Unit B). Administrators are not unit-scoped.

---

## Permission Matrix

### Own Record Access

| Action | Person | Preceptor | UnitLeader | Administrator |
|---|---|---|---|---|
| View own competency record | ✅ | ✅ | ✅ | ✅ |
| View own stage and progress | ✅ | ✅ | ✅ | ✅ |
| Submit self-assessment (own) | ✅ | ✅ | ✅ | ✅ |
| View own self-assessments | ✅ | ✅ | ✅ | ✅ |
| View own step observations | ✅ | ✅ | ✅ | ✅ |
| View own achievements | ✅ | ✅ | ✅ | ✅ |
| Submit change request | ✅ | ✅ | ✅ | ✅ |

---

### Orientee / Learner Access

"Same unit" = the learner's home unit matches the viewer's privilege unit.

| Action | Person | Preceptor | UnitLeader | Administrator |
|---|---|---|---|---|
| View paired orientee's record | ❌ | ✅ (paired only) | ✅ (any, same unit) | ✅ (any) |
| View any orientee on same unit | ❌ | ❌ | ✅ | ✅ |
| View any orientee on any unit | ❌ | ❌ | ❌ | ✅ |
| View orientee self-assessments | ❌ | ✅ (paired/searched) | ✅ (same unit) | ✅ |
| Search orientees by name | ❌ | ✅ | ✅ | ✅ |

**Note on preceptor search:** A preceptor may search for any orientee by name and view their record (needed for float/travel nurses and unassigned learners). The achievement-scope check governs what the preceptor can *do*, not whether they can *see*.

---

### Observation & Sign-Off

The achievement-scope rule applies to all sign-off actions: a preceptor may only sign off competencies they have personally achieved (a `CompetencyAchievement` row where `personId` = their own ID). Administrators bypass this check.

| Action | Person | Preceptor | UnitLeader | Administrator |
|---|---|---|---|---|
| Record step observation (paired orientee) | ❌ | ✅ if achieved | ✅ if achieved | ✅ |
| Record step observation (searched orientee) | ❌ | ✅ if achieved | ✅ if achieved | ✅ |
| Record step observation (any orientee, same unit) | ❌ | ❌ | ✅ if achieved | ✅ |
| Sign off competency (paired orientee) | ❌ | ✅ if achieved | ✅ if achieved | ✅ |
| Sign off competency (searched orientee) | ❌ | ✅ if achieved | ✅ if achieved | ✅ |
| Sign off competency (any orientee, same unit) | ❌ | ❌ | ✅ if achieved | ✅ |
| Sign off competency (any orientee, any unit) | ❌ | ❌ | ❌ | ✅ |

**Server enforcement:** The observer/preceptor identity is taken from the JWT — the client cannot supply a different `observerId`. The achievement check queries `competency_achievements` where `person_id` = authenticated caller's ID.

---

### Competency Catalog Management

| Action | Person | Preceptor | UnitLeader | Administrator |
|---|---|---|---|---|
| View competency catalog | ✅ | ✅ | ✅ | ✅ |
| Create competency | ❌ | ❌ | ❌ | ✅ |
| Edit competency (name, description, steps) | ❌ | ❌ | ❌ | ✅ |
| Delete competency | ❌ | ❌ | ❌ | ✅ |
| Manage competency groups | ❌ | ❌ | ❌ | ✅ |
| Manage competency assignments (unit/role/stage) | ❌ | ❌ | ❌ | ✅ |

---

### Change Requests

| Action | Person | Preceptor | UnitLeader | Administrator |
|---|---|---|---|---|
| Submit change request | ✅ | ✅ | ✅ | ✅ |
| View own submitted requests | ✅ | ✅ | ✅ | ✅ |
| View all pending requests | ❌ | ❌ | ❌ | ✅ |
| Approve / Reject change request | ❌ | ❌ | ❌ | ✅ |

---

### Person Management

| Action | Person | Preceptor | UnitLeader | Administrator |
|---|---|---|---|---|
| View person list (same unit) | ❌ | ❌ | ✅ | ✅ |
| View person list (all units) | ❌ | ❌ | ❌ | ✅ |
| Assign primary preceptor | ❌ | ❌ | ✅ (same unit) | ✅ |
| Create / edit person record | ❌ | ❌ | ❌ | ✅ |
| Set stage override (FullyOriented / Nonclinical) | ❌ | ❌ | ❌ | ✅ |
| Manage privilege rows | ❌ | ❌ | ❌ | ✅ |

---

### Reports & Audit

| Action | Person | Preceptor | UnitLeader | Administrator |
|---|---|---|---|---|
| View unit completion report (same unit) | ❌ | ❌ | ✅ | ✅ |
| View unit completion report (all units) | ❌ | ❌ | ❌ | ✅ |
| View audit log | ❌ | ❌ | ❌ | ✅ |
| Export reports | ❌ | ❌ | ❌ | ✅ (not yet implemented) |

---

## Notes for Implementation

1. **Client-side hiding is not security.** Every permission boundary above must be enforced by the API. The UI may hide buttons or tabs for roles that lack access, but a direct API call must fail with HTTP 403 for unauthorized actions.

2. **Scope leakage risk.** The most common mistake is a UnitLeader endpoint that fails to filter by the caller's unit scope, exposing data from other units. Each scoped query must join against the caller's privilege rows.

3. **Achievement scope is per-competency, per-caller.** Do not cache or assume a preceptor can teach all competencies. The check is: `SELECT 1 FROM competency_achievements WHERE competency_id = $1 AND person_id = <caller_id>`.

4. **Administrator bypass is intentional but narrow.** Admins skip the achievement check only. They do not bypass audit logging, and all admin actions are still recorded.
