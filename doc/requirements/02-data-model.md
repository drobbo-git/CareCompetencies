# Data Model Sketch — CareCompetencies

> **Purpose:** Defines the entities, relationships, and key constraints of the
> CareCompetencies data model. This sketch was derived from the prototype's
> in-memory data structures and validated against SME input. It is the
> authoritative reference for database schema and API design.
>
> For the implemented SQL schema, see `api/src/schema.sql`.
> For TypeScript type definitions, see `source/src/data/types.ts`.

---

## Entity Overview

```
Unit ──────────────────────────────────────────────────────────┐
  │                                                             │
  ├── Person ──────────────── PersonPrivilege                  │
  │     │                                                       │
  │     ├── primaryPreceptorId → Person                        │
  │     └── stageOverride (FullyOriented | Nonclinical | null) │
  │                                                             │
PersonRole ──── CompetencyAssignment ── Competency ────────────┤
                   (unit, role, stage)      │                   │
                                           ├── CompetencyStep  │
                                           └── CompetencyGroup │
                                                               │
StepObservation (observer → Person, learner → Person, step)    │
CompetencyAchievement (person, competency, earnedAtUnit ───────┘
SelfAssessment (person, competency)
  └── SelfAssessmentStep (step, confidence)
ChangeRequest (competency, submittedBy → Person)
AuditEvent (actor → Person)
```

---

## Entities

### Unit

Represents a functional nursing unit (e.g., "DN 4100 General Medicine").

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `name` | string | Display name |
| `stageDays` | `{ core, orientation, education }` or null | Per-unit stage duration overrides. If null, system defaults apply (Core 30d, Orientation 60d, Education 90d). |

**Constraints:**
- Units are functional units, not cost centers. One person has one home unit.
- Units are not mapped to cost centers (confirmed SME).

---

### Person

A DUHS employee in the system.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `netId` | string | DUHS network ID (e.g., `sh27`). Unique. Used for login. |
| `name` | string | Display name (e.g., "Sara Hayes, RN") |
| `unitId` | UUID → Unit | Home unit. One per person. |
| `roleId` | UUID → PersonRole | Clinical role (RN, NCA, HUC, etc.) |
| `startDate` | date or null | Orientation start date. Null for FullyOriented / Nonclinical. Stage is computed from this value. |
| `stageOverride` | `FullyOriented \| Nonclinical \| null` | Only these two values are valid. Core / Orientation / Education must **never** be stored here — they are always computed from `startDate`. |
| `primaryPreceptorId` | UUID → Person or null | The person's assigned preceptor. Nullable. |
| `jobCode` | string or null | From HR system. Informational only. |

**Stage computation rule:**
```
elapsed = today - startDate (days)
Core:        elapsed in [0, coreDays)
Orientation: elapsed in [coreDays, coreDays + orientationDays)
Education:   elapsed in [coreDays + orientationDays, totalDays)
FullyOriented: elapsed >= totalDays
```
Where `totalDays = coreDays + orientationDays + educationDays` from `getStageDays(unit)`.

---

### PersonRole

Clinical role definition.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `name` | string | e.g., "RN", "NCA", "HUC" |

---

### PersonPrivilege

Grants a person an elevated system privilege on a specific unit.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `personId` | UUID → Person | |
| `privilegeType` | `Preceptor \| UnitLeader \| Administrator` | |
| `unitId` | UUID → Unit | Which unit this privilege applies to |

**Key rules:**
- A person may have multiple privilege rows (e.g., Preceptor on Unit A and UnitLeader on Unit B).
- UnitLeader privilege implies Preceptor capabilities on the same unit.
- `systemRole` (used in the JWT) is the highest privilege across all rows: `Administrator > UnitLeader > Preceptor > Person`.
- Privilege rows are app-managed. HR sync does not modify them.

---

### Competency

A clinical skill that orientees are required to demonstrate.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `name` | string | Display name |
| `description` | string | Full description |
| `unitIds` | JSON array of UUID | Units this competency belongs to. A competency may belong to multiple units. |
| `groupId` | UUID → CompetencyGroup or null | Optional grouping |
| `categoryId` | UUID → CompetencyCategory or null | **Deprecated.** Do not use for new features. |

**Note on `unitIds`:** Stored as a JSON column in the operational database, not a bridge table. The ETL warehouse normalizes this to a bridge table for analytics. Do not add a bridge table to the operational schema without migrating the API routes.

---

### CompetencyGroup

Named grouping for competencies (e.g., "Medication Administration", "IV Therapy").

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `name` | string | Display name |
| `color` | string | Hex color for UI badge |
| `orderIndex` | integer | Display order |

---

### CompetencyStep

An observable step within a competency.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `competencyId` | UUID → Competency | |
| `name` | string | Step description |
| `orderIndex` | integer | Display order within the competency |

---

### CompetencyAssignment

