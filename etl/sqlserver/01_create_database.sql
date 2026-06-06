/* =====================================================================
   CareCompetencies — 01_create_database.sql
   Creates the database and the five working schemas.
   ===================================================================== */

USE master;
GO

-- OPTIONAL teardown — uncomment to wipe and recreate.
-- IF DB_ID('CareCompetencies') IS NOT NULL
-- BEGIN
--     ALTER DATABASE CareCompetencies SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
--     DROP DATABASE CareCompetencies;
-- END
-- GO

IF DB_ID('CareCompetencies') IS NULL
BEGIN
    CREATE DATABASE CareCompetencies;
END
GO

ALTER DATABASE CareCompetencies SET RECOVERY SIMPLE;
ALTER DATABASE CareCompetencies SET READ_COMMITTED_SNAPSHOT ON;
GO

USE CareCompetencies;
GO

IF SCHEMA_ID('raw')  IS NULL EXEC('CREATE SCHEMA raw');
IF SCHEMA_ID('stg')  IS NULL EXEC('CREATE SCHEMA stg');
IF SCHEMA_ID('dim')  IS NULL EXEC('CREATE SCHEMA dim');
IF SCHEMA_ID('fact') IS NULL EXEC('CREATE SCHEMA fact');
IF SCHEMA_ID('ref')  IS NULL EXEC('CREATE SCHEMA ref');
IF SCHEMA_ID('rpt')  IS NULL EXEC('CREATE SCHEMA rpt');
GO

PRINT 'CareCompetencies database and schemas ready.';
GO
