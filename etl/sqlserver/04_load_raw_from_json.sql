/* =====================================================================
   CareCompetencies — 04_load_raw_from_json.sql
   Truncate raw.* and reload from carecompetencies_seed.json.
   Idempotent — safe to re-run any time.
   PREREQ: edit @json_path below to point at your seed JSON file.
   ===================================================================== */

USE CareCompetencies;
GO

DECLARE @json_path NVARCHAR(400) = N'C:\etl\carecompetencies_seed.json';
DECLARE @json NVARCHAR(MAX);
DECLARE @sql NVARCHAR(MAX);

SET @sql = N'
    SELECT @j = BulkColumn
    FROM OPENROWSET(BULK ''' + @json_path + N''', SINGLE_CLOB) AS x;';
EXEC sp_executesql @sql, N'@j NVARCHAR(MAX) OUTPUT', @j = @json OUTPUT;

IF @json IS NULL OR LEN(@json) = 0
BEGIN
    RAISERROR('JSON file at %s is empty or unreadable.', 16, 1, @json_path);
    RETURN;
END

TRUNCATE TABLE raw.units;
TRUNCATE TABLE raw.person_roles;
TRUNCATE TABLE raw.competency_categories;
TRUNCATE TABLE raw.competency_groups;
TRUNCATE TABLE raw.preceptors;
TRUNCATE TABLE raw.administrators;
TRUNCATE TABLE raw.persons;
TRUNCATE TABLE raw.competencies;
TRUNCATE TABLE raw.competency_steps;
TRUNCATE TABLE raw.competency_assignments;
TRUNCATE TABLE raw.step_observations;
TRUNCATE TABLE raw.competency_achievements;
TRUNCATE TABLE raw.change_requests;
TRUNCATE TABLE raw.audit_events;

INSERT raw.units (id, name, description, createdAt, updatedAt)
SELECT id, name, description, createdAt, updatedAt
FROM OPENJSON(@json, '$.units')
WITH (id NVARCHAR(64) '$.id', name NVARCHAR(200) '$.name',
      description NVARCHAR(MAX) '$.description',
      createdAt NVARCHAR(64) '$.createdAt', updatedAt NVARCHAR(64) '$.updatedAt');

INSERT raw.person_roles (id, code, name)
SELECT id, code, name
FROM OPENJSON(@json, '$.personRoles')
WITH (id NVARCHAR(64) '$.id', code NVARCHAR(32) '$.code', name NVARCHAR(200) '$.name');

INSERT raw.competency_categories (id, name, color, description)
SELECT id, name, color, description
FROM OPENJSON(@json, '$.competencyCategories')
WITH (id NVARCHAR(64) '$.id', name NVARCHAR(200) '$.name',
      color NVARCHAR(32) '$.color', description NVARCHAR(MAX) '$.description');

INSERT raw.competency_groups (id, name, parentGroupId, sortOrder, description)
SELECT id, name, parentGroupId, sortOrder, description
FROM OPENJSON(@json, '$.competencyGroups')
WITH (id NVARCHAR(64) '$.id', name NVARCHAR(200) '$.name',
      parentGroupId NVARCHAR(64) '$.parentGroupId',
      sortOrder NVARCHAR(32) '$.sortOrder',
      description NVARCHAR(MAX) '$.description');

INSERT raw.preceptors (id, fullName, email, unitId, roleId, hireDate)
SELECT id, fullName, email, unitId, roleId, hireDate
FROM OPENJSON(@json, '$.preceptors')
WITH (id NVARCHAR(64) '$.id', fullName NVARCHAR(200) '$.fullName',
      email NVARCHAR(200) '$.email', unitId NVARCHAR(64) '$.unitId',
      roleId NVARCHAR(64) '$.roleId', hireDate NVARCHAR(64) '$.hireDate');

INSERT raw.administrators (id, fullName, email, title)
SELECT id, fullName, email, title
FROM OPENJSON(@json, '$.administrators')
WITH (id NVARCHAR(64) '$.id', fullName NVARCHAR(200) '$.fullName',
      email NVARCHAR(200) '$.email', title NVARCHAR(200) '$.title');

INSERT raw.persons (id, fullName, email, unitId, roleId, primaryPreceptorId, stage, hireDate, startDate, dukeId, jobCode)
SELECT id, fullName, email, unitId, roleId, primaryPreceptorId, stage, hireDate, startDate, dukeId, jobCode
FROM OPENJSON(@json, '$.persons')
WITH (id NVARCHAR(64) '$.id', fullName NVARCHAR(200) '$.fullName',
      email NVARCHAR(200) '$.email', unitId NVARCHAR(64) '$.unitId',
      roleId NVARCHAR(64) '$.roleId',
      primaryPreceptorId NVARCHAR(64) '$.primaryPreceptorId',
      stage NVARCHAR(32) '$.stage',
      hireDate NVARCHAR(64) '$.hireDate', startDate NVARCHAR(64) '$.startDate',
      dukeId NVARCHAR(64) '$.dukeId', jobCode NVARCHAR(64) '$.jobCode');

