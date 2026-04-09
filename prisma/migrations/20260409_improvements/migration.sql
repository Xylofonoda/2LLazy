-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Add OFFER to ApplicationStatus enum
ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS 'OFFER';

-- Add notes to Application
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "notes" TEXT;

-- Convert embedding column from JSON to vector
-- Drop old JSON column and add vector column (embeddings will be regenerated on next scrape)
ALTER TABLE "JobPosting" DROP COLUMN IF EXISTS "embedding";
ALTER TABLE "JobPosting" ADD COLUMN "embedding" vector(1536);
