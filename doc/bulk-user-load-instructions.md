# CareCompetencies — Bulk User Load File Format

This is the file format for loading new or updated staff records into
CareCompetencies in bulk. Fill out the template (`bulk-user-load-template.csv`)
and send it back to the application administrator, who will upload it through
the app's Bulk User Load screen.

## How it works

- One row per person.
- Each row is matched by **NetID**. If that NetID already exists in
  CareCompetencies, that person's record is **updated**. If it doesn't exist
  yet, a **new** person record is **created**.
- You'll get a result back showing, row by row, whether each person was
  created, updated, or had an error (with a plain-English reason).
- A bad row doesn't block the rest of the file — every other row still loads.

## Columns

| Column | Required? | Description |
|---|---|---|
| `NetID` | **Yes** | Duke NetID. This is the matching key — get this right. |
| `Name` | **Yes** | Full display name, e.g. `Lee, Jordan`. |
| `Unit` | **Yes** | Home unit — must exactly match one of the unit names below (not case-sensitive). |
| `StartDate` | **Yes** | Date the person started in this role, format `YYYY-MM-DD` (e.g. `2026-07-01`). |
| `Role` | No | Clinical role — must match one of the role names below if provided. Leave blank if not applicable. |
| `JobCode` | No | Internal job code, if you track one. Leave blank if not applicable. |

## Valid Unit names (must match exactly, case doesn't matter)

- 2B/2C Clinic
- DN 4100 General Medicine
- DRAH Radiation Oncology
- DRH - Cardiac Cath Services
- Nursing Administration
- Surgical Care Unit (ASC PACU)

## Valid Role names (must match exactly, case doesn't matter)

- RN
- NCA
- HUC

*(Both lists above reflect units/roles configured in CareCompetencies as of
2026-06-16. If you're loading people into a unit or role that isn't listed,
ask the application administrator to add it first — otherwise those rows
will come back as errors.)*

## Format notes

- Plain CSV, comma-separated, first row is the header exactly as shown in
  the template — don't reorder or rename the header row.
- If a `Name` value contains a comma (e.g. `Lee, Jordan`), wrap the whole
  value in double quotes, as shown in the template.
- Save as `.csv`, not `.xlsx`.
