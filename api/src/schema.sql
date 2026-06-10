-- CareCompetencies — SQL Server operational schema
-- Safe to re-run: all CREATE TABLE / CREATE INDEX statements are guarded by IF OBJECT_ID / sys.indexes checks.

IF OBJECT_ID('dbo.units', 'U') IS NULL
CREATE TABLE dbo.units (
  id          NVARCHAR(64)  NOT NULL PRIMARY KEY,
  name        NVARCHAR(200) NOT NULL,
  description NVARCHAR(MAX) NULL,
  cost_center NVARCHAR(64)  NULL,
  stage_days  NVARCHAR(MAX) NULL
    CONSTRAINT ck_units_stage_days CHECK (stage_days IS NULL OR ISJSON(stage_days) = 1),
  created_at  DATETIME2(0)  NULL,
  updated_at  DATETIME2(0)  NULL
);

IF OBJECT_ID('dbo.person_roles', 'U') IS NULL
CREATE TABLE dbo.person_roles (
  id   NVARCHAR(64)  NOT NULL PRIMARY KEY,
  name NVARCHAR(200) NOT NULL
);

IF OBJECT_ID('dbo.persons', 'U') IS NULL
CREATE TABLE dbo.persons (
  id                   NVARCHAR(36)  NOT NULL PRIMARY KEY,  -- UUID
  username             NVARCHAR(64)  NULL UNIQUE,
  name                 NVARCHAR(200) NOT NULL,
  unit_id              NVARCHAR(64)  NULL REFERENCES dbo.units(id),
  role_id              NVARCHAR(64)  NULL,
  primary_preceptor_id NVARCHAR(36)  NULL,  -- soft ref to persons(id)
  start_date           DATE          NULL,
  stage_override       NVARCHAR(32)  NULL,
  duke_netid           NVARCHAR(50)  NULL,
  job_code             NVARCHAR(32)  NULL
);

IF OBJECT_ID('dbo.person_privileges', 'U') IS NULL
CREATE TABLE dbo.person_privileges (
  id        NVARCHAR(64)  NOT NULL PRIMARY KEY,
  person_id NVARCHAR(36)  NOT NULL REFERENCES dbo.persons(id),
  privilege NVARCHAR(32)  NOT NULL,  -- 'Preceptor' | 'UnitLeader' | 'Administrator'
  unit_id   NVARCHAR(64)  NULL REFERENCES dbo.units(id)
);

IF OBJECT_ID('dbo.competency_groups', 'U') IS NULL
CREATE TABLE dbo.competency_groups (
  id              NVARCHAR(64)  NOT NULL PRIMARY KEY,
  name            NVARCHAR(200) NOT NULL,
  parent_group_id NVARCHAR(64)  NULL REFERENCES dbo.competency_groups(id),
  order_index     INT           NULL,
  description     NVARCHAR(MAX) NULL
);

IF OBJECT_ID('dbo.competencies', 'U') IS NULL
CREATE TABLE dbo.competencies (
  id                NVARCHAR(64)  NOT NULL PRIMARY KEY,
  name              NVARCHAR(300) NOT NULL,
  description       NVARCHAR(MAX) NULL,
  group_id          NVARCHAR(64)  NULL REFERENCES dbo.competency_groups(id),
  category_id       NVARCHAR(64)  NULL,
  unit_ids          NVARCHAR(MAX) NOT NULL DEFAULT N'[]'
    CONSTRAINT ck_competencies_unit_ids CHECK (ISJSON(unit_ids) = 1),
  validation_method NVARCHAR(200) NULL,
  knowledge_source  NVARCHAR(MAX) NULL,
  policy_source     NVARCHAR(MAX) NULL,
  update_note       NVARCHAR(MAX) NULL
);

IF OBJECT_ID('dbo.competency_steps', 'U') IS NULL
CREATE TABLE dbo.competency_steps (
  id            NVARCHAR(64)  NOT NULL PRIMARY KEY,
  competency_id NVARCHAR(64)  NOT NULL REFERENCES dbo.competencies(id) ON DELETE CASCADE,
  name          NVARCHAR(MAX) NOT NULL,
  order_index   INT           NOT NULL
);

IF OBJECT_ID('dbo.competency_assignments', 'U') IS NULL
CREATE TABLE dbo.competency_assignments (
  id            NVARCHAR(64)  NOT NULL PRIMARY KEY,
  competency_id NVARCHAR(64)  NOT NULL REFERENCES dbo.competencies(id),
  unit_id       NVARCHAR(64)  NOT NULL REFERENCES dbo.units(id),
  role_id       NVARCHAR(64)  NOT NULL REFERENCES dbo.person_roles(id),
  stage         NVARCHAR(32)  NOT NULL
    CONSTRAINT ck_assignments_stage CHECK (stage IN ('Core', 'Orientation', 'Education'))
);

