/* =====================================================================
   CareCompetencies — 99_drop_all.sql
   Teardown. Drops the entire CareCompetencies database.
   ===================================================================== */

USE master;
GO

IF DB_ID('CareCompetencies') IS NOT NULL
BEGIN
    ALTER DATABASE CareCompetencies SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE CareCompetencies;
    PRINT 'CareCompetencies dropped.';
END
ELSE
    PRINT 'CareCompetencies does not exist; nothing to drop.';
GO
