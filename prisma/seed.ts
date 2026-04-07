/**
 * Demo seed — favourites real scraped jobs and adds applications/interview for the demo.
 * Safe to re-run (all operations are idempotent).
 * Run: npx tsx prisma/seed.ts
 */
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, ApplicationStatus } from "@prisma/client";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("neon.tech") ? { rejectUnauthorized: false } : false,
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

const DEMO_COVER_LETTER = `Dear Hiring Team,

I am writing to express my strong interest in this role. With 4+ years of experience building production React and TypeScript applications, I am excited by the opportunity to contribute to your engineering team.

In my recent projects I led a full migration from a legacy codebase to a modern Next.js + TypeScript stack, introduced a shared component library, and reduced bundle size by 40% through code-splitting. I am comfortable across the full stack — Node.js APIs, PostgreSQL, GraphQL, and cloud deployments.

I would love the opportunity to discuss how I can contribute to your team's goals. Thank you for your consideration.

Best regards,
Daniel`;

async function main() {
  console.log("🌱 Seeding demo data into Neon...\n");

  // Step 1: Favourite 5 of the real scraped jobs
  const titlesToFavourite = [
    "Senior Frontend Engineer, React.js",
    "Senior Backend/Fullstack Node.JS Developer",
    "Frontend React Developer",
    "React developer",
    "Full Stack Developer",
  ];

  const favouritedIds: string[] = [];
  for (const title of titlesToFavourite) {
    const job = await prisma.jobPosting.findFirst({ where: { title: { contains: title } } });
    if (job) {
      await prisma.jobPosting.update({ where: { id: job.id }, data: { favourited: true } });
      favouritedIds.push(job.id);
      console.log(`⭐ Favourited: ${job.title} @ ${job.company}`);
    }
  }

  if (favouritedIds.length === 0) {
    console.log("⚠️  No matching jobs found to favourite. Run a scrape first.");
    return;
  }

  // Step 2: Add a cover letter to the first favourited job
  const firstJobId = favouritedIds[0];
  const firstJob = await prisma.jobPosting.findUnique({ where: { id: firstJobId } });

  let coverLetterId: string | undefined;
  const existingCL = await prisma.coverLetter.findFirst({ where: { jobId: firstJobId } });
  if (!existingCL) {
    const cl = await prisma.coverLetter.create({
      data: { jobId: firstJobId, content: DEMO_COVER_LETTER, generatedByAI: true },
    });
    coverLetterId = cl.id;
    console.log(`✅ Cover letter created for: ${firstJob?.title}`);
  } else {
    coverLetterId = existingCL.id;
    console.log(`⏭️  Cover letter already exists for: ${firstJob?.title}`);
  }

  // Step 3: Add applications in different statuses across the favourited jobs
  const appStatuses: { idx: number; status: ApplicationStatus; appliedAt: Date | null }[] = [
    { idx: 0, status: ApplicationStatus.INTERVIEW, appliedAt: new Date("2026-03-28") },
    { idx: 1, status: ApplicationStatus.APPLIED, appliedAt: new Date("2026-04-01") },
    { idx: 2, status: ApplicationStatus.PENDING, appliedAt: null },
    { idx: 3, status: ApplicationStatus.REJECTED, appliedAt: new Date("2026-03-20") },
  ];

  for (const { idx, status, appliedAt } of appStatuses) {
    const jobId = favouritedIds[idx];
    if (!jobId) continue;
    const job = await prisma.jobPosting.findUnique({ where: { id: jobId } });
    const existing = await prisma.application.findFirst({ where: { jobId } });
    if (!existing) {
      await prisma.application.create({
        data: {
          jobId,
          status,
          appliedAt,
          coverLetterId: idx === 0 ? coverLetterId : undefined,
        },
      });
      console.log(`✅ Application: ${job?.title} → ${status}`);
    } else {
      console.log(`⏭️  Application already exists: ${job?.title}`);
    }
  }

  // Step 4: Add an interview for the INTERVIEW application
  const interviewApp = await prisma.application.findFirst({
    where: { jobId: favouritedIds[0], status: ApplicationStatus.INTERVIEW },
  });
  if (interviewApp) {
    const existingInterview = await prisma.interview.findUnique({
      where: { applicationId: interviewApp.id },
    });
    if (!existingInterview) {
      await prisma.interview.create({
        data: {
          applicationId: interviewApp.id,
          scheduledAt: new Date("2026-04-10T10:00:00Z"),
          timezone: "Europe/Prague",
          durationMinutes: 60,
          notes: "Technical interview — React, TypeScript, system design. Prepare: virtual DOM, memoization, GraphQL patterns.",
        },
      });
      console.log(`✅ Interview scheduled for Apr 10`);
    } else {
      console.log(`⏭️  Interview already exists`);
    }
  }

  console.log("\n🎉 Done! Dashboard, Favourites and Interviews are ready to demo.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
