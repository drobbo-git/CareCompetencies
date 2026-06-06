# CareCompetencies — ETL

This folder contains everything you need to land the CareCompetencies data model
in either **SQL Server** (on-prem or Azure SQL) or **Microsoft Fabric**
(Lakehouse + Warehouse).

It is written for a working ETL engineer. The source of truth for the schema is
the React app under `src/data/types.ts` and `src/data/seed.ts`; this folder
packages that into a portable JSON extract and two parallel load paths.

> **Recent changes (rebrand + schema notes)**
> - Project rebranded from **CompetencyInsight** to **CareCompetencies**
>   (tagline: *Part of CareOps — Integrated Healthcare Operations*).
> - JSON extract renamed: `competencyinsight_seed.json` → `carecompetencies_seed.json`.
> - **`CompetencyCategory` is deprecated in the UI.** The Add Competency dialog
>   no longer exposes it (Group is the meaningful axis). The table is still
>   populated for back-compat; treat it as a candidate for retirement in a
>   future schema migration. Do not build new analytics on it.

## Folder layout

```
CareCompetencies/
  etl/
    README.md                              ← you are here
    data/
      carecompetencies_seed.json           ← single JSON extract (download separately)
    sqlserver/
      01_create_database.sql
      02_create_raw_tables.sql
      03_create_dim_fact_tables.sql
      04_load_raw_from_json.sql
      05_transform_raw_to_dim_fact.sql
      06_views_for_reporting.sql
      99_drop_all.sql
    fabric/
      lakehouse_bronze_silver_gold.py
      warehouse_ddl.sql
      warehouse_copy_into.sql
  deploy/                                  ← see deploy/README.md for front-end deployment
```

## Data model summary

| Entity | Notes |
|---|---|
| Unit | DUHS innovation units |
| NurseRole | RN today; future-proofed for NCA, HUC, etc. |
| CompetencyCategory | **Deprecated** — kept for back-compat, not surfaced in UI |
| CompetencyGroup | Hierarchical (self-FK), up to 4 levels |
| Preceptor | Experienced RN signing off |
| Administrator | Catalog owner |
| Nurse | Orientee; FK to Unit + Primary Preceptor |
| Competency | Many-to-many with Unit via bridge |
| CompetencyStep | Ordered children of Competency |
| CompetencyAssignment | (Competency × Unit × Role) with Stage |
| StepObservation | Immutable audit fact |
| CompetencyAchievement | Sign-off fact |
| ChangeRequest | Non-admin library change request (workflow) |
| AuditEvent | Governance log |

Three pieces worth calling out:

- `Competency.unitIds[]` is a JSON array in the app. In a relational store we
  normalize it to `dim.competency_unit_bridge`.
- `CompetencyGroup.parentGroupId` is a self-referencing FK. The load script
  defers the constraint check and inserts roots first, children second.
- **Stage** is an enum with associated day counts. We persist that as `ref.stage`.

## Path A — SQL Server

Works on SQL Server 2016+, Azure SQL DB, or Azure SQL Managed Instance.

### One-time prereqs

- The JSON extract `etl/data/carecompetencies_seed.json` needs to be readable
  by SQL Server. Either copy it to a path the SQL Server service account can
  read, or drop it in Azure Blob storage and use an EXTERNAL DATA SOURCE.
- Edit the `@json_path` variable near the top of
  `04_load_raw_from_json.sql` to point at that file.

### Run order

```
01_create_database.sql
02_create_raw_tables.sql
03_create_dim_fact_tables.sql
04_load_raw_from_json.sql            ← re-runnable; truncates raw.* and reloads
05_transform_raw_to_dim_fact.sql     ← re-runnable; MERGE upserts
06_views_for_reporting.sql
```

Everything is idempotent. You can re-run 04 → 06 as many times as you want.

## Path B — Microsoft Fabric

Two flavors depending on where you want the gold layer.

### B1. Fabric Lakehouse (PySpark / Delta)

`fabric/lakehouse_bronze_silver_gold.py` is a single notebook you can paste
into a Fabric Notebook attached to a Lakehouse. Standard medallion pattern:
Bronze (raw JSON → Delta) → Silver (typed, deduped) → Gold (star schema).

### B2. Fabric Warehouse (T-SQL)

Fabric Warehouse does **not** support IDENTITY, MERGE, or OPENJSON with
file-system access. So:

- Land JSON in OneLake (`Files/landing/carecompetencies_seed.json`).
- `warehouse_copy_into.sql` runs `COPY INTO` to load raw rows into staging
  tables defined in `warehouse_ddl.sql`.
- `warehouse_ddl.sql` uses ROW_NUMBER() for surrogate keys and CTAS for gold.

Run order: `warehouse_ddl.sql`, then `warehouse_copy_into.sql`.

## Refresh strategy

For a production cut-over from the React prototype to a real backend:

1. Replace the in-app `src/data/seed.ts` with a service that writes to
   `raw.*` via REST or a service bus.
2. Schedule `05_transform_raw_to_dim_fact.sql` (or the Silver/Gold notebook)
   on a cadence — every 5 minutes is fine; the volume is tiny.
3. Point Power BI / CareOps reporting at the views in `rpt.*` (SQL Server)
   or the gold tables (Fabric).
