import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateEmbedding, expandQueryForEmbedding } from "@/lib/ai";
import { classifyQueryIntent } from "@/lib/queryIntent";
import { getRoleProfile, buildAugmentedQueryText, scoreWithNegative } from "@/lib/ragProfiles";
import { scrapeCocuma } from "@/lib/scrapers/cocuma";
import { scrapeStartupJobs } from "@/lib/scrapers/startupjobs";
import { scrapeJobstack } from "@/lib/scrapers/jobstack";
import { scrapeSkilleto } from "@/lib/scrapers/skilleto";
import { scrapeNoFluffJobs } from "@/lib/scrapers/nofluffjobs";
import { scrapeJobsCz } from "@/lib/scrapers/jobscz";
import { scrapeJooble } from "@/lib/scrapers/jooble";
import { ScrapedJob } from "@/lib/scrapers/types";
import { cosineSimilarity } from "@/lib/similarity";
import { auth } from "@/auth";

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
  | { type: "job"; data: ScrapedJob & { id: string; favourited: boolean; similarity: number; isNew: boolean; isStale?: boolean } }
  | { type: "scraperDone"; site: string; doneCount: number; total: number }
  | { type: "scrapersDone"; total: number }
  | { type: "complete"; total: number }
  | { type: "error"; site: string; message: string };
