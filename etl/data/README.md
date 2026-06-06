# CareCompetencies — seed data

This folder is where `carecompetencies_seed.json` lives.

**Download it separately** from the app's admin Export Seed JSON page; it is
not bundled into the ETL ZIP because it is generated dynamically from the live
seed code. The two bundles are intentionally split so you can refresh seed data
without re-downloading SQL files (and vice versa).

Once you have the JSON, drop it here and update the `@json_path` variable in
`../sqlserver/04_load_raw_from_json.sql`.
