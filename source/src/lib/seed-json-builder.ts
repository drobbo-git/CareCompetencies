// Build the carecompetencies_seed.json extract from the live in-app data.
// Run from the admin Export Seed JSON page. The schema mirrors what the
// SQL Server loader (04_load_raw_from_json.sql) expects.

import {
  seedUnits, seedPersonRoles, seedCategories, seedGroups,
  seedPersons, seedPrivileges,
  seedCompetencies, seedSteps, seedAssignments,
  seedObservations, seedAchievements, seedChangeRequests,
} from "@/data/seed";
import { seedAuditEvents } from "@/data/audit";

export interface SeedJsonCounts {
  units: number;
  personRoles: number;
  competencyCategories: number;
  competencyGroups: number;
  persons: number;
  personPrivileges: number;
  competencies: number;
  competencySteps: number;
  competencyAssignments: number;
  stepObservations: number;
  competencyAchievements: number;
  changeRequests: number;
  auditEvents: number;
}

export function buildSeedJson(): { json: string; counts: SeedJsonCounts } {
  const payload = {
    schemaVersion: "2.0",
    generatedAt: new Date().toISOString(),
    units: seedUnits.map((u) => ({
      id: u.id,
      name: u.name,
      description: (u as any).description ?? "",
      createdAt: (u as any).createdAt ?? undefined,
      updatedAt: (u as any).updatedAt ?? undefined,
    })),
    personRoles: seedPersonRoles.map((r) => ({
      id: r.id,
      code: r.id.replace(/^r-/, "").toUpperCase(),
      name: r.name,
    })),
    competencyCategories: seedCategories.map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color,
      description: (c as any).description ?? "",
    })),
    competencyGroups: seedGroups.map((g) => ({
      id: g.id,
      name: g.name,
      parentGroupId: g.parentGroupId ?? null,
      sortOrder: g.orderIndex ?? 0,
      description: (g as any).description ?? "",
    })),
    persons: seedPersons.map((n) => ({
      id: n.id,
      fullName: n.name,
      email: (n as any).email ?? "",
      unitId: n.unitId,
      roleId: n.roleId ?? null,
      primaryPreceptorId: n.primaryPreceptorId ?? null,
      stage: n.stageOverride ?? null,
      hireDate: n.startDate,
      startDate: n.startDate,
    })),
    personPrivileges: seedPrivileges.map((p) => ({
      id: p.id,
      personId: p.personId,
      privilege: p.privilege,
      unitId: p.unitId ?? null,
    })),
    competencies: seedCompetencies.map((c) => ({
      id: c.id,
      name: c.name,
      groupId: c.groupId ?? null,
      categoryId: c.categoryId ?? null,
      description: c.description ?? "",
      unitIds: c.unitIds ?? [],
      createdAt: undefined,
      updatedAt: undefined,
    })),
    competencySteps: seedSteps.map((s) => ({
      id: s.id,
      competencyId: s.competencyId,
      sortOrder: s.orderIndex,
      description: s.name,
    })),
    competencyAssignments: seedAssignments.map((a) => ({
      id: a.id,
      competencyId: a.competencyId,
      unitId: a.unitId,
      roleId: a.roleId,
      stage: a.stage,
    })),
    stepObservations: seedObservations.map((o) => ({
      id: o.id,
      personId: o.personId,
      stepId: o.stepId,
      competencyId: o.competencyId,
      preceptorId: o.observerId,
      outcome: o.rating,
      observedAt: o.observedAt,
      note: o.notes ?? "",
    })),
    competencyAchievements: seedAchievements.map((a) => ({
      id: a.id,
      personId: a.personId,
      competencyId: a.competencyId,
      preceptorId: a.observerId,
      achievedAt: a.achievedAt,
      stage: undefined,
      note: a.notes ?? "",
      earnedAtUnitId: (a as any).earnedAtUnitId ?? undefined,
    })),
    changeRequests: seedChangeRequests.map((cr) => ({
      id: cr.id,
      requesterId: cr.requesterId,
      requesterRole: cr.requesterRole,
      targetType: "Competency",
      targetId: cr.competencyId ?? null,
      requestType: cr.type,
      payload: { rationale: cr.rationale, adminNote: cr.adminNote ?? null },
      status: cr.status,
      decidedBy: null,
      decidedAt: null,
      createdAt: cr.submittedAt,
      note: cr.rationale ?? "",
    })),
    auditEvents: seedAuditEvents.map((e) => ({
      id: e.id,
      actorId: e.actor,
      actorRole: e.actorRole,
      eventType: e.type,
      targetType: null,
      targetId: e.targetLabel ?? null,
      payload: { summary: e.summary, detail: e.detail ?? null },
      occurredAt: e.timestamp,
    })),
  };

  const counts: SeedJsonCounts = {
    units: payload.units.length,
    personRoles: payload.personRoles.length,
    competencyCategories: payload.competencyCategories.length,
    competencyGroups: payload.competencyGroups.length,
    persons: payload.persons.length,
    personPrivileges: payload.personPrivileges.length,
    competencies: payload.competencies.length,
    competencySteps: payload.competencySteps.length,
    competencyAssignments: payload.competencyAssignments.length,
    stepObservations: payload.stepObservations.length,
    competencyAchievements: payload.competencyAchievements.length,
    changeRequests: payload.changeRequests.length,
    auditEvents: payload.auditEvents.length,
  };

  return { json: JSON.stringify(payload, null, 2), counts };
}
