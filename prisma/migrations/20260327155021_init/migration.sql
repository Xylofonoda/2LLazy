/*
  Warnings:

  - You are about to drop the column `jobPostingId` on the `Application` table. All the data in the column will be lost.
  - You are about to drop the column `notes` on the `Application` table. All the data in the column will be lost.
  - You are about to drop the column `jobPostingId` on the `CoverLetter` table. All the data in the column will be lost.
  - You are about to drop the column `durationMin` on the `Interview` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `JobPosting` table. All the data in the column will be lost.
  - Added the required column `jobId` to the `Application` table without a default value. This is not possible if the table is not empty.
  - Added the required column `jobId` to the `CoverLetter` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Interview` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Application" DROP CONSTRAINT "Application_jobPostingId_fkey";

-- DropForeignKey
ALTER TABLE "CoverLetter" DROP CONSTRAINT "CoverLetter_jobPostingId_fkey";

-- DropIndex
DROP INDEX "Application_jobPostingId_key";

-- DropIndex
DROP INDEX "CoverLetter_jobPostingId_key";

-- AlterTable
ALTER TABLE "Application" DROP COLUMN "jobPostingId",
DROP COLUMN "notes",
ADD COLUMN     "errorMessage" TEXT,
ADD COLUMN     "jobId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "CoverLetter" DROP COLUMN "jobPostingId",
ADD COLUMN     "generatedByAI" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "jobId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Interview" DROP COLUMN "durationMin",
ADD COLUMN     "durationMinutes" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'UTC',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "JobPosting" DROP COLUMN "createdAt",
ADD COLUMN     "scrapedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN     "cvPath" TEXT,
ALTER COLUMN "name" DROP DEFAULT,
ALTER COLUMN "email" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "JobPosting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoverLetter" ADD CONSTRAINT "CoverLetter_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "JobPosting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
