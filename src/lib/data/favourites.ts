import { prisma } from "@/lib/prisma";
import type { JobItem } from "@/types";

export async function getFavourites(): Promise<JobItem[]> {
  const jobs = await prisma.jobPosting.findMany({
    where: { favourited: true },
    orderBy: { scrapedAt: "desc" },
    include: {
      coverLetters: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, content: true },
      },
    },
  });

  return jobs.map((job) => ({
    id: job.id,
    title: job.title,
    company: job.company,
    location: job.location ?? "",
    description: job.description,
    sourceUrl: job.sourceUrl,
    source: job.source as string,
    salary: job.salary ?? undefined,
    favourited: job.favourited,
    coverLetter: job.coverLetters[0] ?? null,
  }));
}
