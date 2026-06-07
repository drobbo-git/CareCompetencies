/* =====================================================================
   CareCompetencies — 05_transform_raw_to_dim_fact.sql
   MERGE upserts: raw.* -> dim.*, fact.*. Idempotent.
   ===================================================================== */

USE CareCompetencies;
GO

SET XACT_ABORT ON;
BEGIN TRAN;

MERGE dim.unit AS tgt
USING (SELECT id, name, description,
              TRY_CONVERT(datetime2(0), createdAt) AS created_at,
              TRY_CONVERT(datetime2(0), updatedAt) AS updated_at
       FROM raw.units) src
ON tgt.unit_bk = src.id
WHEN MATCHED THEN UPDATE SET name=src.name, description=src.description,
                             created_at=src.created_at, updated_at=src.updated_at
WHEN NOT MATCHED THEN INSERT (unit_bk, name, description, created_at, updated_at)
                       VALUES (src.id, src.name, src.description, src.created_at, src.updated_at);

MERGE dim.person_role AS tgt
USING (SELECT id, code, name FROM raw.person_roles) src
ON tgt.role_bk = src.id
WHEN MATCHED THEN UPDATE SET code=src.code, name=src.name
WHEN NOT MATCHED THEN INSERT (role_bk, code, name) VALUES (src.id, src.code, src.name);

MERGE dim.competency_category AS tgt
USING (SELECT id, name, color, description FROM raw.competency_categories) src
ON tgt.category_bk = src.id
WHEN MATCHED THEN UPDATE SET name=src.name, color=src.color, description=src.description
WHEN NOT MATCHED THEN INSERT (category_bk, name, color, description)
                       VALUES (src.id, src.name, src.color, src.description);

MERGE dim.competency_group AS tgt
USING (SELECT id, name, TRY_CONVERT(int, sortOrder) AS sort_order, description
       FROM raw.competency_groups) src
ON tgt.group_bk = src.id
WHEN MATCHED THEN UPDATE SET name=src.name, sort_order=src.sort_order, description=src.description
WHEN NOT MATCHED THEN INSERT (group_bk, name, sort_order, description)
                       VALUES (src.id, src.name, src.sort_order, src.description);

UPDATE g SET g.parent_group_sk = p.group_sk
  FROM dim.competency_group g
  JOIN raw.competency_groups r ON r.id = g.group_bk
  LEFT JOIN dim.competency_group p ON p.group_bk = r.parentGroupId;

MERGE dim.person AS tgt
USING (SELECT n.id, n.fullName, n.email,
              u.unit_sk, rl.person_role_sk,
              n.stage AS stage_code,
              TRY_CONVERT(date, n.hireDate) AS hire_date,
              TRY_CONVERT(date, n.startDate) AS start_date,
              n.dukeId, n.jobCode
       FROM raw.persons n
       LEFT JOIN dim.unit u         ON u.unit_bk = n.unitId
       LEFT JOIN dim.person_role rl ON rl.role_bk = n.roleId) src
ON tgt.person_bk = src.id
WHEN MATCHED THEN UPDATE SET full_name=src.fullName, email=src.email,
                             unit_sk=src.unit_sk, person_role_sk=src.person_role_sk,
                             stage_code=src.stage_code,
                             hire_date=src.hire_date, start_date=src.start_date,
                             duke_id=src.dukeId, job_code=src.jobCode
WHEN NOT MATCHED THEN INSERT (person_bk, full_name, email, unit_sk, person_role_sk, stage_code, hire_date, start_date, duke_id, job_code)
                       VALUES (src.id, src.fullName, src.email, src.unit_sk, src.person_role_sk, src.stage_code, src.hire_date, src.start_date, src.dukeId, src.jobCode);

-- Resolve self-referential primary_preceptor_sk now that all persons exist.
UPDATE n SET n.primary_preceptor_sk = p.person_sk
FROM dim.person n
JOIN raw.persons r ON r.id = n.person_bk
JOIN dim.person p  ON p.person_bk = r.primaryPreceptorId
WHERE r.primaryPreceptorId IS NOT NULL;

