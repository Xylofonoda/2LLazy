import { fetchPage } from "./fetcher";
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
    const params = new URLSearchParams({ q: query });
    if (city) params.set("city", city);
    if (page > 1) params.set("page", String(page));

    const searchUrl = `https://www.skilleto.cz/volna-mista/?${params.toString()}`;
    let result: { text: string; links: Array<{ text: string; url: string }> };

    try {
      result = await fetchPage(searchUrl);
    } catch {
      break;
    }

    const { text: pageText, links } = result;
    if (!links.length && !pageText) break;

    const relevant = await extractRelevantJobsFromPage(query, skillLevel, pageText, links);
    if (relevant.length === 0) break;

    const batchedJobs = await batchProcess(relevant, 5, async ({ title, url }) => {
      try {
        const { text } = await fetchPage(url);
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
      const existingCount = await prisma.jobPosting.count({
        where: { sourceUrl: { in: pageUrls } },
      });
      if (existingCount === pageUrls.length) break;
    }
  }

  return jobs;
}