INSERT raw.competencies (id, name, groupId, categoryId, description, unitIds, createdAt, updatedAt)
SELECT id, name, groupId, categoryId, description, unitIds, createdAt, updatedAt
FROM OPENJSON(@json, '$.competencies')
WITH (id NVARCHAR(64) '$.id', name NVARCHAR(300) '$.name',
      groupId NVARCHAR(64) '$.groupId', categoryId NVARCHAR(64) '$.categoryId',
      description NVARCHAR(MAX) '$.description',
      unitIds NVARCHAR(MAX) '$.unitIds' AS JSON,
      createdAt NVARCHAR(64) '$.createdAt', updatedAt NVARCHAR(64) '$.updatedAt');

INSERT raw.competency_steps (id, competencyId, sortOrder, description)
SELECT id, competencyId, sortOrder, description
FROM OPENJSON(@json, '$.competencySteps')
WITH (id NVARCHAR(64) '$.id', competencyId NVARCHAR(64) '$.competencyId',
      sortOrder NVARCHAR(32) '$.sortOrder',
      description NVARCHAR(MAX) '$.description');

INSERT raw.competency_assignments (id, competencyId, unitId, roleId, stage)
SELECT id, competencyId, unitId, roleId, stage
FROM OPENJSON(@json, '$.competencyAssignments')
WITH (id NVARCHAR(64) '$.id', competencyId NVARCHAR(64) '$.competencyId',
      unitId NVARCHAR(64) '$.unitId', roleId NVARCHAR(64) '$.roleId',
      stage NVARCHAR(32) '$.stage');

INSERT raw.step_observations (id, personId, stepId, competencyId, preceptorId, outcome, observedAt, note)
SELECT id, personId, stepId, competencyId, preceptorId, outcome, observedAt, note
FROM OPENJSON(@json, '$.stepObservations')
WITH (id NVARCHAR(64) '$.id', personId NVARCHAR(64) '$.personId',
      stepId NVARCHAR(64) '$.stepId', competencyId NVARCHAR(64) '$.competencyId',
      preceptorId NVARCHAR(64) '$.preceptorId',
      outcome NVARCHAR(32) '$.outcome',
      observedAt NVARCHAR(64) '$.observedAt',
      note NVARCHAR(MAX) '$.note');

INSERT raw.competency_achievements (id, personId, competencyId, preceptorId, achievedAt, stage, note, earnedAtUnitId)
SELECT id, personId, competencyId, preceptorId, achievedAt, stage, note, earnedAtUnitId
FROM OPENJSON(@json, '$.competencyAchievements')
WITH (id NVARCHAR(64) '$.id', personId NVARCHAR(64) '$.personId',
      competencyId NVARCHAR(64) '$.competencyId',
      preceptorId NVARCHAR(64) '$.preceptorId',
      achievedAt NVARCHAR(64) '$.achievedAt',
      stage NVARCHAR(32) '$.stage', note NVARCHAR(MAX) '$.note',
      earnedAtUnitId NVARCHAR(64) '$.earnedAtUnitId');

INSERT raw.change_requests (id, requesterId, requesterRole, targetType, targetId, requestType, payload, status, decidedBy, decidedAt, createdAt, note)
SELECT id, requesterId, requesterRole, targetType, targetId, requestType, payload, status, decidedBy, decidedAt, createdAt, note
FROM OPENJSON(@json, '$.changeRequests')
WITH (id NVARCHAR(64) '$.id', requesterId NVARCHAR(64) '$.requesterId',
      requesterRole NVARCHAR(64) '$.requesterRole',
      targetType NVARCHAR(64) '$.targetType', targetId NVARCHAR(64) '$.targetId',
      requestType NVARCHAR(32) '$.requestType',
      payload NVARCHAR(MAX) '$.payload' AS JSON,
      status NVARCHAR(32) '$.status', decidedBy NVARCHAR(64) '$.decidedBy',
      decidedAt NVARCHAR(64) '$.decidedAt', createdAt NVARCHAR(64) '$.createdAt',
      note NVARCHAR(MAX) '$.note');

INSERT raw.audit_events (id, actorId, actorRole, eventType, targetType, targetId, payload, occurredAt)
SELECT id, actorId, actorRole, eventType, targetType, targetId, payload, occurredAt
FROM OPENJSON(@json, '$.auditEvents')
WITH (id NVARCHAR(64) '$.id', actorId NVARCHAR(64) '$.actorId',
      actorRole NVARCHAR(64) '$.actorRole', eventType NVARCHAR(64) '$.eventType',
      targetType NVARCHAR(64) '$.targetType', targetId NVARCHAR(64) '$.targetId',
      payload NVARCHAR(MAX) '$.payload' AS JSON,
      occurredAt NVARCHAR(64) '$.occurredAt');

PRINT 'raw.* loaded from JSON.';
GO
