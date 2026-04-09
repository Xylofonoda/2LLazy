import { fetchPage } from "./fetcher";
import { batchProcess } from "./utils";
import { extractJobFromText } from "./extract";
import { ScrapedJob } from "./types";
import { extractRelevantJobsFromPage } from "@/lib/ai";

const SENIORITY_MAP: Record<string, string> = {
  Junior: "junior",
  Mid: "medior",
  Senior: "senior",
  Lead: "lead",
};

export async function scrapeCocuma(
  query: string,
  skillLevel: string,
  deepSearch = false,
): Promise<ScrapedJob[]> {
  const seniority = SENIORITY_MAP[skillLevel];
  const seniorityParam = seniority ? `&seniority=${seniority}` : "";
  const MAX_PAGES = deepSearch ? 3 : 1;
  const jobs: ScrapedJob[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const searchUrl =
      `https://www.cocuma.cz/jobs/?q=${encodeURIComponent(query)}${seniorityParam}` +
      (page > 1 ? `&page=${page}` : "");

    const { text: pageText, links } = await fetchPage(searchUrl);

    // GPT reads the listing page like a human and returns only relevant job {title, url} pairs
    const relevant = await extractRelevantJobsFromPage(query, skillLevel, pageText, links);
    if (relevant.length === 0) break;

    const batchedJobs = await batchProcess(relevant, 6, async ({ title, url }) => {
      const { text } = await fetchPage(url);
      const extracted = await extractJobFromText(text, { url, title, company: "", location: "Czech Republic" });
      if (!extracted.title) return null;

      return {
        title: extracted.title,
        company: extracted.company,
        location: extracted.location,
        description: extracted.description,
        sourceUrl: url,
        source: "COCUMA" as const,
        salary: extracted.salary || undefined,
        workType: extracted.workType || undefined,
      };
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