Assigns a competency as required for a specific `(unit, role, stage)` combination.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `competencyId` | UUID → Competency | |
| `unitId` | UUID → Unit | |
| `roleId` | UUID → PersonRole | |
| `stage` | `Core \| Orientation \| Education` | |

**Unique constraint:** `(competencyId, unitId, roleId, stage)` — no duplicate assignments.

**Scope:** This assigns a competency to a *category of people*, not to a specific person. Every person matching `(unit, role)` inherits the requirement at the given stage.

---

### StepObservation

Records a preceptor's rating of an orientee's performance on a single step.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `stepId` | UUID → CompetencyStep | |
| `observerId` | UUID (person ID) | Preceptor who observed. Stored as a value, not a FK. |
| `learnerId` | UUID (person ID) | Orientee being observed. Stored as a value, not a FK. |
| `rating` | `Satisfactory \| Unsatisfactory \| NotObserved` | |
| `observedAt` | datetime | |
| `notes` | string or null | Optional free-text notes |

**Critical constraint:** No foreign keys to `persons`. This table is append-only. Observation records must survive person-record updates, transfers, and deletions without cascade effects. The loose reference is intentional.

**Multiple observations:** The same step may be observed multiple times. All records are retained; the UI surfaces the most recent.

---

### CompetencyAchievement

Records that a person has been signed off on a competency by a preceptor.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `competencyId` | UUID → Competency | |
| `personId` | UUID (person ID) | The earner. Stored as a value, not a FK. |
| `preceptorId` | UUID (person ID) | Who signed off. Stored as a value, not a FK. |
| `achievedAt` | datetime | |
| `earnedAtUnitId` | UUID → Unit | The unit where this was earned. May differ from the person's home unit (cross-train). |

**Critical constraint:** No foreign keys to `persons`. Same rationale as `StepObservation` — append-only clinical record.

**Cross-train:** When `earnedAtUnitId ≠ person.unitId`, the achievement is shown in the "Other Competencies" section with provenance label.

**Sign-off does not require observations:** A `CompetencyAchievement` can be created with no prior `StepObservation` records. This matches DUHS workflow.

---

### SelfAssessment

An orientee's self-rated confidence before working with a preceptor.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `personId` | UUID → Person | |
| `competencyId` | UUID → Competency | |
| `overallRating` | `ReadyForAssessment \| NeedPractice \| NeedInstruction` | |
| `notes` | string or null | |
| `createdAt` | datetime | |

---

### SelfAssessmentStep

Per-step confidence rating within a self-assessment.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `selfAssessmentId` | UUID → SelfAssessment | |
| `stepId` | UUID → CompetencyStep | |
| `confidence` | `HighConfidence \| LowConfidence \| NeverDone` | |

---

### ChangeRequest

A request from any user to add, modify, or remove a competency.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `competencyId` | UUID → Competency or null | Null for "Add" requests (competency doesn't exist yet) |
| `submittedBy` | UUID → Person | |
| `submittedAt` | datetime | |
| `requestType` | `Add \| Modify \| Remove` | |
| `description` | string | Free-text description of the requested change |
| `status` | `Pending \| Approved \| Rejected` | |
| `adminNote` | string or null | Reviewer note |
| `decidedAt` | datetime or null | |
| `decidedBy` | UUID → Person or null | |

---

### AuditEvent

Append-only log of all significant write actions.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `actorId` | UUID → Person | Who performed the action |
| `eventType` | string | e.g., `competency.created`, `achievement.recorded` |
| `summary` | string | Human-readable description (supplied by caller) |
| `entityType` | string or null | e.g., `competency`, `person` |
| `entityId` | string or null | ID of the affected entity |
| `timestamp` | datetime | |
| `metadata` | JSON or null | Additional context |

**Retention:** Audit records must be retained for a minimum of 7 years per DUHS records retention policy.

---

## Key Relationships Summary

| Relationship | Cardinality | Notes |
|---|---|---|
| Person → Unit | Many-to-one | One home unit per person |
| Person → PersonRole | Many-to-one | One clinical role per person |
| Person → PersonPrivilege | One-to-many | Zero or more privilege rows per person |
| Person → primaryPreceptor | Many-to-one (self) | Optional; one preceptor at a time |
| Competency → Unit | Many-to-many | Via `unitIds` JSON array (not a bridge table in operational schema) |
| Competency → CompetencyGroup | Many-to-one | Optional group |
| Competency → CompetencyStep | One-to-many | Ordered by `orderIndex` |
| CompetencyAssignment → (Competency, Unit, PersonRole, Stage) | Many-to-one each | Unique on the 4-tuple |
| StepObservation → (Step, Observer, Learner) | Loose reference | No FK to persons intentionally |
| CompetencyAchievement → (Competency, Person, Unit) | Loose reference | No FK to persons intentionally |
| SelfAssessment → (Person, Competency) | Many-to-one each | Most recent shown in UI |
| SelfAssessmentStep → (SelfAssessment, Step) | Many-to-one each | One per step per assessment |
