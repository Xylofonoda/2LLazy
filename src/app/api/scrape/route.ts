import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateEmbedding, expandQueryForEmbedding } from "@/lib/ai";
import { scrapeCocuma } from "@/lib/scrapers/cocuma";
import { scrapeStartupJobs } from "@/lib/scrapers/startupjobs";
import { scrapeJobstack } from "@/lib/scrapers/jobstack";
import { scrapeSkilleto } from "@/lib/scrapers/skilleto";
import { scrapeNoFluffJobs } from "@/lib/scrapers/nofluffjobs";
import { scrapeJobsCz } from "@/lib/scrapers/jobscz";
import { ScrapedJob } from "@/lib/scrapers/types";
import { cosineSimilarity } from "@/lib/similarity";

export const runtime = "nodejs";
export const maxDuration = 300;

// Simple in-memory rate limiter (per-IP, resets on server restart)
const rateMap = new Map<string, number>();
const RATE_LIMIT_MS = 10_000; // 10 seconds between requests per IP

/** Remove repeated-half duplicates like "React Native DeveloperReact Native Developer" */
function dedupe(text: string | null | undefined): string {
  if (!text) return text ?? "";
  const half = Math.floor(text.length / 2);
  const first = text.slice(0, half);
  const second = text.slice(half);
  return first === second ? first : text;
}

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

type SSEEvent =
  | { type: "progress"; site: string; message: string }
  | { type: "job"; data: ScrapedJob & { id: string; favourited: boolean; similarity: number; isNew: boolean } }
  | { type: "complete"; total: number }
  | { type: "error"; site: string; message: string };
