import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  const jobs = await prisma.jobPosting.findMany({
    select: { title: true, company: true, source: true, favourited: true, scrapedAt: true },
    orderBy: { scrapedAt: "desc" },
    take: 50,
  });

  console.log(`\nTotal jobs in DB: ${jobs.length}\n`);
  console.table(jobs.map(j => ({
    title: j.title.slice(0, 45),
    company: j.company.slice(0, 20),
    source: j.source,
    fav: j.favourited,
    scrapedAt: j.scrapedAt.toISOString().slice(0, 16),
  })));

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });

