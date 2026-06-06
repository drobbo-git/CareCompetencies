/* =====================================================================
   CareCompetencies — Fabric Warehouse DDL
   Fabric Warehouse has NO IDENTITY, NO MERGE, NO OPENJSON file access.
   Surrogate keys come from ROW_NUMBER(). Gold layer is built via CTAS.
   ===================================================================== */

-- Staging (raw landing for COPY INTO from OneLake)
DROP TABLE IF EXISTS stg_units;
CREATE TABLE stg_units (id VARCHAR(64), name VARCHAR(200), description VARCHAR(8000),
                        createdAt VARCHAR(64), updatedAt VARCHAR(64));

DROP TABLE IF EXISTS stg_person_roles;
CREATE TABLE stg_person_roles (id VARCHAR(64), code VARCHAR(32), name VARCHAR(200));

DROP TABLE IF EXISTS stg_competency_categories;  -- DEPRECATED
CREATE TABLE stg_competency_categories (id VARCHAR(64), name VARCHAR(200),
                                        color VARCHAR(32), description VARCHAR(8000));

DROP TABLE IF EXISTS stg_competency_groups;
CREATE TABLE stg_competency_groups (id VARCHAR(64), name VARCHAR(200),
                                    parentGroupId VARCHAR(64), sortOrder VARCHAR(32),
                                    description VARCHAR(8000));

DROP TABLE IF EXISTS stg_preceptors;
CREATE TABLE stg_preceptors (id VARCHAR(64), fullName VARCHAR(200), email VARCHAR(200),
                             unitId VARCHAR(64), roleId VARCHAR(64), hireDate VARCHAR(64));

DROP TABLE IF EXISTS stg_administrators;
CREATE TABLE stg_administrators (id VARCHAR(64), fullName VARCHAR(200),
                                  email VARCHAR(200), title VARCHAR(200));

DROP TABLE IF EXISTS stg_persons;
CREATE TABLE stg_persons (id VARCHAR(64), fullName VARCHAR(200), email VARCHAR(200),
                         unitId VARCHAR(64), roleId VARCHAR(64),
                         primaryPreceptorId VARCHAR(64), stage VARCHAR(32),
                         hireDate VARCHAR(64), startDate VARCHAR(64));

DROP TABLE IF EXISTS stg_competencies;
CREATE TABLE stg_competencies (id VARCHAR(64), name VARCHAR(300), groupId VARCHAR(64),
                                categoryId VARCHAR(64), description VARCHAR(8000),
                                unitIds VARCHAR(8000), createdAt VARCHAR(64),
                                updatedAt VARCHAR(64));

DROP TABLE IF EXISTS stg_competency_steps;
CREATE TABLE stg_competency_steps (id VARCHAR(64), competencyId VARCHAR(64),
                                   sortOrder VARCHAR(32), description VARCHAR(8000));

DROP TABLE IF EXISTS stg_competency_assignments;
CREATE TABLE stg_competency_assignments (id VARCHAR(64), competencyId VARCHAR(64),
                                          unitId VARCHAR(64), roleId VARCHAR(64),
                                          stage VARCHAR(32));

DROP TABLE IF EXISTS stg_step_observations;
CREATE TABLE stg_step_observations (id VARCHAR(64), personId VARCHAR(64), stepId VARCHAR(64),
                                    competencyId VARCHAR(64), preceptorId VARCHAR(64),
                                    outcome VARCHAR(32), observedAt VARCHAR(64),
                                    note VARCHAR(8000));

DROP TABLE IF EXISTS stg_competency_achievements;
CREATE TABLE stg_competency_achievements (id VARCHAR(64), personId VARCHAR(64),
                                           competencyId VARCHAR(64), preceptorId VARCHAR(64),
                                           achievedAt VARCHAR(64), stage VARCHAR(32),
                                           note VARCHAR(8000));

-- Once staging is populated by warehouse_copy_into.sql, build gold with CTAS:
--
-- DROP TABLE IF EXISTS dim_unit;
-- CREATE TABLE dim_unit AS
--   SELECT ROW_NUMBER() OVER (ORDER BY id) AS unit_sk,
--          id AS unit_bk, name, description, createdAt, updatedAt
--   FROM stg_units;
--
-- (repeat for each dim/fact table; FK "joins" become joins on the bk column.)
