import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { CalendarEntry } from "@/types";

export const INTERVIEWS_TAG = "interviews";
export const interviewTag = (userId: string) => `${INTERVIEWS_TAG}:${userId}`;

async function _getCalendarEntriesForMonth(
  userId: string,
  month: number,
  year: number,
): Promise<CalendarEntry[]> {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);

  const [interviews, events] = await Promise.all([
    prisma.interview.findMany({
      where: {
        scheduledAt: { gte: start, lt: end },
        application: { userId },
      },
      include: { application: { include: { job: true } } },
      orderBy: { scheduledAt: "asc" },
    }),
    prisma.calendarEvent.findMany({
      where: { userId, scheduledAt: { gte: start, lt: end } },
      orderBy: { scheduledAt: "asc" },
    }),
  ]);

  const interviewEntries: CalendarEntry[] = interviews.map((iv) => ({
    id: iv.id,
    type: "interview",
    title: iv.application.job.company,
    subtitle: iv.application.job.title,
    scheduledAt: iv.scheduledAt.toISOString(),
    durationMinutes: iv.durationMinutes,
    notes: iv.notes,
  }));

  const eventEntries: CalendarEntry[] = events.map((ev) => ({
    id: ev.id,
    type: "event",
    title: ev.title,
    scheduledAt: ev.scheduledAt.toISOString(),
    durationMinutes: ev.durationMinutes,
    notes: ev.notes,
  }));

  return [...interviewEntries, ...eventEntries].sort(
    (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
  );
}

export function getCalendarEntriesForMonth(userId: string, month: number, year: number) {
  return unstable_cache(
    () => _getCalendarEntriesForMonth(userId, month, year),
    ["get-calendar-entries", userId, String(month), String(year)],
    { revalidate: 60, tags: [interviewTag(userId)] },
  )();
}


