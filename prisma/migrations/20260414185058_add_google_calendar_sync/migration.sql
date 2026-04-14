-- AlterTable
ALTER TABLE "CalendarEvent" ADD COLUMN     "googleCalendarEventId" TEXT;

-- AlterTable
ALTER TABLE "Interview" ADD COLUMN     "googleCalendarEventId" TEXT;

-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN     "googleCalendarSync" BOOLEAN NOT NULL DEFAULT false;
