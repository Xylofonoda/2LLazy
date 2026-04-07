import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ApplicationStatus, JobSource } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import type { Application, AppStatus } from "@/types";
import { ALL_STATUSES } from "@/types";

const VALID_SOURCES = new Set(Object.values(JobSource));

export interface ApplicationFilters {
  status?: string;
  source?: string;
  position?: string;
  hasSalary?: boolean;
}

function buildJobWhere(filters?: Omit<ApplicationFilters, "status">): Prisma.JobPostingWhereInput | undefined {
  const { source, position, hasSalary } = filters ?? {};
  const clause: Prisma.JobPostingWhereInput = {};
  if (source && source !== "ALL" && VALID_SOURCES.has(source as JobSource)) clause.source = source as JobSource;
  if (hasSalary) clause.salary = { not: null };
  if (position?.trim()) {
    clause.OR = [
      { title: { contains: position.trim(), mode: "insensitive" } },
      { company: { contains: position.trim(), mode: "insensitive" } },
    ];
  }
  return Object.keys(clause).length > 0 ? clause : undefined;
}

// Cache tag used by all application-related data so server actions can
// invalidate everything with a single revalidateTag("applications") call.
export const APPLICATIONS_TAG = "applications";

async function _getApplications(filters?: ApplicationFilters): Promise<Application[]> {
  const { status, ...rest } = filters ?? {};
  const job = buildJobWhere(rest);
  const apps = await prisma.application.findMany({
    where: {
      ...(status && status !== "ALL" ? { status: status as ApplicationStatus } : {}),
      ...(job ? { job } : {}),
    },
    include: { job: true, coverLetter: true, interview: true },
    orderBy: { createdAt: "desc" },
  });

  return apps.map((app) => ({
    id: app.id,
    status: app.status as AppStatus,
    appliedAt: app.appliedAt?.toISOString() ?? null,
    errorMessage: app.errorMessage,
    job: {
      id: app.job.id,
      title: app.job.title,
      company: app.job.company,
      location: app.job.location ?? "",
      description: app.job.description,
      source: app.job.source,
      sourceUrl: app.job.sourceUrl,
      salary: app.job.salary ?? null,
    },
    coverLetter: app.coverLetter
      ? { id: app.coverLetter.id, content: app.coverLetter.content }
      : null,
    interview: app.interview
      ? {
        id: app.interview.id,
        scheduledAt: app.interview.scheduledAt.toISOString(),
        durationMinutes: app.interview.durationMinutes,
        notes: app.interview.notes,
      }
      : null,
  }));
}

async function _getApplicationSources(): Promise<string[]> {
  const rows = await prisma.jobPosting.findMany({
    where: { applications: { some: {} } },
    distinct: ["source"],
    select: { source: true },
    orderBy: { source: "asc" },
  });
  return rows.map((r) => r.source as string);
}

async function _getApplicationStatusCounts(
  filters?: Omit<ApplicationFilters, "status">,
): Promise<Record<string, number>> {
  const job = buildJobWhere(filters);
  const groups = await prisma.application.groupBy({
    by: ["status"],
    where: job ? { job } : undefined,
    _count: true,
  });
  const counts: Record<string, number> = Object.fromEntries(
    ALL_STATUSES.map((s) => [s, 0]),
  );
  for (const g of groups) {
    counts[g.status] = g._count;
  }
  return counts;
}

// Cached wrappers — results stored in Next.js Data Cache (backed by Netlify blob
// storage in production). Each unique set of arguments is a separate cache entry.
// All entries share the "applications" tag so a single revalidateTag invalidates all.
export const getApplications = unstable_cache(_getApplications, ["get-applications"], {
  revalidate: 60,
  tags: [APPLICATIONS_TAG],
});

export const getApplicationSources = unstable_cache(_getApplicationSources, ["get-application-sources"], {
  revalidate: 60,
  tags: [APPLICATIONS_TAG],
});

export const getApplicationStatusCounts = unstable_cache(_getApplicationStatusCounts, ["get-application-status-counts"], {
  revalidate: 60,
  tags: [APPLICATIONS_TAG],
});
