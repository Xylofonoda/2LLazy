import { prisma } from "@/lib/prisma";
import { ApplicationStatus } from "@prisma/client";
import type { Application, AppStatus } from "@/types";

export async function getApplications(status?: string): Promise<Application[]> {
  const apps = await prisma.application.findMany({
    where:
      status && status !== "ALL"
        ? { status: status as ApplicationStatus }
        : undefined,
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
