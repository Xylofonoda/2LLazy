import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { APPLICATIONS_TAG } from "./applications";

async function _getStatsData() {
  const [byStatus, weekly] = await Promise.all([
    prisma.application.groupBy({ by: ["status"], _count: true }),
    prisma.$queryRaw<Array<{ week: string; count: bigint }>>`
      SELECT TO_CHAR(DATE_TRUNC('week', "createdAt"), 'YYYY-MM-DD') as week, COUNT(*) as count
      FROM "Application"
      WHERE "createdAt" > NOW() - INTERVAL '8 weeks'
      GROUP BY week ORDER BY week
    `,
  ]);

  const sourceGroups = await prisma.$queryRaw<Array<{ source: string; count: bigint }>>`
    SELECT j.source, COUNT(*) as count
    FROM "Application" a
    JOIN "JobPosting" j ON a."jobId" = j.id
    GROUP BY j.source
  `;

  const total = byStatus.reduce((s, r) => s + r._count, 0);
  const interviews = byStatus.find((r) => r.status === "INTERVIEW")?._count ?? 0;

  return {
    byStatus: byStatus.map((r) => ({ status: r.status, count: r._count })),
    bySource: sourceGroups.map((r) => ({ source: r.source, count: Number(r.count) })),
    weekly: weekly.map((r) => ({ week: r.week, count: Number(r.count) })),
    totalApplications: total,
    interviewRate: total > 0 ? Math.round((interviews / total) * 100) : 0,
  };
}

export const getStatsData = unstable_cache(_getStatsData, ["get-stats"], {
  revalidate: 60,
  tags: [APPLICATIONS_TAG],
});
