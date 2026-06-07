// =============================================================================
// CareCompetencies — Domain Types
// -----------------------------------------------------------------------------
// Single source of truth for the entity model. The ETL package (etl/) mirrors
// these shapes 1:1 in raw/ and a normalized star schema in dim/ + fact/.
// When real persistence replaces the in-memory store, keep the field names
// stable and only swap the storage layer underneath.
// =============================================================================

// -----------------------------------------------------------------------------
// Stages
// -----------------------------------------------------------------------------
// Three working stages an orientee passes through, plus "FullyOriented" once
// year-1 is complete, and "Nonclinical" for staff whose Stage doesn't apply.
//
// STAGE_DAYS holds the DUHS defaults; some units override via Unit.stageDays.
// Use getStageDays(unit) to read the effective per-unit values.
// -----------------------------------------------------------------------------
export type Stage = "Core" | "Orientation" | "Education";
export type StageOrFully = Stage | "FullyOriented" | "Nonclinical";

export const STAGES: Stage[] = ["Core", "Orientation", "Education"];

export const STAGE_DAYS: Record<Stage, number> = {
  Core: 30,
  Orientation: 60,
  Education: 90,
};

// -----------------------------------------------------------------------------
// People
// -----------------------------------------------------------------------------
export interface Unit {
  id: string;
  name: string;
  description?: string;
  costCenter?: string;
  /** Per-unit override of STAGE_DAYS. Read via getStageDays(unit). */
  stageDays?: Partial<Record<Stage, number>>;
  createdAt?: string;
  updatedAt?: string;
}

export interface PersonRole {
  id: string;       // e.g. "r-rn", "r-nca", "r-huc"
  name: string;     // e.g. "Registered Nurse"
}

/** A privilege grants a person access to a set of system functions, optionally scoped to a unit. */
export type Privilege = "Preceptor" | "UnitLeader" | "Administrator";

export interface PersonPrivilege {
  id: string;
  personId: string;
  privilege: Privilege;
  /** Unit scope for Preceptor / UnitLeader; null for Administrator (global). */
  unitId: string | null;
}

export interface Person {
  id: string;
  name: string;                 // "Sally Smith, RN" or "John Doe, NCA"
  unitId: string;
  roleId?: string;              // default "r-rn"
  primaryPreceptorId?: string;
  startDate: string;            // ISO date (yyyy-mm-dd)
  /** When set, overrides the computed stage (e.g. for FullyOriented or Nonclinical). */
  stageOverride?: StageOrFully;
  dukeId?: string;
  jobCode?: string;
}

// -----------------------------------------------------------------------------
// Catalog
// -----------------------------------------------------------------------------
export interface CompetencyCategory {
  id: string;
  name: string;
  color: string;
  description?: string;
}

export interface CompetencyGroup {
  id: string;
  name: string;
  /** Self-FK; null/undefined for root groups. Up to 4 levels deep. */
  parentGroupId?: string | null;
  orderIndex?: number;
  description?: string;
}

export interface Competency {
  id: string;
  name: string;
  description?: string;
  groupId?: string;
  /** Legacy color tag; not surfaced in Add Competency UI. */
  categoryId?: string;
  /** Many-to-many with Unit; normalized to dim.competency_unit_bridge in ETL. */
  unitIds: string[];
}

export interface CompetencyStep {
  id: string;
  competencyId: string;
  name: string;          // step description / instruction
  orderIndex: number;
}

export interface CompetencyAssignment {
  id: string;
  competencyId: string;
  unitId: string;
  roleId: string;
  stage: Stage;
}

// -----------------------------------------------------------------------------
// Activity (immutable facts)
// -----------------------------------------------------------------------------
export type ObservationRating = "Satisfactory" | "Unsatisfactory" | "NotObserved";

export interface StepObservation {
  id: string;
  personId: string;
  stepId: string;
  competencyId: string;
  observerId: string;          // person_bk of the preceptor/unit-leader who observed
  rating: ObservationRating;
  observedAt: string;          // ISO timestamp
  notes?: string;
}

export interface CompetencyAchievement {
  id: string;
  personId: string;
  competencyId: string;
  observerId: string;          // person_bk of the preceptor/unit-leader who signed off
  achievedAt: string;          // ISO timestamp
  notes?: string;
  /** Provenance for cross-train/prior-unit credentials. Defaults to nurse's home unit. */
  earnedAtUnitId?: string;
}

// -----------------------------------------------------------------------------
// Workflow
// -----------------------------------------------------------------------------
export type ChangeRequestStatus = "Pending" | "Approved" | "Rejected";
export type ChangeRequestType = "Add" | "Edit" | "Remove";
export type RequesterRole = "Preceptor" | "UnitLeader";

export interface ChangeRequest {
  id: string;
  requesterId: string;
  requesterRole: RequesterRole;
  type: ChangeRequestType;
  competencyId?: string;
  rationale?: string;
  status: ChangeRequestStatus;
  submittedAt: string;
  adminNote?: string;
}

// -----------------------------------------------------------------------------
// Audit
// -----------------------------------------------------------------------------
export interface AuditEvent {
  id: string;
  timestamp: string;
  actor: string;               // user id
  actorRole: SystemRole;
  type: string;                // e.g. "CompetencyEdited", "ChangeRequestApproved"
  summary: string;
  targetLabel?: string;
  detail?: string;
}

// -----------------------------------------------------------------------------
// Auth / system role
// -----------------------------------------------------------------------------
export type SystemRole = "Administrator" | "UnitLeader" | "Preceptor" | "Person";

export interface Login {
  id: string;                  // person id
  displayName: string;
  systemRole: SystemRole;
  /** Units in scope for this login (Preceptor / UnitLeader); empty for Administrator / Person. */
  unitIds?: string[];
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------
/**
 * Effective stage durations for a given unit, falling back to DUHS defaults.
 * Always prefer this over reading STAGE_DAYS directly.
 */
export function getStageDays(unit: Unit | undefined): Record<Stage, number> {
  return {
    Core: unit?.stageDays?.Core ?? STAGE_DAYS.Core,
    Orientation: unit?.stageDays?.Orientation ?? STAGE_DAYS.Orientation,
    Education: unit?.stageDays?.Education ?? STAGE_DAYS.Education,
  };
}