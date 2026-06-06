-- CareCompetencies — PostgreSQL operational schema
-- Run once against a fresh database (or re-run idempotently with IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS units (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS person_roles (
  id   TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS preceptors (
  id      TEXT PRIMARY KEY,
  name    TEXT NOT NULL,
  unit_id TEXT REFERENCES units(id),
  email   TEXT
);

CREATE TABLE IF NOT EXISTS administrators (
  id    TEXT PRIMARY KEY,
  name  TEXT NOT NULL,
  email TEXT,
  title TEXT
);

CREATE TABLE IF NOT EXISTS persons (
  id                   TEXT PRIMARY KEY,
  name                 TEXT NOT NULL,
  unit_id              TEXT REFERENCES units(id),
  role_id              TEXT REFERENCES person_roles(id),
  primary_preceptor_id TEXT REFERENCES preceptors(id),
  start_date           DATE NOT NULL,
  stage_override       TEXT,
  duke_id              TEXT,
  job_code             TEXT
);

CREATE TABLE IF NOT EXISTS competency_groups (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  parent_group_id TEXT REFERENCES competency_groups(id),
  order_index     INT,
  description     TEXT
);

CREATE TABLE IF NOT EXISTS competencies (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  group_id    TEXT REFERENCES competency_groups(id),
  category_id TEXT,
  unit_ids    JSONB NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS competency_steps (
  id             TEXT PRIMARY KEY,
  competency_id  TEXT NOT NULL REFERENCES competencies(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  order_index    INT  NOT NULL
);

CREATE TABLE IF NOT EXISTS competency_assignments (
  id             TEXT PRIMARY KEY,
  competency_id  TEXT NOT NULL REFERENCES competencies(id),
  unit_id        TEXT NOT NULL REFERENCES units(id),
  role_id        TEXT NOT NULL REFERENCES person_roles(id),
  stage          TEXT NOT NULL CHECK (stage IN ('Core', 'Orientation', 'Education'))
);

CREATE TABLE IF NOT EXISTS step_observations (
  id             TEXT PRIMARY KEY,
  person_id      TEXT NOT NULL REFERENCES persons(id),
  step_id        TEXT NOT NULL REFERENCES competency_steps(id),
  competency_id  TEXT NOT NULL REFERENCES competencies(id),
  preceptor_id   TEXT NOT NULL,
  rating         TEXT NOT NULL CHECK (rating IN ('Satisfactory', 'Unsatisfactory', 'NotObserved')),
  observed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes          TEXT
);

CREATE TABLE IF NOT EXISTS competency_achievements (
  id                TEXT PRIMARY KEY,
  person_id         TEXT NOT NULL REFERENCES persons(id),
  competency_id     TEXT NOT NULL REFERENCES competencies(id),
  preceptor_id      TEXT NOT NULL,
  achieved_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes             TEXT,
  earned_at_unit_id TEXT REFERENCES units(id)
);

CREATE TABLE IF NOT EXISTS change_requests (
  id             TEXT PRIMARY KEY,
  requester_id   TEXT NOT NULL,
  requester_role TEXT NOT NULL,
  type           TEXT NOT NULL,
  competency_id  TEXT,
  rationale      TEXT,
  status         TEXT NOT NULL DEFAULT 'Pending',
  submitted_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  admin_note     TEXT
);

CREATE TABLE IF NOT EXISTS audit_events (
  id           TEXT PRIMARY KEY,
  timestamp    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor        TEXT NOT NULL,
  actor_role   TEXT NOT NULL,
  type         TEXT NOT NULL,
  summary      TEXT NOT NULL,
  target_label TEXT,
  detail       TEXT
);

-- Login records (synthesized from seed data; no passwords in prototype auth)
CREATE TABLE IF NOT EXISTS logins (
  id           TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  system_role  TEXT NOT NULL,
  unit_id      TEXT
);

-- Indexes for the hot query paths
CREATE INDEX IF NOT EXISTS ix_persons_unit     ON persons(unit_id);
CREATE INDEX IF NOT EXISTS ix_obs_person_comp  ON step_observations(person_id, competency_id);
CREATE INDEX IF NOT EXISTS ix_ach_person       ON competency_achievements(person_id);
CREATE INDEX IF NOT EXISTS ix_ach_person_comp  ON competency_achievements(person_id, competency_id);
CREATE INDEX IF NOT EXISTS ix_assn_unit_role   ON competency_assignments(unit_id, role_id, stage);
CREATE INDEX IF NOT EXISTS ix_steps_comp       ON competency_steps(competency_id);
