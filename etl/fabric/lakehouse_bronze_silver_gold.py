# CareCompetencies — Fabric Lakehouse Bronze/Silver/Gold notebook
#
# Paste into a Fabric Notebook attached to a Lakehouse. Then:
#   1. Upload carecompetencies_seed.json to Files/landing/ in the lakehouse.
#   2. Set LAKEHOUSE_NAME below.
#   3. Run all cells. Re-runnable.

LAKEHOUSE_NAME = "CareCompetenciesLH"
LANDING_PATH = f"Files/landing/carecompetencies_seed.json"

from pyspark.sql import functions as F
from pyspark.sql.types import StringType

# --- Bronze: read raw JSON, write one Delta table per top-level array ---
raw = spark.read.option("multiline", "true").json(LANDING_PATH)

for col_name in raw.columns:
    bronze_df = raw.selectExpr(f"explode({col_name}) AS row").select("row.*")
    bronze_df.write.mode("overwrite").format("delta").saveAsTable(f"bronze_{col_name}")
    print(f"bronze_{col_name}: {bronze_df.count()} rows")

# --- Silver: typed + deduped ---
def silver(name: str, date_cols=None, dedupe_key: str = "id"):
    df = spark.table(f"bronze_{name}")
    for c in (date_cols or []):
        df = df.withColumn(c, F.to_timestamp(c))
    df = df.dropDuplicates([dedupe_key])
    df.write.mode("overwrite").format("delta").saveAsTable(f"silver_{name}")
    return df.count()

silver("units",                    date_cols=["createdAt", "updatedAt"])
silver("personRoles")
silver("competencyCategories")     # DEPRECATED, kept for back-compat
silver("competencyGroups")
silver("preceptors",               date_cols=["hireDate"])
silver("administrators")
silver("persons",                   date_cols=["hireDate", "startDate"])
silver("competencies",             date_cols=["createdAt", "updatedAt"])
silver("competencySteps")
silver("competencyAssignments")
silver("stepObservations",         date_cols=["observedAt"])
silver("competencyAchievements",   date_cols=["achievedAt"])
silver("changeRequests",           date_cols=["createdAt", "decidedAt"])
silver("auditEvents",              date_cols=["occurredAt"])

# --- Gold: star schema for Power BI ---
spark.sql("""CREATE OR REPLACE TABLE dim_unit AS
    SELECT id AS unit_bk, name, description, createdAt, updatedAt FROM silver_units""")
spark.sql("""CREATE OR REPLACE TABLE dim_role AS
    SELECT id AS role_bk, code, name FROM silver_nurseRoles""")
spark.sql("""CREATE OR REPLACE TABLE dim_group AS
    SELECT id AS group_bk, name, parentGroupId, sortOrder, description FROM silver_competencyGroups""")
spark.sql("""CREATE OR REPLACE TABLE dim_nurse AS
    SELECT id AS person_bk, fullName, email, unitId, roleId, primaryPreceptorId,
           stage AS stage_code, hireDate, startDate FROM silver_nurses""")
spark.sql("""CREATE OR REPLACE TABLE dim_preceptor AS
    SELECT id AS preceptor_bk, fullName, email, unitId, roleId, hireDate FROM silver_preceptors""")
spark.sql("""CREATE OR REPLACE TABLE dim_competency AS
    SELECT id AS competency_bk, name, groupId, categoryId, description,
           createdAt, updatedAt FROM silver_competencies""")
spark.sql("""CREATE OR REPLACE TABLE dim_step AS
    SELECT id AS step_bk, competencyId, sortOrder, description FROM silver_competencySteps""")
spark.sql("""CREATE OR REPLACE TABLE dim_assignment AS
    SELECT id AS assignment_bk, competencyId, unitId, roleId, stage AS stage_code
      FROM silver_competencyAssignments""")
spark.sql("""CREATE OR REPLACE TABLE fact_step_observation AS
    SELECT id, personId, stepId, competencyId, preceptorId, outcome AS outcome_code,
           observedAt, note FROM silver_stepObservations""")
spark.sql("""CREATE OR REPLACE TABLE fact_competency_achievement AS
    SELECT id, personId, competencyId, preceptorId, achievedAt, stage AS stage_code, note
      FROM silver_competencyAchievements""")
spark.sql("""CREATE OR REPLACE TABLE fact_change_request AS SELECT * FROM silver_changeRequests""")
spark.sql("""CREATE OR REPLACE TABLE fact_audit_event AS SELECT * FROM silver_auditEvents""")

print("Gold tables ready. Point Power BI Direct Lake at this lakehouse.")
