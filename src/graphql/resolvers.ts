import { prisma } from "@/lib/prisma";
import { generateEmbedding, generateCoverLetter } from "@/lib/ollama";
import { encrypt, decrypt } from "@/lib/crypto";
import { checkOllamaHealth } from "@/lib/ollama";
import fs from "fs";
import path from "path";
import { applyToJobSite } from "@/lib/apply/applyRouter";
import { ApplicationStatus, SiteName } from "@prisma/client";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

function findCvFile(): string | null {
  if (!fs.existsSync(UPLOADS_DIR)) return null;
  const files = fs.readdirSync(UPLOADS_DIR).filter((f) =>
    /cv|resume/i.test(f) && /\.(pdf|docx|doc|txt)$/i.test(f)
  );
  return files[0] ? path.join(UPLOADS_DIR, files[0]) : null;
}

async function readFileText(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".txt") {
    return fs.readFileSync(filePath, "utf-8");
  }
  if (ext === ".pdf") {
    // Dynamic import to avoid issues
    const pdfParse = (await import("pdf-parse")).default;
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return data.text;
  }
  // For DOCX return empty — user should provide a .txt or .pdf CV for best results
  return fs.readFileSync(filePath, "utf-8").replace(/[^\x20-\x7E\n]/g, " ");
}

export const resolvers = {
  Query: {
    searchJobs: async (
      _: unknown,
      { query, skillLevel = "", limit = 20 }: { query: string; skillLevel?: string; limit?: number }
    ) => {
      const text = `${query} ${skillLevel}`.trim();
      const queryEmbedding = await generateEmbedding(text);

      const allJobs = await prisma.jobPosting.findMany();
      const jobs = allJobs.filter((j) => j.embedding !== null);

      const cosineSimilarity = (a: number[], b: number[]): number => {
        let dot = 0, magA = 0, magB = 0;
        for (let i = 0; i < a.length; i++) {
          dot += a[i] * b[i];
          magA += a[i] * a[i];
          magB += b[i] * b[i];
        }
        return magA && magB ? dot / (Math.sqrt(magA) * Math.sqrt(magB)) : 0;
      };

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

    getSiteCredentials: async () => {
      const creds = await prisma.siteCredential.findMany();
      const sites: SiteName[] = ["LINKEDIN", "INDEED"];
      return sites.map((site) => {
        const found = creds.find((c) => c.site === site);
        return {
          site,
          configured: !!found,
          username: found?.username ?? null,
        };
      });
    },

    getUserProfile: async () => {
      return prisma.userProfile.findFirst();
    },

    ollamaHealth: async () => {
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

    applyToJob: async (
      _: unknown,
      { jobId, coverLetterId }: { jobId: string; coverLetterId?: string }
    ) => {
      const job = await prisma.jobPosting.findUniqueOrThrow({ where: { id: jobId } });

      // Check not already applied
      const existing = await prisma.application.findFirst({
        where: { jobId, status: { in: ["APPLIED", "PENDING"] } },
      });
      if (existing) return existing;

      const application = await prisma.application.create({
        data: { jobId, status: "PENDING", coverLetterId: coverLetterId ?? null },
        include: { job: true, coverLetter: true, interview: true },
      });

      // Fire actual apply in background
      applyToJobSite(job, application.id, coverLetterId).catch(async (err) => {
        await prisma.application.update({
          where: { id: application.id },
          data: { status: "FAILED", errorMessage: String(err) },
        });
      });

      return application;
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
      // Update application status to INTERVIEW
      await prisma.application.update({
        where: { id: applicationId },
        data: { status: "INTERVIEW" },
      });

      return prisma.interview.upsert({
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
      });
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
        const cvFile = findCvFile();
        if (cvFile) {
          cvText = await readFileText(cvFile).catch(() => "");
        }
      }

      const content = await generateCoverLetter(
        job.title,
        job.company,
        job.description,
        cvText
      );

      return prisma.coverLetter.create({
        data: { jobId, content, generatedByAI: true },
      });
    },

    saveSiteCredentials: async (
      _: unknown,
      { site, username, password }: { site: SiteName; username: string; password: string }
    ) => {
      const encryptedPassword = encrypt(password);
      await prisma.siteCredential.upsert({
        where: { site },
        create: { site, username, encryptedPassword },
        update: { username, encryptedPassword, cookieJson: null },
      });
      return { site, configured: true, username };
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
