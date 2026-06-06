/* =====================================================================
   CareCompetencies — Fabric Warehouse COPY INTO
   Loads staging tables from OneLake. Adjust the FROM paths for your
   workspace / lakehouse / file location.
   ===================================================================== */

-- The JSON in OneLake should have been pre-split per entity into separate
-- newline-delimited JSON files (e.g. via a Dataflow Gen2 or Spark job).
-- File names below assume that layout.

COPY INTO stg_units FROM 'https://onelake.dfs.fabric.microsoft.com/<workspace>/<lakehouse>.Lakehouse/Files/landing/units.jsonl'
  WITH (FILE_TYPE = 'CSV', FIRSTROW = 1);  -- placeholder; replace with appropriate FILE_TYPE / FORMAT_OPTIONS

-- repeat for stg_person_roles, stg_competency_categories, stg_competency_groups,
-- stg_preceptors, stg_administrators, stg_persons, stg_competencies,
-- stg_competency_steps, stg_competency_assignments, stg_step_observations,
-- stg_competency_achievements.
--
-- NOTE: At time of writing Fabric Warehouse COPY INTO supports CSV and PARQUET.
-- If your seed remains JSON, either pre-process it to JSONL via Dataflow Gen2 +
-- a Spark notebook, or land it via the Lakehouse path (see
-- lakehouse_bronze_silver_gold.py) which natively reads JSON.
