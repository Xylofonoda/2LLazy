-- Recreate JobSource enum with clean values
ALTER TABLE "JobPosting" ALTER COLUMN "source" TYPE TEXT;
DROP TYPE "JobSource";
CREATE TYPE "JobSource" AS ENUM ('LINKEDIN', 'STARTUPJOBS', 'JOBSTACK');
ALTER TABLE "JobPosting" ALTER COLUMN "source" TYPE "JobSource" USING "source"::"JobSource";

-- Recreate SiteName enum with clean values
ALTER TABLE "SiteCredential" ALTER COLUMN "site" TYPE TEXT;
DROP TYPE "SiteName";
CREATE TYPE "SiteName" AS ENUM ('LINKEDIN');
ALTER TABLE "SiteCredential" ALTER COLUMN "site" TYPE "SiteName" USING "site"::"SiteName";

-- Add coverLetterLanguage to UserProfile
ALTER TABLE "UserProfile" ADD COLUMN "coverLetterLanguage" TEXT NOT NULL DEFAULT 'English';

-- CreateTable CalendarEvent
CREATE TABLE "CalendarEvent" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 60,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable CvDocument
CREATE TABLE "CvDocument" (
    "id" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "size" INTEGER NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CvDocument_pkey" PRIMARY KEY ("id")
);
