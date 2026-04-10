import { pwFetch } from "./playwright-browser";
import { batchProcess } from "./utils";
import { extractJobFromText } from "./extract";
import { ScrapedJob } from "./types";
import { extractRelevantJobsFromPage } from "@/lib/ai";

export async function scrapeSkilleto(
  query: string,
  skillLevel: string,
  deepSearch = false,
  city = "",
): Promise<ScrapedJob[]> {
  const MAX_PAGES = deepSearch ? 3 : 1;
  const jobs: ScrapedJob[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const slug = query.toLowerCase().replace(/\s+/g, "-");
    const searchUrl = page > 1
      ? `https://www.skilleto.cz/skill/${slug}?page=${page}`
      : `https://www.skilleto.cz/skill/${slug}`;
    let result: { text: string; links: Array<{ text: string; url: string }> };

    try {
      // Skilleto is a SPA — needs JS rendering
      result = await pwFetch(searchUrl, "[class*='job'], [class*='offer'], [class*='position'], a[href*='/pozice/']");
    } catch {
      break;
    }

    const { text: pageText, links } = result;
    if (!links.length && !pageText) break;

    const relevant = await extractRelevantJobsFromPage(query, skillLevel, pageText, links);
    if (relevant.length === 0) break;

    const batchedJobs = await batchProcess(relevant, 5, async ({ title, url }) => {
      try {
        const { text } = await pwFetch(url);
        const extracted = await extractJobFromText(text, { url, title, company: "", location: city || "Czech Republic" });
        if (!extracted.title) return null;

        return {
          title: extracted.title,
          company: extracted.company,
          location: extracted.location,
          description: extracted.description,
          sourceUrl: url,
          source: "SKILLETO" as const,
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
