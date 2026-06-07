/* =====================================================================
   CareCompetencies — 02_create_raw_tables.sql
   Landing tables, one per JSON array in carecompetencies_seed.json.
   All columns are NVARCHAR — we keep raw fidelity and type-cast later.
   ===================================================================== */

USE CareCompetencies;
GO

DECLARE @sql NVARCHAR(MAX) = N'';
SELECT @sql += 'DROP TABLE ' + QUOTENAME(s.name) + '.' + QUOTENAME(t.name) + ';' + CHAR(10)
FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
WHERE s.name = 'raw';
EXEC sp_executesql @sql;
GO

CREATE TABLE raw.units (
    id NVARCHAR(64) NOT NULL, name NVARCHAR(200) NULL, description NVARCHAR(MAX) NULL,
    createdAt NVARCHAR(64) NULL, updatedAt NVARCHAR(64) NULL
);
CREATE TABLE raw.person_roles (
    id NVARCHAR(64) NOT NULL, code NVARCHAR(32) NULL, name NVARCHAR(200) NULL
);
-- DEPRECATED in UI — table retained for back-compat
CREATE TABLE raw.competency_categories (
    id NVARCHAR(64) NOT NULL, name NVARCHAR(200) NULL,
    color NVARCHAR(32) NULL, description NVARCHAR(MAX) NULL
);
CREATE TABLE raw.competency_groups (
    id NVARCHAR(64) NOT NULL, name NVARCHAR(200) NULL,
    parentGroupId NVARCHAR(64) NULL, sortOrder NVARCHAR(32) NULL,
    description NVARCHAR(MAX) NULL
);
CREATE TABLE raw.person_privileges (
    id NVARCHAR(64) NOT NULL, personId NVARCHAR(64) NULL,
    privilege NVARCHAR(32) NULL, unitId NVARCHAR(64) NULL
);
CREATE TABLE raw.persons (
    id NVARCHAR(64) NOT NULL, fullName NVARCHAR(200) NULL, email NVARCHAR(200) NULL,
    unitId NVARCHAR(64) NULL, roleId NVARCHAR(64) NULL,
    primaryPreceptorId NVARCHAR(64) NULL, stage NVARCHAR(32) NULL,
    hireDate NVARCHAR(64) NULL, startDate NVARCHAR(64) NULL,
    dukeId NVARCHAR(64) NULL, jobCode NVARCHAR(64) NULL
);
CREATE TABLE raw.competencies (
    id NVARCHAR(64) NOT NULL, name NVARCHAR(300) NULL, groupId NVARCHAR(64) NULL,
    categoryId NVARCHAR(64) NULL,  -- DEPRECATED; populated for back-compat
    description NVARCHAR(MAX) NULL, unitIds NVARCHAR(MAX) NULL,
    createdAt NVARCHAR(64) NULL, updatedAt NVARCHAR(64) NULL
);
CREATE TABLE raw.competency_steps (
    id NVARCHAR(64) NOT NULL, competencyId NVARCHAR(64) NULL,
    sortOrder NVARCHAR(32) NULL, description NVARCHAR(MAX) NULL
);
CREATE TABLE raw.competency_assignments (
    id NVARCHAR(64) NOT NULL, competencyId NVARCHAR(64) NULL,
    unitId NVARCHAR(64) NULL, roleId NVARCHAR(64) NULL, stage NVARCHAR(32) NULL
);
CREATE TABLE raw.step_observations (
    id NVARCHAR(64) NOT NULL, personId NVARCHAR(64) NULL, stepId NVARCHAR(64) NULL,
    competencyId NVARCHAR(64) NULL, preceptorId NVARCHAR(64) NULL,
    outcome NVARCHAR(32) NULL, observedAt NVARCHAR(64) NULL, note NVARCHAR(MAX) NULL
);
CREATE TABLE raw.competency_achievements (
    id NVARCHAR(64) NOT NULL, personId NVARCHAR(64) NULL, competencyId NVARCHAR(64) NULL,
    preceptorId NVARCHAR(64) NULL, achievedAt NVARCHAR(64) NULL,
    stage NVARCHAR(32) NULL, note NVARCHAR(MAX) NULL,
    earnedAtUnitId NVARCHAR(64) NULL
);
CREATE TABLE raw.change_requests (
    id NVARCHAR(64) NOT NULL, requesterId NVARCHAR(64) NULL, requesterRole NVARCHAR(64) NULL,
    targetType NVARCHAR(64) NULL, targetId NVARCHAR(64) NULL, requestType NVARCHAR(32) NULL,
    payload NVARCHAR(MAX) NULL, status NVARCHAR(32) NULL,
    decidedBy NVARCHAR(64) NULL, decidedAt NVARCHAR(64) NULL,
    createdAt NVARCHAR(64) NULL, note NVARCHAR(MAX) NULL
);
CREATE TABLE raw.audit_events (
    id NVARCHAR(64) NOT NULL, actorId NVARCHAR(64) NULL, actorRole NVARCHAR(64) NULL,
    eventType NVARCHAR(64) NULL, targetType NVARCHAR(64) NULL, targetId NVARCHAR(64) NULL,
    payload NVARCHAR(MAX) NULL, occurredAt NVARCHAR(64) NULL
);

PRINT 'raw.* tables ready.';
GO
