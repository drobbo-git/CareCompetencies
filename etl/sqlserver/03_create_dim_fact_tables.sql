/* =====================================================================
   CareCompetencies — 03_create_dim_fact_tables.sql
   Conformed dim/fact star schema with surrogate keys.
   ===================================================================== */

USE CareCompetencies;
GO

IF OBJECT_ID('ref.stage') IS NULL
CREATE TABLE ref.stage (
    stage_code NVARCHAR(32) NOT NULL PRIMARY KEY,
    display_name NVARCHAR(64) NOT NULL,
    default_days INT NOT NULL,
    sort_order INT NOT NULL
);

IF OBJECT_ID('ref.change_request_status') IS NULL
CREATE TABLE ref.change_request_status (
    status_code NVARCHAR(32) NOT NULL PRIMARY KEY,
    display_name NVARCHAR(64) NOT NULL
);

IF OBJECT_ID('ref.observation_outcome') IS NULL
CREATE TABLE ref.observation_outcome (
    outcome_code NVARCHAR(32) NOT NULL PRIMARY KEY,
    display_name NVARCHAR(64) NOT NULL
);

MERGE ref.stage AS tgt USING (VALUES
    ('Core','Core',30,1),('Orientation','Orientation',60,2),
    ('Education','Education',90,3),('FullyOriented','Fully Oriented',0,4)
) src(stage_code,display_name,default_days,sort_order)
ON tgt.stage_code = src.stage_code
WHEN MATCHED THEN UPDATE SET display_name=src.display_name, default_days=src.default_days, sort_order=src.sort_order
WHEN NOT MATCHED THEN INSERT (stage_code,display_name,default_days,sort_order)
                       VALUES (src.stage_code,src.display_name,src.default_days,src.sort_order);

MERGE ref.change_request_status AS tgt USING (VALUES
    ('Pending','Pending'),('Approved','Approved'),('Rejected','Rejected')
) src(status_code,display_name)
ON tgt.status_code = src.status_code
WHEN NOT MATCHED THEN INSERT (status_code,display_name) VALUES (src.status_code,src.display_name);

MERGE ref.observation_outcome AS tgt USING (VALUES
    ('Satisfactory','Satisfactory'),('Unsatisfactory','Unsatisfactory'),('NotObserved','Not Observed')
) src(outcome_code,display_name)
ON tgt.outcome_code = src.outcome_code
WHEN NOT MATCHED THEN INSERT (outcome_code,display_name) VALUES (src.outcome_code,src.display_name);
GO

IF OBJECT_ID('dim.unit') IS NULL
CREATE TABLE dim.unit (
    unit_sk BIGINT IDENTITY(1,1) PRIMARY KEY,
    unit_bk NVARCHAR(64) NOT NULL UNIQUE,
    name NVARCHAR(200) NOT NULL, description NVARCHAR(MAX) NULL,
    created_at DATETIME2(0) NULL, updated_at DATETIME2(0) NULL
);

IF OBJECT_ID('dim.person_role') IS NULL
CREATE TABLE dim.person_role (
    person_role_sk BIGINT IDENTITY(1,1) PRIMARY KEY,
    role_bk NVARCHAR(64) NOT NULL UNIQUE,
    code NVARCHAR(32) NOT NULL, name NVARCHAR(200) NOT NULL
);

-- DEPRECATED
IF OBJECT_ID('dim.competency_category') IS NULL
CREATE TABLE dim.competency_category (
    category_sk BIGINT IDENTITY(1,1) PRIMARY KEY,
    category_bk NVARCHAR(64) NOT NULL UNIQUE,
    name NVARCHAR(200) NOT NULL, color NVARCHAR(32) NULL,
    description NVARCHAR(MAX) NULL, is_deprecated BIT NOT NULL DEFAULT 1
);

IF OBJECT_ID('dim.competency_group') IS NULL
CREATE TABLE dim.competency_group (
    group_sk BIGINT IDENTITY(1,1) PRIMARY KEY,
    group_bk NVARCHAR(64) NOT NULL UNIQUE, name NVARCHAR(200) NOT NULL,
    parent_group_sk BIGINT NULL REFERENCES dim.competency_group(group_sk),
    sort_order INT NULL, description NVARCHAR(MAX) NULL
);

IF OBJECT_ID('dim.person') IS NULL
CREATE TABLE dim.person (
    person_sk BIGINT IDENTITY(1,1) PRIMARY KEY,
    person_bk NVARCHAR(64) NOT NULL UNIQUE,
    full_name NVARCHAR(200) NOT NULL, email NVARCHAR(200) NULL,
    unit_sk BIGINT NULL REFERENCES dim.unit(unit_sk),
    person_role_sk BIGINT NULL REFERENCES dim.person_role(person_role_sk),
    primary_preceptor_sk BIGINT NULL REFERENCES dim.person(person_sk),
    stage_code NVARCHAR(32) NULL REFERENCES ref.stage(stage_code),
    hire_date DATE NULL, start_date DATE NULL,
    duke_id NVARCHAR(64) NULL, job_code NVARCHAR(64) NULL
);

IF OBJECT_ID('dim.person_privilege') IS NULL
CREATE TABLE dim.person_privilege (
    privilege_sk BIGINT IDENTITY(1,1) PRIMARY KEY,
    privilege_bk NVARCHAR(64) NOT NULL UNIQUE,
    person_sk BIGINT NOT NULL REFERENCES dim.person(person_sk),
    privilege_code NVARCHAR(32) NOT NULL,
    unit_sk BIGINT NULL REFERENCES dim.unit(unit_sk)
);

