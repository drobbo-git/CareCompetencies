# ADR-001: Azure SQL Server over PostgreSQL

**Status:** Accepted
**Date:** 2026-06 (approximate — retroactive ADR)
**Deciders:** Lead developer; DHTS alignment

## Context

The first version of CareCompetencies was built with PostgreSQL as the database, hosted
as a Railway-managed service. PostgreSQL was chosen at that stage for simplicity: it was
free, easy to spin up on Railway alongside the API container, and the default choice for
most Node/Express prototypes.

After initial development, a review of DUHS/DHTS standards for internal enterprise
applications made clear that Azure SQL Server is the appropriate platform — it aligns
with the Microsoft-shop environment, the planned Entra identity integration, and the
possibility of Fabric analytics on top of the same data. The database was migrated from
PostgreSQL to Azure SQL Server; the API routes were kept as-is and a translation layer
was added in `api/src/db.ts` to convert PostgreSQL-style `$N` parameter placeholders
to SQL Server `@pN` syntax at runtime.

## Decision

Use Azure SQL Server as the operational database. The `mssql` npm driver is used.
Route files continue to use PostgreSQL-style `$1/$2` placeholders; `api/src/db.ts`
translates these to `@p1/@p2` before executing against SQL Server.

## Alternatives Considered

- **PostgreSQL on Railway** — used in v1. Simple and free, but not aligned with DHTS
  enterprise standards for internal DUHS applications. Would have required a separate
  Fabric/ETL integration path rather than native Azure SQL → Fabric connectivity.
- **Azure SQL Server** — chosen. Aligns with DHTS standards, Entra ID integration,
  and the Microsoft-stack environment at DUHS.

## Consequences

- **Positive:**
  - Aligns with DHTS enterprise standards for internal applications.
  - Native path to Entra ID / Azure AD integration for authentication.
  - Direct connectivity to Microsoft Fabric for analytics (ETL scripts target both
    SQL Server and Fabric — see `etl/`).
  - Azure SQL serverless tier allows low-cost dev/prototype hosting with auto-pause.
- **Trade-offs:**
  - SQL Server doesn't support `ON CONFLICT DO UPDATE`; upserts require T-SQL `MERGE`
    (see `api/src/routes/assignments.ts`).
  - The `$N`→`@pN` translation layer in `db.ts` is non-obvious — see CLAUDE.md gotchas.
  - Local dev requires a SQL Server instance (not just `npm install`).
  - `api/.env.example` still has a stale `DATABASE_URL=postgresql://...` line from v1.
- **Follow-up actions:**
  - Remove the stale `DATABASE_URL` line from `api/.env.example`.
  - Document local SQL Server setup (Docker one-liner) in CLAUDE.md and `deploy/README.md`.

## Notes

See also: ADR-002 (authentication approach).