function sseChunk(event: SSEEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function POST(req: NextRequest) {
  // Rate limiting
  const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown";
  const last = rateMap.get(ip) ?? 0;
  if (Date.now() - last < RATE_LIMIT_MS) {
    return new Response(JSON.stringify({ error: "Too many requests" }), { status: 429 });
  }
  rateMap.set(ip, Date.now());

  const body = await req.json().catch(() => ({}));
  const query: string = body.query ?? "";
  const skillLevel: string = body.skillLevel ?? "";
  const deepSearch: boolean = body.deepSearch === true;
  const city: string = body.city ?? "";
  const salaryMin: number | null = typeof body.salaryMin === "number" ? body.salaryMin : null;
  const salaryMax: number | null = typeof body.salaryMax === "number" ? body.salaryMax : null;

  if (!query) {
    return new Response("Missing query", { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new TransformStream<Uint8Array, Uint8Array>();
  const writer = stream.writable.getWriter();

  const send = async (event: SSEEvent) => {
    await writer.write(encoder.encode(sseChunk(event)));
  };

  // Three scrapers run in parallel via Promise.allSettled below
  const scrapers: Array<{
    name: string;
    fn: () => Promise<ScrapedJob[]>;
  }> = [
      { name: "Cocuma", fn: () => scrapeCocuma(query, skillLevel, deepSearch) },
      { name: "StartupJobs", fn: () => scrapeStartupJobs(query, skillLevel, deepSearch) },
      { name: "Jobstack", fn: () => scrapeJobstack(query, skillLevel, deepSearch) },
      { name: "Skilleto", fn: () => scrapeSkilleto(query, skillLevel, deepSearch, city) },
      { name: "NoFluffJobs", fn: () => scrapeNoFluffJobs(query, skillLevel, deepSearch, city) },
      { name: "Jobs.cz", fn: () => scrapeJobsCz(query, skillLevel, deepSearch, city) },
    ];

  (async () => {
    try {
      // Step 1: embed the search query so we can rank against it
      // Expand short queries (e.g. "Frontend") into rich descriptions for better semantic ranking
      await send({ type: "progress", site: "Search", message: "Generating search embedding…" });
      const expandedQuery = await expandQueryForEmbedding(query, skillLevel);
      const queryEmbedding = await generateEmbedding(expandedQuery);

      let totalEmitted = 0;
      const SIMILARITY_THRESHOLD = 0.30;
      const MAX_PER_SOURCE = deepSearch ? Infinity : 20;

      await Promise.allSettled(
        scrapers.map(async (scraper) => {
          await send({ type: "progress", site: scraper.name, message: `Scraping ${scraper.name}…` });
          try {
            const jobs = await scraper.fn();

            // Pre-fetch existing DB records using raw SQL (embedding is Unsupported type)
            const sourceUrls = jobs.map((j) => j.sourceUrl);
            const existingRecords = await prisma.$queryRaw<Array<{
              id: string;
              sourceUrl: string;
              embedding: string | null;
              scrapedAt: Date;
              favourited: boolean;
              firstSeenAt: Date | null;
            }>>`
              SELECT id, "sourceUrl", embedding::text as embedding, "scrapedAt", "favourited", "firstSeenAt"
              FROM "JobPosting"
              WHERE "sourceUrl" = ANY(${sourceUrls})
            `;

            type ExistingRecord = { id: string; sourceUrl: string; embedding: number[] | null; scrapedAt: Date; favourited: boolean; firstSeenAt: Date | null };
            const existingMap = new Map<string, ExistingRecord>();
            for (const r of existingRecords) {
              existingMap.set(r.sourceUrl, {
                ...r,
                embedding: r.embedding ? JSON.parse(r.embedding) : null,
              } as ExistingRecord);
            }

            // Embed + save all jobs first, collect results, then rank and filter before emitting
            type RankedJob = ScrapedJob & { id: string; favourited: boolean; similarity: number; isNew: boolean };
            const ranked: RankedJob[] = [];

            await send({ type: "progress", site: scraper.name, message: `Ranking ${scraper.name} results…` });

            for (let i = 0; i < jobs.length; i += 8) {
              await Promise.allSettled(
                jobs.slice(i, i + 8).map(async (job) => {
                  job.title = dedupe(job.title);
                  job.company = dedupe(job.company);
                  job.location = dedupe(job.location);
                  try {
                    const existing = existingMap.get(job.sourceUrl);
                    const ageHours = existing?.scrapedAt
                      ? (Date.now() - existing.scrapedAt.getTime()) / 3_600_000
                      : Infinity;

                    const storedEmbedding = existing?.embedding as number[] | null | undefined;
                    const dimensionMatch =
                      storedEmbedding && storedEmbedding.length === queryEmbedding.length;

                    let embedding: number[];
                    let id: string;
                    let favourited: boolean;
                    let isNew: boolean;

                    if (existing?.embedding && ageHours < 24 && dimensionMatch) {
                      embedding = storedEmbedding!;
                      id = existing.id;
                      favourited = existing.favourited;
                      isNew = existing.firstSeenAt
                        ? existing.firstSeenAt.getTime() > Date.now() - TWENTY_FOUR_HOURS
                        : false;
                    } else {
                      const embeddingText = `${job.title}\n${job.title}\n${job.description.slice(0, 1200)}`;
                      embedding = await generateEmbedding(embeddingText);

                      const newId = crypto.randomUUID().replace(/-/g, "");
                      await prisma.$executeRaw`
                        INSERT INTO "JobPosting" (id, title, company, location, description, "sourceUrl", source, salary, "workType", "postedAt", embedding, "scrapedAt", "firstSeenAt", "favourited")
                        VALUES (${newId}, ${job.title}, ${job.company}, ${job.location ?? "Remote"}, ${job.description}, ${job.sourceUrl}, ${job.source}::"JobSource", ${job.salary ?? null}, ${job.workType ?? null}, ${job.postedAt ?? null}, ${JSON.stringify(embedding)}::vector, NOW(), NOW(), false)
                        ON CONFLICT ("sourceUrl") DO UPDATE SET
                          title = EXCLUDED.title,
                          description = EXCLUDED.description,
                          "workType" = EXCLUDED."workType",
                          "scrapedAt" = NOW(),
                          embedding = EXCLUDED.embedding
                      `;
                      const saved = await prisma.jobPosting.findUniqueOrThrow({ where: { sourceUrl: job.sourceUrl } });
                      id = saved.id;
                      favourited = saved.favourited;
                      isNew = saved.firstSeenAt.getTime() > Date.now() - TWENTY_FOUR_HOURS;
                    }

                    const baseSimilarity = cosineSimilarity(queryEmbedding, embedding);
                    // Boost similarity for jobs that have salary info matching user's desired range
                    let similarity = baseSimilarity;
                    if (job.salary && (salaryMin !== null || salaryMax !== null)) {
                      // Extract first number from salary string as a rough match
                      const nums = job.salary.match(/[\d\s]+/g)?.map((n) => parseInt(n.replace(/\s/g, ""), 10)).filter((n) => !isNaN(n) && n > 0) ?? [];
                      if (nums.length > 0) {
                        const mid = nums.reduce((a, b) => a + b, 0) / nums.length;
                        const inRange =
                          (salaryMin === null || mid >= salaryMin) &&
                          (salaryMax === null || mid <= salaryMax);
                        if (inRange) similarity = Math.min(1, similarity + 0.08);
                      }
                    } else if (job.salary && salaryMin === null && salaryMax === null) {
                      // Slight boost for having any salary info (user prefers transparent pay)
                      similarity = Math.min(1, similarity + 0.02);
                    }
                    ranked.push({ ...job, id, favourited, similarity, isNew });
                  } catch (err) {
                    console.error(`[scrape] Failed to save job ${job.sourceUrl}:`, err);
                  }
                }),
              );
            }

            // Filter by threshold, sort by relevance, cap at MAX_PER_SOURCE
            const topJobs = ranked
              .filter((j) => j.similarity >= SIMILARITY_THRESHOLD)
              .sort((a, b) => b.similarity - a.similarity)
              .slice(0, MAX_PER_SOURCE);

            for (const jobData of topJobs) {
              totalEmitted++;
              await send({ type: "job", data: jobData });
            }
          } catch (err) {
            let message = "Unknown error";
            if (err instanceof Error) {
              message = err.message;
              if (err.cause) message += ` (cause: ${err.cause})`;
            } else if (err && typeof err === "object" && "message" in err) {
              message = String((err as { message: unknown }).message);
            } else if (typeof err === "string") {
              message = err;
            } else {
              message = JSON.stringify(err);
            }
            console.error(`[scrape] ${scraper.name} error:`, err);
            await send({ type: "error", site: scraper.name, message });
          }
        }),
      );

      await send({ type: "complete", total: totalEmitted });
    } catch (err) {
      await send({ type: "error", site: "Search", message: err instanceof Error ? err.message : String(err) });
    } finally {
      await writer.close();
    }
  })();

  return new Response(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
