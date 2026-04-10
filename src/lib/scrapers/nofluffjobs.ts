/**
 * NoFluffJobs scraper — uses Playwright to render the HTML search page.
 *
 * The old /api/search/posting endpoint is broken (returns 400 — API changed).
 * NFJ uses tech-specific URLs:  https://nofluffjobs.com/cz/{Technology}?remote=true
 * which redirect to the correct path and return actual job listings.
 *
 * We only scrape REMOTE jobs — most non-remote listings are based in Poland.
 */
import { pwFetch } from "./playwright-browser";
import { batchProcess } from "./utils";
import { extractJobFromText } from "./extract";
import { ScrapedJob } from "./types";
import { extractRelevantJobsFromPage } from "@/lib/ai";

const BASE = "https://nofluffjobs.com";

export async function scrapeNoFluffJobs(
  query: string,
  skillLevel: string,
  deepSearch = false,
  _city = "",
): Promise<ScrapedJob[]> {
  const MAX_PAGES = deepSearch ? 3 : 2;
  const jobs: ScrapedJob[] = [];
  const seenUrls = new Set<string>();

  for (let page = 1; page <= MAX_PAGES; page++) {
    // Tech-specific URL gives accurate results; remote=true filters out Poland-only postings
    const searchUrl =
      `${BASE}/cz/${encodeURIComponent(query)}?remote=true` +
      (page > 1 ? `&page=${page}` : "");

    let result: { text: string; links: Array<{ text: string; url: string }> };
    try {
      result = await pwFetch(searchUrl, "a[href*='/cz/job/']");
    } catch {
      break;
    }

    const { text: pageText, links } = result;
    if (!pageText || pageText.length < 100) break;

    // Filter to only /cz/job/ links and dedupe
    const jobLinks = links
      .filter((l) => l.url.includes("/cz/job/"))
      .filter((l) => {
        if (seenUrls.has(l.url)) return false;
        seenUrls.add(l.url);
        return true;
      });

    if (jobLinks.length === 0) break;

    // If page 2 has the exact same links as page 1, NFJ has no more pages
    if (page > 1 && jobs.length > 0) {
      const existingUrls = new Set(jobs.map((j) => j.sourceUrl));
      const allSeen = jobLinks.every((l) => existingUrls.has(l.url));
      if (allSeen) break;
    }

    const relevant = await extractRelevantJobsFromPage(query, skillLevel, pageText, jobLinks);
    if (relevant.length === 0) break;

    const batchedJobs = await batchProcess(relevant, 4, async ({ title, url }) => {
      try {
        const { text } = await pwFetch(url, "[class*='description'], [class*='job-desc'], main");
        const extracted = await extractJobFromText(text, { url, title, company: "", location: "Remote" });
        if (!extracted.title) return null;

        return {
          title: extracted.title,
          company: extracted.company,
          location: extracted.location || "Remote",
          description: extracted.description,
          sourceUrl: url,
          source: "NOFLUFFJOBS" as const,
          salary: extracted.salary || undefined,
          workType: "Remote",
        };
      } catch {
        return null;
      }
    });

    jobs.push(...batchedJobs);

    if (deepSearch) {
      const { prisma } = await import("@/lib/prisma");
      const pageUrls = relevant.map((j) => j.url);
      const freshCount = await prisma.jobPosting.count({
        where: { sourceUrl: { in: pageUrls }, scrapedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      });
      if (freshCount === pageUrls.length) break;
    }

    if (page < MAX_PAGES) await new Promise((r) => setTimeout(r, 800));
  }

  return jobs;
}
