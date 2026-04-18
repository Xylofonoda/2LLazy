/**
 * Demo seed — favourites real scraped jobs and adds applications/interview for the demo.
 * Safe to re-run (all operations are idempotent).
 * Run: npx tsx prisma/seed.ts
 */
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, ApplicationStatus } from "@prisma/client";
import { OpenAIEmbeddings } from "@langchain/openai";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("neon.tech") ? { rejectUnauthorized: false } : false,
});
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

// ─── Role profile data ────────────────────────────────────────────────────────

const ROLE_PROFILES: Array<{
  category: string;
  description: string;
  antiQuery: string;
}> = [
    {
      category: "Frontend",
      description:
        "Frontend web developer skilled in React.js, Vue.js, or Angular with deep expertise in JavaScript and TypeScript. " +
        "Builds responsive, accessible user interfaces using HTML5, CSS3, and modern component libraries (Material UI, Tailwind, Ant Design). " +
        "Strong knowledge of client-side state management (Redux, Zustand, Pinia), bundlers (Vite, Webpack), and cross-browser testing. " +
        "Works closely with designers to implement pixel-perfect UIs and collaborates with backend teams to integrate REST and GraphQL APIs. " +
        "Typical roles: Frontend Developer, UI Developer, React Developer, Vue Developer, Angular Developer.",
      antiQuery:
        "Backend engineer designing server-side REST APIs, managing PostgreSQL databases, deploying Kubernetes containers, " +
        "building iOS or Android native apps, performing QA automation testing, or working in data engineering and machine learning pipelines.",
    },
    {
      category: "Backend",
      description:
        "Backend software engineer specialising in server-side application development, API design, and database management. " +
        "Proficient in Node.js, Python, Java, Go, or Ruby, building scalable microservices and RESTful or GraphQL APIs. " +
        "Deep experience with relational databases (PostgreSQL, MySQL), caching (Redis), and message queues (Kafka, RabbitMQ). " +
        "Deploys services to AWS, GCP, or Azure and applies security best practices including authentication and authorisation. " +
        "Typical roles: Backend Developer, Node.js Engineer, Python Developer, API Engineer, Software Engineer.",
      antiQuery:
        "Frontend developer building React or Vue user interfaces, mobile iOS or Android engineer writing Swift or Kotlin, " +
        "DevOps infra engineer managing Kubernetes clusters, QA automation tester, or machine learning data scientist.",
    },
    {
      category: "Fullstack",
      description:
        "Fullstack developer comfortable across the entire web stack — from React or Vue frontends to Node.js or Python backends. " +
        "Implements product features end-to-end: designing database schemas, building REST or GraphQL APIs, and creating polished UI components. " +
        "Experienced with TypeScript, PostgreSQL, CI/CD pipelines, and cloud deployment (AWS, Netlify, Vercel, GCP). " +
        "Can work independently on a feature from design mockup to production deployment. " +
        "Typical roles: Fullstack Developer, Full-Stack Engineer, Software Engineer (web), React + Node Developer.",
      antiQuery:
        "Pure DevOps or cloud infrastructure engineer, QA-only automation engineer, native iOS or Android mobile developer, " +
        "data engineer building ETL pipelines, or machine learning researcher.",
    },
    {
      category: "Mobile",
      description:
        "Mobile application developer building cross-platform or native apps for iOS and Android. " +
        "Expert in React Native or Flutter for cross-platform development, and/or Swift/SwiftUI for iOS or Kotlin/Jetpack Compose for Android. " +
        "Publishes apps to the App Store and Google Play, integrates device APIs (push notifications, camera, GPS), and optimises for mobile performance. " +
        "Collaborates with backend teams on REST API contracts and applies mobile security best practices. " +
        "Typical roles: React Native Developer, Flutter Developer, iOS Developer, Android Developer, Mobile Engineer.",
      antiQuery:
        "Web frontend developer building React or Vue browser applications, backend API engineer, DevOps cloud infrastructure engineer, " +
        "QA engineer, or data scientist.",
    },
    {
      category: "DevOps",
      description:
        "DevOps or Platform Engineer managing cloud infrastructure, CI/CD pipelines, and developer tooling. " +
        "Expert in Kubernetes, Docker, Terraform/Pulumi (IaC), and cloud platforms (AWS, GCP, Azure). " +
        "Designs and maintains GitLab CI, GitHub Actions, or Jenkins pipelines for automated testing and deployment. " +
        "Sets up observability stacks (Prometheus, Grafana, ELK), manages secrets, and enforces security policies. " +
        "Typical roles: DevOps Engineer, Cloud Engineer, Platform Engineer, SRE, Infrastructure Engineer.",
      antiQuery:
        "Frontend web developer, backend feature developer, mobile iOS or Android programmer, QA tester, " +
        "data engineer building ETL pipelines.",
    },
    {
      category: "Data",
      description:
        "Data engineer or data scientist building data pipelines, warehouses, and machine learning workflows. " +
        "Skilled in Python, SQL, Apache Spark, Airflow, and modern data platforms (BigQuery, Snowflake, Databricks). " +
        "Designs ETL/ELT pipelines, maintains data quality, and builds dashboards in Tableau or Metabase. " +
        "For ML roles: trains and deploys models using scikit-learn, TensorFlow, or PyTorch, applying MLOps practices. " +
        "Typical roles: Data Engineer, Data Analyst, Data Scientist, ML Engineer, Analytics Engineer.",
      antiQuery:
        "Frontend web developer, backend API engineer, DevOps cloud engineer, mobile developer, QA automation engineer.",
    },
    {
      category: "QA",
      description:
        "QA engineer or SDET responsible for test strategy, automation frameworks, and release quality. " +
        "Builds and maintains automated test suites using Selenium, Playwright, Cypress, or Jest. " +
        "Designs unit, integration, and end-to-end test plans; integrates tests into CI/CD pipelines. " +
        "Collaborates with developers to reproduce bugs, triage issues in Jira, and enforce quality gates. " +
        "Typical roles: QA Automation Engineer, SDET, Test Engineer, QA Analyst.",
      antiQuery:
        "Frontend UI developer, backend service engineer, DevOps cloud engineer, mobile app developer, " +
        "data engineer.",
    },
    {
      category: "Design",
      description:
        "UX/UI designer creating user-centred digital product experiences. " +
        "Produces wireframes, prototypes, and high-fidelity designs in Figma or Sketch, runs usability tests and conducts user research. " +
        "Collaborates closely with frontend engineers to ensure design implementation fidelity. " +
        "Applies design systems thinking and ensures WCAG accessibility compliance. " +
        "Typical roles: UX Designer, UI Designer, Product Designer, UX Researcher.",
      antiQuery:
        "Software engineer writing code, backend API developer, DevOps cloud engineer, data scientist, QA testing engineer.",
    },
  ];

