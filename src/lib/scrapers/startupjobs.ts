/**
 * StartupJobs scraper — uses Playwright because the JSON API is frequently
 * blocked / rate-limited.  We load the HTML listing page instead and extract
 * job cards directly from the rendered DOM.
 */
import { pwFetch } from "./playwright-browser";
import { batchProcess } from "./utils";
import { extractJobFromText } from "./extract";
import { ScrapedJob } from "./types";
import { extractRelevantJobsFromPage } from "@/lib/ai";

const BASE = "https://www.startupjobs.cz";

export async function scrapeStartupJobs(
  query: string,
  skillLevel: string,
  deepSearch = false,
): Promise<ScrapedJob[]> {
  const seniorityMap: Record<string, string> = {
    Junior: "junior",
    Mid: "medior",
    Senior: "senior",
    Lead: "lead",
  };
  const seniority = seniorityMap[skillLevel];
  const MAX_PAGES = deepSearch ? 4 : 2;
  const jobs: ScrapedJob[] = [];

  for (let pageNum = 1; pageNum <= MAX_PAGES; pageNum++) {
    const params = new URLSearchParams({ search: query });
    if (seniority) params.set("seniority", seniority);
    if (pageNum > 1) params.set("page", String(pageNum));

    const listUrl = `${BASE}/nabidky?${params.toString()}`;

    let result: { text: string; links: Array<{ text: string; url: string }> };
    try {
      result = await pwFetch(listUrl, "[class*='offer'], [class*='job-card'], a[href*='/nabidka/']");
    } catch {
      break;
    }

    const { text: pageText, links } = result;
    if (!pageText || pageText.length < 200) break;

    const relevant = await extractRelevantJobsFromPage(query, skillLevel, pageText, links);
    if (relevant.length === 0) break;

    const batchedJobs = await batchProcess(relevant, 5, async ({ title, url }) => {
      try {
        const { text } = await pwFetch(url);
        const extracted = await extractJobFromText(text, { url, title, company: "", location: "Czech Republic" });
        if (!extracted.title) return null;
        return {
          title: extracted.title,
          company: extracted.company,
          location: extracted.location,
          description: extracted.description,
          sourceUrl: url,
          source: "STARTUPJOBS" as const,
          salary: extracted.salary || undefined,
          workType: extracted.workType || undefined,
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
  }

  return jobs;
}
