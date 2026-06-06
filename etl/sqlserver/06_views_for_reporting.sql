/* =====================================================================
   CareCompetencies — 06_views_for_reporting.sql
   Semantic views for Power BI / CareOps reporting.
   ===================================================================== */

USE CareCompetencies;
GO

IF OBJECT_ID('rpt.v_person_progress') IS NOT NULL DROP VIEW rpt.v_person_progress;
GO
CREATE VIEW rpt.v_person_progress AS
WITH assigned AS (
    SELECT n.person_sk, n.full_name AS person_name, u.name AS unit_name,
           ca.competency_sk, c.name AS competency_name,
           ca.stage_code, n.stage_code AS person_stage
    FROM dim.person n
    JOIN dim.competency_assignment ca
         ON ca.unit_sk = n.unit_sk AND ca.person_role_sk = n.person_role_sk
    JOIN dim.competency c ON c.competency_sk = ca.competency_sk
    JOIN dim.unit u       ON u.unit_sk = n.unit_sk
),
achieved AS (
    SELECT person_sk, competency_sk, MIN(achieved_at) AS first_achieved_at
    FROM fact.competency_achievement
    GROUP BY person_sk, competency_sk
),
sat_obs AS (
    SELECT person_sk, competency_sk, COUNT(*) AS sat_count
    FROM fact.step_observation
    WHERE outcome_code = 'Satisfactory'
    GROUP BY person_sk, competency_sk
)
SELECT a.person_sk, a.person_name, a.unit_name, a.person_stage,
       a.competency_sk, a.competency_name, a.stage_code AS assigned_stage,
       CASE
            WHEN ach.first_achieved_at IS NOT NULL THEN 'Achieved'
            WHEN so.sat_count > 0 THEN 'InProgress'
            ELSE 'NotStarted'
       END AS status,
       ach.first_achieved_at,
       ISNULL(so.sat_count, 0) AS satisfactory_observation_count
FROM assigned a
LEFT JOIN achieved ach ON ach.person_sk = a.person_sk AND ach.competency_sk = a.competency_sk
LEFT JOIN sat_obs so   ON so.person_sk  = a.person_sk AND so.competency_sk  = a.competency_sk;
GO

IF OBJECT_ID('rpt.v_unit_readiness') IS NOT NULL DROP VIEW rpt.v_unit_readiness;
GO
CREATE VIEW rpt.v_unit_readiness AS
SELECT unit_name, assigned_stage,
       COUNT(*) AS assigned_count,
       SUM(CASE WHEN status='Achieved'   THEN 1 ELSE 0 END) AS achieved_count,
       SUM(CASE WHEN status='InProgress' THEN 1 ELSE 0 END) AS in_progress_count,
       CAST(100.0 * SUM(CASE WHEN status='Achieved' THEN 1 ELSE 0 END)
            / NULLIF(COUNT(*),0) AS DECIMAL(5,2)) AS pct_achieved
FROM rpt.v_person_progress
WHERE person_stage <> 'FullyOriented'
GROUP BY unit_name, assigned_stage;
GO

IF OBJECT_ID('rpt.v_change_request_backlog') IS NOT NULL DROP VIEW rpt.v_change_request_backlog;
GO
CREATE VIEW rpt.v_change_request_backlog AS
SELECT status_code, requester_role, request_type, target_type,
       COUNT(*) AS request_count, MIN(created_at) AS oldest_open
FROM fact.change_request
GROUP BY status_code, requester_role, request_type, target_type;
GO

IF OBJECT_ID('rpt.v_observation_throughput') IS NOT NULL DROP VIEW rpt.v_observation_throughput;
GO
CREATE VIEW rpt.v_observation_throughput AS
SELECT CAST(o.observed_at AS DATE) AS observed_date,
       p.full_name AS preceptor_name,
       o.outcome_code, COUNT(*) AS observation_count
FROM fact.step_observation o
JOIN dim.preceptor p ON p.preceptor_sk = o.preceptor_sk
GROUP BY CAST(o.observed_at AS DATE), p.full_name, o.outcome_code;
GO

PRINT 'rpt.* views ready.';
GO
