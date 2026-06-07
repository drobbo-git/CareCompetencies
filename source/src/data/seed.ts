// =============================================================================
// CareCompetencies — Seed Loader
// -----------------------------------------------------------------------------
// Single source of truth for prototype data is public/carecompetencies_seed.json,
// which is the same extract consumed by the SQL Server / Fabric loaders in
// etl/. We fetch it at app boot and translate field names from the JSON shape
// (aligned with the SQL loader: fullName, outcome, sortOrder, etc.) into the
// TypeScript shape used throughout the app (name, rating, orderIndex, etc.).
//
// To swap in a real backend later:
//   1. Replace fetchSeedJson() with a service call.
//   2. Remove the translation layer if the API mirrors TS shapes directly.
//   3. Leave the rest of the app untouched — every component still consumes
//      these named arrays via @/data/seed.
// =============================================================================

import type {
  Unit, PersonRole, Person,
  PersonPrivilege, Privilege,
  CompetencyCategory, CompetencyGroup, Competency, CompetencyStep,
  CompetencyAssignment, StepObservation, CompetencyAchievement,
  ChangeRequest, Login, Stage, StageOrFully, ObservationRating,
  RequesterRole, ChangeRequestStatus, ChangeRequestType, SystemRole,
} from "./types";
import { DEFAULT_ROLE_ID } from "./_other";

// ---------------------------------------------------------------------------
// JSON shapes (must match the keys produced by lib/seed-json-builder.ts and
// consumed by etl/sqlserver/04_load_raw_from_json.sql). Loose typing on
// purpose — the translation functions below are the contract.
// ---------------------------------------------------------------------------
interface RawSeed {
  schemaVersion?: string;
  generatedAt?: string;
  units: any[];
  personRoles: any[];
  competencyCategories: any[];
  competencyGroups: any[];
  persons: any[];
  personPrivileges: any[];
  competencies: any[];
  competencySteps: any[];
  competencyAssignments: any[];
  stepObservations: any[];
  competencyAchievements: any[];
  changeRequests: any[];
  auditEvents?: any[];
  logins?: any[];
}

// ---------------------------------------------------------------------------
// Synchronous fetch at module load.
// ---------------------------------------------------------------------------
// We do a blocking-style fetch by using a synchronous XHR so module consumers
// can keep importing named arrays. This is fine for a single small JSON load
// at app boot; replace with a real async data layer when wiring an API.
// ---------------------------------------------------------------------------
function loadSeedSync(): RawSeed {
  try {
    const xhr = new XMLHttpRequest();
    const url = new URL("./carecompetencies_seed.json", document.baseURI).toString();
    xhr.open("GET", url, false); // synchronous
    xhr.send(null);
    if (xhr.status >= 200 && xhr.status < 300) {
      return JSON.parse(xhr.responseText) as RawSeed;
    }
    console.error(`Seed load failed (HTTP ${xhr.status}). The app will start empty.`);
  } catch (e) {
    console.error("Seed load threw:", e);
  }
  return {
    units: [], personRoles: [], competencyCategories: [], competencyGroups: [],
    persons: [], personPrivileges: [],
    competencies: [], competencySteps: [], competencyAssignments: [],
    stepObservations: [], competencyAchievements: [], changeRequests: [],
    auditEvents: [],
  };
}

const RAW = loadSeedSync();

// ---------------------------------------------------------------------------
// Translation: JSON shape → TypeScript shape
// ---------------------------------------------------------------------------
function toUnit(u: any): Unit {
  return {
    id: u.id,
    name: u.name,
    description: u.description ?? undefined,
    costCenter: u.costCenter ?? undefined,
    stageDays: u.stageDays ?? undefined,
    createdAt: u.createdAt ?? undefined,
    updatedAt: u.updatedAt ?? undefined,
  };
}

function toPersonRole(r: any): PersonRole {
  return { id: r.id, name: r.name };
}

function toPerson(n: any): Person {
  return {
    id: n.id,
    name: n.fullName ?? n.name ?? "",
    unitId: n.unitId,
    roleId: n.roleId ?? DEFAULT_ROLE_ID,
    primaryPreceptorId: n.primaryPreceptorId ?? undefined,
    startDate: n.startDate ?? n.hireDate ?? "",
    stageOverride: (n.stage ?? n.stageOverride ?? undefined) as StageOrFully | undefined,
    dukeId: n.dukeId ?? undefined,
    jobCode: n.jobCode ?? undefined,
  };
}

function toPersonPrivilege(p: any): PersonPrivilege {
  return {
    id: p.id,
    personId: p.personId,
    privilege: p.privilege as Privilege,
    unitId: p.unitId ?? null,
  };
}

function toCategory(c: any): CompetencyCategory {
  return {
    id: c.id,
    name: c.name,
    color: c.color,
    description: c.description ?? undefined,
  };
}

function toGroup(g: any): CompetencyGroup {
  return {
    id: g.id,
    name: g.name,
    parentGroupId: g.parentGroupId ?? null,
    orderIndex: typeof g.sortOrder === "number" ? g.sortOrder : (typeof g.orderIndex === "number" ? g.orderIndex : 0),
    description: g.description ?? undefined,
  };
}

function toCompetency(c: any): Competency {
  return {
    id: c.id,
    name: c.name,
    description: c.description ?? undefined,
    groupId: c.groupId ?? undefined,
    categoryId: c.categoryId ?? undefined,
    unitIds: Array.isArray(c.unitIds) ? c.unitIds : [],
  };
}

function toStep(s: any): CompetencyStep {
  return {
    id: s.id,
    competencyId: s.competencyId,
    name: s.description ?? s.name ?? "",
    orderIndex: typeof s.sortOrder === "number" ? s.sortOrder : (typeof s.orderIndex === "number" ? s.orderIndex : 0),
  };
}

