import { prisma } from "@/lib/prisma";
import type { Interview } from "@/types";

export async function getInterviewsForMonth(
  month: number,
  year: number,
): Promise<Interview[]> {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);

  const items = await prisma.interview.findMany({
    where: { scheduledAt: { gte: start, lt: end } },
    include: { application: { include: { job: true } } },
    orderBy: { scheduledAt: "asc" },
  });

  return items.map((iv) => ({
    id: iv.id,
    scheduledAt: iv.scheduledAt.toISOString(),
    durationMinutes: iv.durationMinutes,
    timezone: iv.timezone,
    notes: iv.notes,
    application: {
      id: iv.application.id,
      job: {
        title: iv.application.job.title,
        company: iv.application.job.company,
      },
    },
  }));
}