IF OBJECT_ID('dim.competency') IS NULL
CREATE TABLE dim.competency (
    competency_sk BIGINT IDENTITY(1,1) PRIMARY KEY,
    competency_bk NVARCHAR(64) NOT NULL UNIQUE,
    name NVARCHAR(300) NOT NULL,
    group_sk BIGINT NULL REFERENCES dim.competency_group(group_sk),
    category_sk BIGINT NULL REFERENCES dim.competency_category(category_sk),  -- DEPRECATED
    description NVARCHAR(MAX) NULL,
    created_at DATETIME2(0) NULL, updated_at DATETIME2(0) NULL
);

IF OBJECT_ID('dim.competency_unit_bridge') IS NULL
CREATE TABLE dim.competency_unit_bridge (
    competency_sk BIGINT NOT NULL REFERENCES dim.competency(competency_sk),
    unit_sk BIGINT NOT NULL REFERENCES dim.unit(unit_sk),
    CONSTRAINT pk_competency_unit_bridge PRIMARY KEY (competency_sk, unit_sk)
);

IF OBJECT_ID('dim.competency_step') IS NULL
CREATE TABLE dim.competency_step (
    step_sk BIGINT IDENTITY(1,1) PRIMARY KEY,
    step_bk NVARCHAR(64) NOT NULL UNIQUE,
    competency_sk BIGINT NOT NULL REFERENCES dim.competency(competency_sk),
    sort_order INT NULL, description NVARCHAR(MAX) NULL
);

IF OBJECT_ID('dim.competency_assignment') IS NULL
CREATE TABLE dim.competency_assignment (
    assignment_sk BIGINT IDENTITY(1,1) PRIMARY KEY,
    assignment_bk NVARCHAR(64) NOT NULL UNIQUE,
    competency_sk BIGINT NOT NULL REFERENCES dim.competency(competency_sk),
    unit_sk BIGINT NOT NULL REFERENCES dim.unit(unit_sk),
    person_role_sk BIGINT NOT NULL REFERENCES dim.person_role(person_role_sk),
    stage_code NVARCHAR(32) NOT NULL REFERENCES ref.stage(stage_code)
);

IF OBJECT_ID('fact.step_observation') IS NULL
CREATE TABLE fact.step_observation (
    observation_sk BIGINT IDENTITY(1,1) PRIMARY KEY,
    observation_bk NVARCHAR(64) NOT NULL UNIQUE,
    person_sk BIGINT NOT NULL REFERENCES dim.person(person_sk),
    step_sk BIGINT NOT NULL REFERENCES dim.competency_step(step_sk),
    competency_sk BIGINT NOT NULL REFERENCES dim.competency(competency_sk),
    observer_sk BIGINT NOT NULL REFERENCES dim.person(person_sk),
    outcome_code NVARCHAR(32) NOT NULL REFERENCES ref.observation_outcome(outcome_code),
    observed_at DATETIME2(0) NOT NULL, note NVARCHAR(MAX) NULL
);

IF OBJECT_ID('fact.competency_achievement') IS NULL
CREATE TABLE fact.competency_achievement (
    achievement_sk BIGINT IDENTITY(1,1) PRIMARY KEY,
    achievement_bk NVARCHAR(64) NOT NULL UNIQUE,
    person_sk BIGINT NOT NULL REFERENCES dim.person(person_sk),
    competency_sk BIGINT NOT NULL REFERENCES dim.competency(competency_sk),
    observer_sk BIGINT NOT NULL REFERENCES dim.person(person_sk),
    achieved_at DATETIME2(0) NOT NULL,
    stage_code NVARCHAR(32) NULL REFERENCES ref.stage(stage_code),
    note NVARCHAR(MAX) NULL,
    earned_at_unit_sk BIGINT NULL REFERENCES dim.unit(unit_sk)
);

IF OBJECT_ID('fact.change_request') IS NULL
CREATE TABLE fact.change_request (
    change_request_sk BIGINT IDENTITY(1,1) PRIMARY KEY,
    change_request_bk NVARCHAR(64) NOT NULL UNIQUE,
    requester_id NVARCHAR(64) NOT NULL, requester_role NVARCHAR(64) NOT NULL,
    target_type NVARCHAR(64) NOT NULL, target_id NVARCHAR(64) NULL,
    request_type NVARCHAR(32) NOT NULL, payload_json NVARCHAR(MAX) NULL,
    status_code NVARCHAR(32) NOT NULL REFERENCES ref.change_request_status(status_code),
    decided_by NVARCHAR(64) NULL, decided_at DATETIME2(0) NULL,
    created_at DATETIME2(0) NOT NULL, note NVARCHAR(MAX) NULL
);

IF OBJECT_ID('fact.audit_event') IS NULL
CREATE TABLE fact.audit_event (
    audit_sk BIGINT IDENTITY(1,1) PRIMARY KEY,
    audit_bk NVARCHAR(64) NOT NULL UNIQUE,
    actor_id NVARCHAR(64) NULL, actor_role NVARCHAR(64) NULL,
    event_type NVARCHAR(64) NOT NULL,
    target_type NVARCHAR(64) NULL, target_id NVARCHAR(64) NULL,
    payload_json NVARCHAR(MAX) NULL, occurred_at DATETIME2(0) NOT NULL
);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_person_unit')
    CREATE INDEX ix_person_unit ON dim.person(unit_sk) INCLUDE(stage_code);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_obs_person_competency')
    CREATE INDEX ix_obs_person_competency ON fact.step_observation(person_sk, competency_sk) INCLUDE(outcome_code, observed_at);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_ach_person')
    CREATE INDEX ix_ach_person ON fact.competency_achievement(person_sk) INCLUDE(competency_sk, achieved_at);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name='ix_assn_unit_role_stage')
    CREATE INDEX ix_assn_unit_role_stage ON dim.competency_assignment(unit_sk, person_role_sk, stage_code);

PRINT 'dim/fact/ref tables ready.';
GO
