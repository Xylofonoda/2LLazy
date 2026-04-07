import { prisma } from "@/lib/prisma";
import { generateEmbedding, generateCoverLetter, checkOllamaHealth } from "@/lib/ollama";
import { readCvText } from "@/lib/cv";
import { cosineSimilarity } from "@/lib/similarity";
import { ApplicationStatus, Prisma } from "@prisma/client";

export const resolvers = {
  Query: {
    searchJobs: async (
      _: unknown,
      { query, skillLevel = "", limit = 20 }: { query: string; skillLevel?: string; limit?: number }
    ) => {
      const text = `${query} ${skillLevel}`.trim();
      const queryEmbedding = await generateEmbedding(text);

      const allJobs = await prisma.jobPosting.findMany({
        where: { embedding: { not: Prisma.AnyNull } },
        take: 500,
        select: {
          id: true,
          title: true,
          company: true,
          location: true,
          sourceUrl: true,
          source: true,
          salary: true,
          postedAt: true,
          scrapedAt: true,
          favourited: true,
          embedding: true,
        },
      });
      // Only compare jobs whose embedding dimensions match the query embedding
      // (dimension mismatch occurs when switching embedding providers)
      const jobs = allJobs.filter(
        (j) => j.embedding !== null && (j.embedding as number[]).length === queryEmbedding.length
      );
      return jobs
        .map((job) => ({
          ...job,
          postedAt: job.postedAt?.toISOString() ?? null,
          scrapedAt: job.scrapedAt.toISOString(),
          similarity: cosineSimilarity(queryEmbedding, job.embedding as number[]),
        }))
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);
    },

    getFavourites: async () => {
      const jobs = await prisma.jobPosting.findMany({
        where: { favourited: true },
        orderBy: { scrapedAt: "desc" },
      });
      return jobs.map((job) => ({
        ...job,
        postedAt: job.postedAt?.toISOString() ?? null,
        scrapedAt: job.scrapedAt.toISOString(),
      }));
    },

    getApplications: async (
      _: unknown,
      { status }: { status?: ApplicationStatus }
    ) => {
      return prisma.application.findMany({
        where: status ? { status } : undefined,
        include: { job: true, coverLetter: true, interview: true },
        orderBy: { createdAt: "desc" },
      });
    },

    getApplication: async (_: unknown, { id }: { id: string }) => {
      return prisma.application.findUnique({
        where: { id },
        include: { job: true, coverLetter: true, interview: true },
      });
    },

    getInterviews: async (
      _: unknown,
      { month, year }: { month: number; year: number }
    ) => {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 1);
      return prisma.interview.findMany({
        where: { scheduledAt: { gte: start, lt: end } },
        include: { application: { include: { job: true } } },
        orderBy: { scheduledAt: "asc" },
      });
    },

    getCoverLetter: async (_: unknown, { id }: { id: string }) => {
      return prisma.coverLetter.findUnique({ where: { id } });
    },

    getUserProfile: async () => {
      return prisma.userProfile.findFirst();
    },

    aiHealth: async () => {
      return checkOllamaHealth();
    },
  },

  Mutation: {
    toggleFavourite: async (_: unknown, { jobId }: { jobId: string }) => {
      const job = await prisma.jobPosting.findUniqueOrThrow({ where: { id: jobId } });
      const updated = await prisma.jobPosting.update({
        where: { id: jobId },
        data: { favourited: !job.favourited },
      });
      return {
        ...updated,
        postedAt: updated.postedAt?.toISOString() ?? null,
        scrapedAt: updated.scrapedAt.toISOString(),
      };
    },

    updateApplicationStatus: async (
      _: unknown,
      { id, status }: { id: string; status: ApplicationStatus }
    ) => {
      return prisma.application.update({
        where: { id },
        data: { status },
        include: { job: true, coverLetter: true, interview: true },
      });
    },

    scheduleInterview: async (
      _: unknown,
      {
        applicationId,
        scheduledAt,
        durationMinutes = 60,
        timezone = "UTC",
        notes,
      }: {
        applicationId: string;
        scheduledAt: string;
        durationMinutes?: number;
        timezone?: string;
        notes?: string;
      }
    ) => {
      const [, interview] = await prisma.$transaction([
        prisma.application.update({
          where: { id: applicationId },
          data: { status: "INTERVIEW" },
        }),
        prisma.interview.upsert({
          where: { applicationId },
          create: {
            applicationId,
            scheduledAt: new Date(scheduledAt),
            durationMinutes,
            timezone,
            notes,
          },
          update: {
            scheduledAt: new Date(scheduledAt),
            durationMinutes,
            timezone,
            notes,
          },
        }),
      ]);
      return interview;
    },

    updateInterview: async (
      _: unknown,
      {
        id,
        scheduledAt,
        durationMinutes,
        notes,
      }: {
        id: string;
        scheduledAt?: string;
        durationMinutes?: number;
        notes?: string;
      }
    ) => {
      return prisma.interview.update({
        where: { id },
        data: {
          ...(scheduledAt ? { scheduledAt: new Date(scheduledAt) } : {}),
          ...(durationMinutes !== undefined ? { durationMinutes } : {}),
          ...(notes !== undefined ? { notes } : {}),
        },
      });
    },

    generateCoverLetter: async (
      _: unknown,
      { jobId, useSavedCV = true }: { jobId: string; useSavedCV?: boolean }
    ) => {
      const job = await prisma.jobPosting.findUniqueOrThrow({ where: { id: jobId } });

      let cvText = "";
      if (useSavedCV) {
        cvText = await readCvText().catch(() => "");
      }

      const userProfile = await prisma.userProfile.findFirst({
        select: { coverLetterLanguage: true },
      });
      const language = userProfile?.coverLetterLanguage ?? "English";

      const content = await generateCoverLetter(
        job.title,
        job.company,
        job.description,
        cvText,
        language,
      );

      const [coverLetter] = await prisma.$transaction([
        prisma.coverLetter.create({
          data: { jobId, content, generatedByAI: true },
        }),
        prisma.jobPosting.update({
          where: { id: jobId },
          data: { favourited: true },
        }),
      ]);
      return coverLetter;
    },

    deleteCoverLetter: async (_: unknown, { id }: { id: string }) => {
      // Nullify any application referencing this cover letter before deleting
      await prisma.application.updateMany({
        where: { coverLetterId: id },
        data: { coverLetterId: null },
      });
      await prisma.coverLetter.delete({ where: { id } });
      return true;
    },

    saveUserProfile: async (
      _: unknown,
      args: {
        name: string;
        email: string;
        phone?: string;
        linkedInUrl?: string;
        githubUrl?: string;
      }
    ) => {
      const existing = await prisma.userProfile.findFirst();
      if (existing) {
        return prisma.userProfile.update({ where: { id: existing.id }, data: args });
      }
      return prisma.userProfile.create({ data: args });
    },
  },
};
