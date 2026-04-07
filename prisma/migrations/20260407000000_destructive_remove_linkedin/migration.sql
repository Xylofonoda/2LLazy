-- Clean slate: truncate all job data to avoid cast failures when dropping LINKEDIN
TRUNCATE "JobPosting" CASCADE;
TRUNCATE "SiteCredential";

-- Rebuild JobSource enum: remove LINKEDIN, add COCUMA
ALTER TYPE "JobSource" RENAME TO "JobSource_old";
CREATE TYPE "JobSource" AS ENUM ('STARTUPJOBS', 'JOBSTACK', 'COCUMA');
ALTER TABLE "JobPosting" ALTER COLUMN "source" TYPE "JobSource" USING "source"::text::"JobSource";
DROP TYPE "JobSource_old";

-- Remove SiteCredential table and SiteName enum (auto-apply feature removed)
DROP TABLE "SiteCredential";
DROP TYPE "SiteName";
