import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateEmbedding } from "@/lib/ollama";
import { scrapeLinkedIn } from "@/lib/scrapers/linkedin";
import { scrapeStartupJobs } from "@/lib/scrapers/startupjobs";
import { scrapeJobstack } from "@/lib/scrapers/jobstack";
import { ScrapedJob } from "@/lib/scrapers/types";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Remove repeated-half duplicates like "React Native DeveloperReact Native Developer" */
function dedupe(text: string | null | undefined): string {
  if (!text) return text ?? "";
  const half = Math.floor(text.length / 2);
  const first = text.slice(0, half);
  const second = text.slice(half);
  return first === second ? first : text;
}

type SSEEvent =
  | { type: "progress"; site: string; message: string }
  | { type: "job"; data: ScrapedJob & { id: string; favourited: boolean } }
  | { type: "complete"; total: number }
  | { type: "error"; site: string; message: string };

function sseChunk(event: SSEEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const query: string = body.query ?? "";
  const skillLevel: string = body.skillLevel ?? "";

  if (!query) {
    return new Response("Missing query", { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new TransformStream<Uint8Array, Uint8Array>();
  const writer = stream.writable.getWriter();

  const send = async (event: SSEEvent) => {
    await writer.write(encoder.encode(sseChunk(event)));
  };

  const scrapers: Array<{
    name: string;
    fn: () => Promise<ScrapedJob[]>;
  }> = [
      { name: "LinkedIn", fn: () => scrapeLinkedIn(query, skillLevel) },
      { name: "StartupJobs", fn: () => scrapeStartupJobs(query, skillLevel) },
      { name: "Jobstack", fn: () => scrapeJobstack(query, skillLevel) },
    ];

  // Run scraping in background so the response stream can start immediately
  (async () => {
    let total = 0;

    for (const scraper of scrapers) {
      await send({ type: "progress", site: scraper.name, message: `Scraping ${scraper.name}...` });

      try {
        const jobs = await scraper.fn();

        for (const job of jobs) {
          // Deduplicate title/company text that may be doubled by hidden screen-reader spans
          job.title = dedupe(job.title);
          job.company = dedupe(job.company);
          job.location = dedupe(job.location);
          try {
            // Generate embedding
            const embeddingText = `${job.title} ${job.company} ${job.description.slice(0, 500)}`;
            const embedding = await generateEmbedding(embeddingText);

            const saved = await prisma.jobPosting.upsert({
              where: { sourceUrl: job.sourceUrl },
              create: {
                title: job.title,
                company: job.company,
                location: job.location ?? "Remote",
                description: job.description,
                sourceUrl: job.sourceUrl,
                source: job.source,
                salary: job.salary ?? null,
                postedAt: job.postedAt ?? null,
                embedding,
              },
              update: {
                title: job.title,
                description: job.description,
                scrapedAt: new Date(),
                embedding,
              },
            });

            total++;
            await send({ type: "job", data: { ...job, id: saved.id, favourited: saved.favourited } });
          } catch (err) {
            // Skip individual job failures silently
            console.error(`[scrape] Failed to save job ${job.sourceUrl}:`, err);
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        await send({ type: "error", site: scraper.name, message });
      }
    }

    await send({ type: "complete", total });
    await writer.close();
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