function sseChunk(event: SSEEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }
  const userId = session.user.id;

  // Rate limiting
  // NOTE: x-forwarded-for is set by Netlify's CDN and trusted in this deployment.
  // On other infrastructure this header is spoofable — use a proxy-trusted IP extraction instead.
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

  (async () => {
    try {
      // Step 1: Classify the query intent (fast path: static table, no extra API call)
      const intent = await classifyQueryIntent(query, skillLevel);

      // Scrapers defined here so they can capture intent for intent-aware boards
      const scrapers: Array<{ name: string; fn: () => Promise<ScrapedJob[]> }> = [
        { name: "Cocuma", fn: () => scrapeCocuma(query, skillLevel, deepSearch) },
        { name: "StartupJobs", fn: () => scrapeStartupJobs(query, skillLevel, deepSearch, { intent }) },
        { name: "Jobstack", fn: () => scrapeJobstack(query, skillLevel, deepSearch) },
        { name: "Skilleto", fn: () => scrapeSkilleto(query, skillLevel, deepSearch, city) },
        { name: "NoFluffJobs", fn: () => scrapeNoFluffJobs(query, skillLevel, deepSearch, city, { intent, scrapingKeyword: intent.scrapingKeyword }) },
        { name: "Jobs.cz", fn: () => scrapeJobsCz(query, skillLevel, deepSearch, city) },
        { name: "Jooble", fn: () => scrapeJooble(query, skillLevel, deepSearch, city) },
      ];

      // Step 2: Expand the query into a rich embedding-friendly description
      await send({ type: "progress", site: "Search", message: "Generating search embedding…" });
      const expandedQuery = await expandQueryForEmbedding(query, skillLevel, intent);

      // Step 3: RAG augmentation — load canonical role profile from DB
      const roleProfile = await getRoleProfile(intent.category);
      const augmentedQueryText = roleProfile
        ? buildAugmentedQueryText(expandedQuery, roleProfile)
        : expandedQuery;

      // Step 4: Embed the (possibly augmented) query + optionally embed the anti-text
      const [queryEmbedding, antiEmbedding] = await Promise.all([
        generateEmbedding(augmentedQueryText),
        roleProfile?.antiQuery ? generateEmbedding(roleProfile.antiQuery) : Promise.resolve(null),
      ]);

      // emittedSourceUrls prevents duplicates when multiple scrapers find the same job URL
      // or when the cached DB pass re-encounters a freshly scraped job.
      const emittedSourceUrls = new Set<string>();
      const emittedIds = new Set<string>();
      let doneCount = 0;
      const totalScrapers = scrapers.length;
      const SIMILARITY_THRESHOLD = 0.30;

      // Pre-load user's favourited job IDs for this session
      const userFavouriteIds = new Set(
        (await prisma.userFavourite.findMany({ where: { userId }, select: { jobId: true } }))
          .map((f) => f.jobId)
      );

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
              firstSeenAt: Date | null;
            }>>`
              SELECT id, "sourceUrl", embedding::text as embedding, "scrapedAt", "firstSeenAt"
              FROM "JobPosting"
              WHERE "sourceUrl" = ANY(${sourceUrls})
            `;

            type ExistingRecord = { id: string; sourceUrl: string; embedding: number[] | null; scrapedAt: Date; firstSeenAt: Date | null };
            const existingMap = new Map<string, ExistingRecord>();
            for (const r of existingRecords) {
              existingMap.set(r.sourceUrl, {
                ...r,
                embedding: r.embedding ? JSON.parse(r.embedding) : null,
              } as ExistingRecord);
            }

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
                      favourited = userFavouriteIds.has(existing.id);
                      isNew = existing.firstSeenAt
                        ? existing.firstSeenAt.getTime() > Date.now() - TWENTY_FOUR_HOURS
                        : false;
                    } else {
                      const embeddingText = `${job.title}\n${job.title}\n${job.description.slice(0, 1200)}`;
                      embedding = await generateEmbedding(embeddingText);

                      const newId = crypto.randomUUID().replace(/-/g, "");
                      await prisma.$executeRaw`
                        INSERT INTO "JobPosting" (id, title, company, location, description, "sourceUrl", source, salary, "workType", "postedAt", embedding, "scrapedAt", "firstSeenAt")
                        VALUES (${newId}, ${job.title}, ${job.company}, ${job.location ?? "Remote"}, ${job.description}, ${job.sourceUrl}, ${job.source}::"JobSource", ${job.salary ?? null}, ${job.workType ?? null}, ${job.postedAt ?? null}, ${JSON.stringify(embedding)}::vector, NOW(), NOW())
                        ON CONFLICT ("sourceUrl") DO UPDATE SET
                          title = EXCLUDED.title,
                          description = EXCLUDED.description,
                          "workType" = EXCLUDED."workType",
                          "scrapedAt" = NOW(),
                          embedding = EXCLUDED.embedding
                      `;
                      const saved = await prisma.jobPosting.findUniqueOrThrow({ where: { sourceUrl: job.sourceUrl } });
                      id = saved.id;
                      favourited = userFavouriteIds.has(id);
                      isNew = saved.firstSeenAt.getTime() > Date.now() - TWENTY_FOUR_HOURS;
                    }

                    const baseSimilarity = antiEmbedding
                      ? scoreWithNegative(embedding, queryEmbedding, antiEmbedding)
                      : cosineSimilarity(queryEmbedding, embedding);
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

                    // Emit immediately (emit-as-you-go streaming)
                    if (similarity >= SIMILARITY_THRESHOLD && !emittedSourceUrls.has(job.sourceUrl)) {
                      emittedSourceUrls.add(job.sourceUrl);
                      emittedIds.add(id);
                      await send({ type: "job", data: { ...job, id, favourited, similarity, isNew } });
                    }
                  } catch (err) {
                    console.error(`[scrape] Failed to save job ${job.sourceUrl}:`, err);
                  }
                }),
              );
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
          } finally {
            doneCount++;
            await send({ type: "scraperDone", site: scraper.name, doneCount, total: totalScrapers });
          }
        }),
      );

      await send({ type: "scrapersDone", total: emittedIds.size });

      // ── Surface cached jobs that weren't scraped this run ──────────────
      // pgvector ORDER BY ranks candidates in the DB — no JS sort needed for
      // the common (no antiEmbedding) case. When antiEmbedding is present we
      // re-sort the 200-row subset in JS after applying the negative penalty.
      try {
        await send({ type: "progress", site: "Cache", message: "Loading cached results…" });
        const queryVec = JSON.stringify(queryEmbedding);
        const cachedRows = await prisma.$queryRaw<Array<{
          id: string;
          title: string;
          company: string;
          location: string;
          description: string;
          sourceUrl: string;
          source: string;
          salary: string | null;
          workType: string | null;
          embedding: string;
          firstSeenAt: Date;
          postedAt: Date | null;
        }>>`
          SELECT id, title, company, location, description, "sourceUrl",
                 source::text as source, salary, "workType",
                 embedding::text as embedding, "firstSeenAt", "postedAt"
          FROM "JobPosting"
          WHERE embedding IS NOT NULL
          ORDER BY embedding <=> ${queryVec}::vector
          LIMIT 200
        `;

        // Apply threshold (+ optional anti-penalty) on the pre-sorted 200 rows
        const candidates: Array<{ row: (typeof cachedRows)[0]; similarity: number }> = [];
        for (const row of cachedRows) {
          if (emittedIds.has(row.id) || emittedSourceUrls.has(row.sourceUrl)) continue;
          try {
            const emb = JSON.parse(row.embedding) as number[];
            if (emb.length !== queryEmbedding.length) continue;
            const similarity = antiEmbedding
              ? scoreWithNegative(emb, queryEmbedding, antiEmbedding)
              : cosineSimilarity(queryEmbedding, emb);
            if (similarity >= SIMILARITY_THRESHOLD) candidates.push({ row, similarity });
          } catch { /* malformed embedding */ }
        }

        // Re-sort only when negative penalty may have changed the pgvector order
        if (antiEmbedding) candidates.sort((a, b) => b.similarity - a.similarity);

        for (const { row, similarity } of candidates.slice(0, 80)) {
          emittedSourceUrls.add(row.sourceUrl);
          emittedIds.add(row.id);
          await send({
            type: "job",
            data: {
              id: row.id,
              title: row.title,
              company: row.company,
              location: row.location,
              description: row.description,
              sourceUrl: row.sourceUrl,
              source: row.source as ScrapedJob["source"],
              salary: row.salary ?? undefined,
              workType: row.workType ?? undefined,
              postedAt: row.postedAt ?? undefined,
              favourited: userFavouriteIds.has(row.id),
              similarity,
              isNew: false,
              isStale: true,
            },
          });
        }
      } catch (err) {
        console.error("[scrape] Cache surfacing failed:", err);
      }

      await send({ type: "complete", total: emittedIds.size });
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
