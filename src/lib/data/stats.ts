import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { applicationTag } from "./applications";

async function _getStatsData(userId: string) {
  const [byStatus, weekly] = await Promise.all([
    prisma.application.groupBy({ by: ["status"], where: { userId }, _count: { _all: true } }),
    prisma.$queryRaw<Array<{ week: string; count: bigint }>>`
      SELECT TO_CHAR(DATE_TRUNC('week', "createdAt"), 'YYYY-MM-DD') as week, COUNT(*) as count
      FROM "Application"
      WHERE "createdAt" > NOW() - INTERVAL '8 weeks'
        AND "userId" = ${userId}
      GROUP BY week ORDER BY week
    `,
  ]);

  const sourceGroups = await prisma.$queryRaw<Array<{ source: string; count: bigint }>>`
    SELECT j.source, COUNT(*) as count
    FROM "Application" a
    JOIN "JobPosting" j ON a."jobId" = j.id
    WHERE a."userId" = ${userId}
    GROUP BY j.source
  `;

  const total = byStatus.reduce((s, r) => s + r._count._all, 0);
  const interviews = byStatus.find((r) => r.status === "INTERVIEW")?._count._all ?? 0;

  return {
    byStatus: byStatus.map((r) => ({ status: r.status, count: r._count._all })),
    bySource: sourceGroups.map((r) => ({ source: r.source, count: Number(r.count) })),
    weekly: weekly.map((r) => ({ week: r.week, count: Number(r.count) })),
    totalApplications: total,
    interviewRate: total > 0 ? Math.round((interviews / total) * 100) : 0,
  };
}

export function getStatsData(userId: string) {
  return unstable_cache(
    () => _getStatsData(userId),
    ["get-stats", userId],
    { revalidate: 60, tags: [applicationTag(userId)] },
  )();
}