MERGE dim.person_privilege AS tgt
USING (SELECT pp.id, n.person_sk, pp.privilege, u.unit_sk
       FROM raw.person_privileges pp
       JOIN dim.person n      ON n.person_bk = pp.personId
       LEFT JOIN dim.unit u   ON u.unit_bk = pp.unitId) src
ON tgt.privilege_bk = src.id
WHEN MATCHED THEN UPDATE SET person_sk=src.person_sk, privilege_code=src.privilege, unit_sk=src.unit_sk
WHEN NOT MATCHED THEN INSERT (privilege_bk, person_sk, privilege_code, unit_sk)
                       VALUES (src.id, src.person_sk, src.privilege, src.unit_sk);

MERGE dim.competency AS tgt
USING (SELECT c.id, c.name, g.group_sk, cat.category_sk, c.description,
              TRY_CONVERT(datetime2(0), c.createdAt) AS created_at,
              TRY_CONVERT(datetime2(0), c.updatedAt) AS updated_at
       FROM raw.competencies c
       LEFT JOIN dim.competency_group g     ON g.group_bk = c.groupId
       LEFT JOIN dim.competency_category cat ON cat.category_bk = c.categoryId) src
ON tgt.competency_bk = src.id
WHEN MATCHED THEN UPDATE SET name=src.name, group_sk=src.group_sk, category_sk=src.category_sk,
                             description=src.description, created_at=src.created_at, updated_at=src.updated_at
WHEN NOT MATCHED THEN INSERT (competency_bk, name, group_sk, category_sk, description, created_at, updated_at)
                       VALUES (src.id, src.name, src.group_sk, src.category_sk, src.description, src.created_at, src.updated_at);

DELETE FROM dim.competency_unit_bridge;
INSERT dim.competency_unit_bridge (competency_sk, unit_sk)
SELECT DISTINCT c.competency_sk, u.unit_sk
FROM raw.competencies r
CROSS APPLY OPENJSON(r.unitIds) WITH (unit_id NVARCHAR(64) '$') j
JOIN dim.competency c ON c.competency_bk = r.id
JOIN dim.unit u       ON u.unit_bk = j.unit_id;

MERGE dim.competency_step AS tgt
USING (SELECT s.id, c.competency_sk, TRY_CONVERT(int, s.sortOrder) AS sort_order, s.description
       FROM raw.competency_steps s
       JOIN dim.competency c ON c.competency_bk = s.competencyId) src
ON tgt.step_bk = src.id
WHEN MATCHED THEN UPDATE SET competency_sk=src.competency_sk, sort_order=src.sort_order, description=src.description
WHEN NOT MATCHED THEN INSERT (step_bk, competency_sk, sort_order, description)
                       VALUES (src.id, src.competency_sk, src.sort_order, src.description);

MERGE dim.competency_assignment AS tgt
USING (SELECT a.id, c.competency_sk, u.unit_sk, rl.person_role_sk, a.stage
       FROM raw.competency_assignments a
       JOIN dim.competency c  ON c.competency_bk = a.competencyId
       JOIN dim.unit u        ON u.unit_bk = a.unitId
       JOIN dim.person_role rl ON rl.role_bk = a.roleId) src
ON tgt.assignment_bk = src.id
WHEN MATCHED THEN UPDATE SET competency_sk=src.competency_sk, unit_sk=src.unit_sk,
                             person_role_sk=src.person_role_sk, stage_code=src.stage
WHEN NOT MATCHED THEN INSERT (assignment_bk, competency_sk, unit_sk, person_role_sk, stage_code)
                       VALUES (src.id, src.competency_sk, src.unit_sk, src.person_role_sk, src.stage);

MERGE fact.step_observation AS tgt
USING (SELECT o.id, n.person_sk, s.step_sk, c.competency_sk, obs.person_sk AS observer_sk,
              o.outcome,
              TRY_CONVERT(datetime2(0), o.observedAt) AS observed_at,
              o.note
       FROM raw.step_observations o
       JOIN dim.person n           ON n.person_bk = o.personId
       JOIN dim.competency_step s ON s.step_bk = o.stepId
       JOIN dim.competency c      ON c.competency_bk = o.competencyId
       JOIN dim.person obs        ON obs.person_bk = o.preceptorId) src