-- Clinical records use soft references (no FK constraints) to allow
-- append-only writes without dependency on persons/steps existing in the same tx.
IF OBJECT_ID('dbo.step_observations', 'U') IS NULL
CREATE TABLE dbo.step_observations (
  id            NVARCHAR(64)  NOT NULL PRIMARY KEY,
  person_id     NVARCHAR(36)  NOT NULL,
  step_id       NVARCHAR(64)  NOT NULL,
  competency_id NVARCHAR(64)  NOT NULL,
  observer_id   NVARCHAR(36)  NOT NULL,
  rating        NVARCHAR(32)  NOT NULL,
  observed_at   DATETIME2(0)  NOT NULL DEFAULT GETUTCDATE(),
  notes         NVARCHAR(MAX) NULL
);

IF OBJECT_ID('dbo.competency_achievements', 'U') IS NULL
CREATE TABLE dbo.competency_achievements (
  id                NVARCHAR(64)  NOT NULL PRIMARY KEY,
  person_id         NVARCHAR(36)  NOT NULL,
  competency_id     NVARCHAR(64)  NOT NULL,
  observer_id       NVARCHAR(36)  NOT NULL,
  achieved_at       DATETIME2(0)  NOT NULL DEFAULT GETUTCDATE(),
  notes             NVARCHAR(MAX) NULL,
  earned_at_unit_id NVARCHAR(64)  NULL
);

IF OBJECT_ID('dbo.change_requests', 'U') IS NULL
CREATE TABLE dbo.change_requests (
  id             NVARCHAR(64)  NOT NULL PRIMARY KEY,
  requester_id   NVARCHAR(36)  NOT NULL,
  requester_role NVARCHAR(32)  NOT NULL,
  type           NVARCHAR(64)  NOT NULL,
  competency_id  NVARCHAR(64)  NULL,
  rationale      NVARCHAR(MAX) NULL,
  status         NVARCHAR(32)  NOT NULL DEFAULT 'Pending',
  submitted_at   DATETIME2(0)  NOT NULL DEFAULT GETUTCDATE(),
  admin_note     NVARCHAR(MAX) NULL
);

IF OBJECT_ID('dbo.audit_events', 'U') IS NULL
CREATE TABLE dbo.audit_events (
  id           NVARCHAR(64)  NOT NULL PRIMARY KEY,
  timestamp    DATETIME2(0)  NOT NULL DEFAULT GETUTCDATE(),
  actor        NVARCHAR(200) NOT NULL,
  actor_role   NVARCHAR(32)  NOT NULL,
  type         NVARCHAR(64)  NOT NULL,
  summary      NVARCHAR(MAX) NOT NULL,
  target_label NVARCHAR(200) NULL,
  detail       NVARCHAR(MAX) NULL
);

-- Indexes on hot query paths
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_persons_unit' AND object_id = OBJECT_ID('dbo.persons'))
    CREATE INDEX ix_persons_unit ON dbo.persons(unit_id);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_persons_preceptor' AND object_id = OBJECT_ID('dbo.persons'))
    CREATE INDEX ix_persons_preceptor ON dbo.persons(primary_preceptor_id);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_privs_person' AND object_id = OBJECT_ID('dbo.person_privileges'))
    CREATE INDEX ix_privs_person ON dbo.person_privileges(person_id);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_privs_unit' AND object_id = OBJECT_ID('dbo.person_privileges'))
    CREATE INDEX ix_privs_unit ON dbo.person_privileges(unit_id);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_obs_person_comp' AND object_id = OBJECT_ID('dbo.step_observations'))
    CREATE INDEX ix_obs_person_comp ON dbo.step_observations(person_id, competency_id);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_obs_person_date' AND object_id = OBJECT_ID('dbo.step_observations'))
    CREATE INDEX ix_obs_person_date ON dbo.step_observations(person_id, observed_at DESC);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_ach_person' AND object_id = OBJECT_ID('dbo.competency_achievements'))
    CREATE INDEX ix_ach_person ON dbo.competency_achievements(person_id);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_ach_person_comp' AND object_id = OBJECT_ID('dbo.competency_achievements'))
    CREATE INDEX ix_ach_person_comp ON dbo.competency_achievements(person_id, competency_id);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_assn_unit_role' AND object_id = OBJECT_ID('dbo.competency_assignments'))
    CREATE INDEX ix_assn_unit_role ON dbo.competency_assignments(unit_id, role_id, stage);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_steps_comp' AND object_id = OBJECT_ID('dbo.competency_steps'))
    CREATE INDEX ix_steps_comp ON dbo.competency_steps(competency_id);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_cr_requester_date' AND object_id = OBJECT_ID('dbo.change_requests'))
    CREATE INDEX ix_cr_requester_date ON dbo.change_requests(requester_id, submitted_at DESC);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'ix_audit_ts' AND object_id = OBJECT_ID('dbo.audit_events'))
    CREATE INDEX ix_audit_ts ON dbo.audit_events(timestamp DESC);
