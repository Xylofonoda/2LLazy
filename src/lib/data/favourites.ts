import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { JobSource } from "@prisma/client";
import type { JobItem } from "@/types";

const VALID_SOURCES = new Set(Object.values(JobSource));

export interface FavouriteFilters {
  source?: string;
  position?: string;
  hasSalary?: boolean;
}

export const FAVOURITES_TAG = "favourites";

async function _getFavourites(filters?: FavouriteFilters): Promise<JobItem[]> {
  const { source, position, hasSalary } = filters ?? {};
  const jobs = await prisma.jobPosting.findMany({
    where: {
      favourited: true,
      ...(source && source !== "ALL" && VALID_SOURCES.has(source as JobSource) ? { source: source as JobSource } : {}),
      ...(hasSalary ? { salary: { not: null } } : {}),
      ...(position?.trim()
        ? {
          OR: [
            { title: { contains: position.trim(), mode: "insensitive" } },
            { company: { contains: position.trim(), mode: "insensitive" } },
          ],
        }
        : {}),
    },
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

async function _getFavouriteSources(): Promise<string[]> {
  const rows = await prisma.jobPosting.findMany({
    where: { favourited: true },
    distinct: ["source"],
    select: { source: true },
    orderBy: { source: "asc" },
  });
  return rows.map((r) => r.source as string);
}

export const getFavourites = unstable_cache(_getFavourites, ["get-favourites"], {
  revalidate: 60,
  tags: [FAVOURITES_TAG],
});

export const getFavouriteSources = unstable_cache(_getFavouriteSources, ["get-favourite-sources"], {
  revalidate: 60,
  tags: [FAVOURITES_TAG],
});
