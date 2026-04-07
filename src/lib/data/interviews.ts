import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { CalendarEntry } from "@/types";

export const INTERVIEWS_TAG = "interviews";

async function _getCalendarEntriesForMonth(
  month: number,
  year: number,
): Promise<CalendarEntry[]> {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);

  const [interviews, events] = await Promise.all([
    prisma.interview.findMany({
      where: { scheduledAt: { gte: start, lt: end } },
      include: { application: { include: { job: true } } },
      orderBy: { scheduledAt: "asc" },
    }),
    prisma.calendarEvent.findMany({
      where: { scheduledAt: { gte: start, lt: end } },
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

export const getCalendarEntriesForMonth = unstable_cache(
  _getCalendarEntriesForMonth,
  ["get-calendar-entries"],
  { revalidate: 60, tags: [INTERVIEWS_TAG] },
);