ON tgt.observation_bk = src.id
WHEN MATCHED THEN UPDATE SET person_sk=src.person_sk, step_sk=src.step_sk,
                             competency_sk=src.competency_sk, observer_sk=src.observer_sk,
                             outcome_code=src.outcome, observed_at=src.observed_at, note=src.note
WHEN NOT MATCHED THEN INSERT (observation_bk, person_sk, step_sk, competency_sk, observer_sk, outcome_code, observed_at, note)
                       VALUES (src.id, src.person_sk, src.step_sk, src.competency_sk, src.observer_sk, src.outcome, src.observed_at, src.note);

MERGE fact.competency_achievement AS tgt
USING (SELECT a.id, n.person_sk, c.competency_sk, obs.person_sk AS observer_sk,
              TRY_CONVERT(datetime2(0), a.achievedAt) AS achieved_at,
              a.stage, a.note, eu.unit_sk AS earned_at_unit_sk
       FROM raw.competency_achievements a
       JOIN dim.person n      ON n.person_bk = a.personId
       JOIN dim.competency c  ON c.competency_bk = a.competencyId
       JOIN dim.person obs    ON obs.person_bk = a.preceptorId
       LEFT JOIN dim.unit eu  ON eu.unit_bk = a.earnedAtUnitId) src
ON tgt.achievement_bk = src.id
WHEN MATCHED THEN UPDATE SET person_sk=src.person_sk, competency_sk=src.competency_sk,
                             observer_sk=src.observer_sk, achieved_at=src.achieved_at,
                             stage_code=src.stage, note=src.note,
                             earned_at_unit_sk=src.earned_at_unit_sk
WHEN NOT MATCHED THEN INSERT (achievement_bk, person_sk, competency_sk, observer_sk, achieved_at, stage_code, note, earned_at_unit_sk)
                       VALUES (src.id, src.person_sk, src.competency_sk, src.observer_sk, src.achieved_at, src.stage, src.note, src.earned_at_unit_sk);

MERGE fact.change_request AS tgt
USING (SELECT id, requesterId, requesterRole, targetType, targetId, requestType,
              payload, status, decidedBy,
              TRY_CONVERT(datetime2(0), decidedAt) AS decided_at,
              TRY_CONVERT(datetime2(0), createdAt) AS created_at, note
       FROM raw.change_requests) src
ON tgt.change_request_bk = src.id
WHEN MATCHED THEN UPDATE SET requester_id=src.requesterId, requester_role=src.requesterRole,
                             target_type=src.targetType, target_id=src.targetId,
                             request_type=src.requestType, payload_json=src.payload,
                             status_code=src.status, decided_by=src.decidedBy,
                             decided_at=src.decided_at, created_at=src.created_at, note=src.note
WHEN NOT MATCHED THEN INSERT (change_request_bk, requester_id, requester_role, target_type, target_id,
                              request_type, payload_json, status_code, decided_by, decided_at, created_at, note)
                       VALUES (src.id, src.requesterId, src.requesterRole, src.targetType, src.targetId,
                               src.requestType, src.payload, src.status, src.decidedBy, src.decided_at, src.created_at, src.note);

MERGE fact.audit_event AS tgt
USING (SELECT id, actorId, actorRole, eventType, targetType, targetId, payload,
              TRY_CONVERT(datetime2(0), occurredAt) AS occurred_at
       FROM raw.audit_events) src
ON tgt.audit_bk = src.id
WHEN MATCHED THEN UPDATE SET actor_id=src.actorId, actor_role=src.actorRole,
                             event_type=src.eventType, target_type=src.targetType,
                             target_id=src.targetId, payload_json=src.payload, occurred_at=src.occurred_at
WHEN NOT MATCHED THEN INSERT (audit_bk, actor_id, actor_role, event_type, target_type, target_id, payload_json, occurred_at)
                       VALUES (src.id, src.actorId, src.actorRole, src.eventType, src.targetType, src.targetId, src.payload, src.occurred_at);

COMMIT;
PRINT 'dim/fact tables updated from raw.';
GO