// ─── Demo seed data ───────────────────────────────────────────────────────────

const DEMO_COVER_LETTER = `Dear Hiring Team,

I am writing to express my strong interest in this role. With 4+ years of experience building production React and TypeScript applications, I am excited by the opportunity to contribute to your engineering team.

In my recent projects I led a full migration from a legacy codebase to a modern Next.js + TypeScript stack, introduced a shared component library, and reduced bundle size by 40% through code-splitting. I am comfortable across the full stack — Node.js APIs, PostgreSQL, GraphQL, and cloud deployments.

I would love the opportunity to discuss how I can contribute to your team's goals. Thank you for your consideration.

Best regards,
Daniel`;

async function main() {
  console.log("🌱 Seeding demo data into Neon...\n");

  // Resolve userId — pass SEED_USER_ID env var or use the first user in the DB
  let userId: string | undefined = process.env.SEED_USER_ID;
  if (!userId) {
    const firstUser = await prisma.user.findFirst({ select: { id: true } });
    userId = firstUser?.id;
  }
  if (!userId) {
    console.log("⚠️  No user found. Log in via Google OAuth first, then re-run the seed.");
    console.log("   Or set SEED_USER_ID=<your-user-id> in .env");
    return;
  }
  console.log(`👤 Seeding for userId: ${userId}\n`);

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
      await prisma.userFavourite.upsert({
        where: { userId_jobId: { userId, jobId: job.id } },
        create: { userId, jobId: job.id },
        update: {},
      });
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
  const existingCL = await prisma.coverLetter.findFirst({ where: { jobId: firstJobId, userId } });
  if (!existingCL) {
    const cl = await prisma.coverLetter.create({
      data: { userId, jobId: firstJobId, content: DEMO_COVER_LETTER, generatedByAI: true },
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
    const existing = await prisma.application.findFirst({ where: { jobId, userId } });
    if (!existing) {
      await prisma.application.create({
        data: {
          userId,
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
    where: { jobId: favouritedIds[0], status: ApplicationStatus.INTERVIEW, userId },
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

// ─── Role profile seeding ─────────────────────────────────────────────────────

async function seedRoleProfiles() {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY?.trim();
  if (!OPENAI_API_KEY) {
    console.log("⚠️  OPENAI_API_KEY not set — skipping role profile seeding.");
    return;
  }

  console.log("\n📚 Seeding RAG role profiles…");

  const embeddings = new OpenAIEmbeddings({
    model: "text-embedding-3-small",
    apiKey: OPENAI_API_KEY,
  });

  for (const profile of ROLE_PROFILES) {
    try {
      console.log(`  Embedding: ${profile.category}…`);
      const [embedding, antiEmbedding] = await Promise.all([
        embeddings.embedQuery(profile.description),
        embeddings.embedQuery(profile.antiQuery),
      ]);

      const embJson = JSON.stringify(embedding);
      const antiJson = JSON.stringify(antiEmbedding);

      await prisma.$executeRaw`
        INSERT INTO "RoleProfile" (id, category, description, "antiQuery", embedding, "antiEmbedding", "updatedAt")
        VALUES (
          gen_random_uuid()::text,
          ${profile.category},
          ${profile.description},
          ${profile.antiQuery},
          ${embJson}::vector,
          ${antiJson}::vector,
          NOW()
        )
        ON CONFLICT (category) DO UPDATE SET
          description    = EXCLUDED.description,
          "antiQuery"    = EXCLUDED."antiQuery",
          embedding      = EXCLUDED.embedding,
          "antiEmbedding" = EXCLUDED."antiEmbedding",
          "updatedAt"    = NOW()
      `;

      console.log(`  ✅ ${profile.category}`);
    } catch (err) {
      console.error(`  ❌ ${profile.category}:`, err);
    }
  }

  console.log("📚 Role profiles seeded.\n");
}

async function runAll() {
  await main();
  await seedRoleProfiles();
}

runAll()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