function toAssignment(a: any): CompetencyAssignment {
  return {
    id: a.id,
    competencyId: a.competencyId,
    unitId: a.unitId,
    roleId: a.roleId,
    stage: a.stage as Stage,
  };
}

function toObservation(o: any): StepObservation {
  return {
    id: o.id,
    personId: o.personId ?? o.nurseId,
    stepId: o.stepId,
    competencyId: o.competencyId,
    observerId: o.preceptorId ?? o.observerId,
    rating: (o.outcome ?? o.rating) as ObservationRating,
    observedAt: o.observedAt,
    notes: o.note ?? o.notes ?? undefined,
  };
}

function toAchievement(a: any): CompetencyAchievement {
  return {
    id: a.id,
    personId: a.personId ?? a.nurseId,
    competencyId: a.competencyId,
    observerId: a.preceptorId ?? a.observerId,
    achievedAt: a.achievedAt,
    notes: a.note ?? a.notes ?? undefined,
    earnedAtUnitId: a.earnedAtUnitId ?? undefined,
  };
}

function toChangeRequest(cr: any): ChangeRequest {
  return {
    id: cr.id,
    requesterId: cr.requesterId,
    requesterRole: (cr.requesterRole ?? "Preceptor") as RequesterRole,
    type: (cr.requestType ?? cr.type ?? "Edit") as ChangeRequestType,
    competencyId: cr.targetId ?? cr.competencyId ?? undefined,
    rationale: cr.payload?.rationale ?? cr.rationale ?? cr.note ?? "",
    status: (cr.status ?? "Pending") as ChangeRequestStatus,
    submittedAt: cr.createdAt ?? cr.submittedAt ?? new Date().toISOString(),
    adminNote: cr.payload?.adminNote ?? cr.adminNote ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Synthesize logins from persons + privileges.
// ---------------------------------------------------------------------------
function synthesizeLogins(
  persons: Person[],
  privileges: PersonPrivilege[],
  units: Unit[],
): Login[] {
  const logins: Login[] = [];

  // One login entry per privilege type, grouped by person.
  // Admins get a single global login.
  // Preceptors and UnitLeaders get a login showing their scoped units.
  const adminPersonIds = new Set(
    privileges.filter((p) => p.privilege === "Administrator").map((p) => p.personId)
  );

  for (const personId of adminPersonIds) {
    const person = persons.find((n) => n.id === personId);
    if (!person) continue;
    logins.push({
      id: person.id,
      displayName: `${person.name} (Administrator)`,
      systemRole: "Administrator",
    });
  }

  // Collect unit leader person ids and their scoped units.
  const ulMap = new Map<string, string[]>();
  for (const p of privileges.filter((pp) => pp.privilege === "UnitLeader")) {
    if (!ulMap.has(p.personId)) ulMap.set(p.personId, []);
    if (p.unitId) ulMap.get(p.personId)!.push(p.unitId);
  }
  for (const [personId, unitIds] of ulMap) {
    const person = persons.find((n) => n.id === personId);
    if (!person) continue;
    const unitNames = unitIds
      .map((uid) => units.find((u) => u.id === uid)?.name ?? uid)
      .join(", ");
    logins.push({
      id: person.id,
      displayName: `${person.name} (Unit Leader — ${unitNames})`,
      systemRole: "UnitLeader",
      unitIds,
    });
  }

  // Collect preceptor person ids and their scoped units.
  const precMap = new Map<string, string[]>();
  for (const p of privileges.filter((pp) => pp.privilege === "Preceptor")) {
    if (!precMap.has(p.personId)) precMap.set(p.personId, []);
    if (p.unitId) precMap.get(p.personId)!.push(p.unitId);
  }
  for (const [personId, unitIds] of precMap) {
    const person = persons.find((n) => n.id === personId);
    if (!person) continue;
    logins.push({
      id: person.id,
      displayName: `${person.name} (Preceptor)`,
      systemRole: "Preceptor",
      unitIds,
    });
  }

  // One orientee login for the Person role view.
  const orientee = persons.find((n) => !adminPersonIds.has(n.id) && !precMap.has(n.id) && !ulMap.has(n.id));
  if (orientee) {
    logins.push({ id: orientee.id, displayName: `${orientee.name} (Orientee)`, systemRole: "Person" });
  }

  return logins;
}

// ---------------------------------------------------------------------------
// Public exports — names match what the rest of the app already imports.
// ---------------------------------------------------------------------------
export const seedUnits: Unit[] = RAW.units.map(toUnit);
export const seedPersonRoles: PersonRole[] = RAW.personRoles.map(toPersonRole);
export const seedCategories: CompetencyCategory[] = RAW.competencyCategories.map(toCategory);
export const seedGroups: CompetencyGroup[] = RAW.competencyGroups.map(toGroup);
export const seedPersons: Person[] = RAW.persons.map(toPerson);
export const seedPrivileges: PersonPrivilege[] = RAW.personPrivileges.map(toPersonPrivilege);
export const seedCompetencies: Competency[] = RAW.competencies.map(toCompetency);
export const seedSteps: CompetencyStep[] = RAW.competencySteps.map(toStep);
export const seedAssignments: CompetencyAssignment[] = RAW.competencyAssignments.map(toAssignment);
export const seedObservations: StepObservation[] = RAW.stepObservations.map(toObservation);
export const seedAchievements: CompetencyAchievement[] = RAW.competencyAchievements.map(toAchievement);
export const seedChangeRequests: ChangeRequest[] = RAW.changeRequests.map(toChangeRequest);

export const seedLogins: Login[] = (RAW.logins && RAW.logins.length > 0)
  ? RAW.logins as Login[]
  : synthesizeLogins(seedPersons, seedPrivileges, seedUnits);
