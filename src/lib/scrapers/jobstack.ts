import { fetchPage } from "./fetcher";
import { ScrapedJob } from "./types";
import { batchProcess } from "./utils";
import { extractJobFromText } from "./extract";
import { extractRelevantJobsFromPage } from "@/lib/ai";

export async function scrapeJobstack(
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
  const seniorityParam = seniority ? `&seniority=${seniority}` : "";
  const MAX_PAGES = deepSearch ? 5 : 1;
  const jobs: ScrapedJob[] = [];

  const q = encodeURIComponent(query);
  const buildPageUrl = (pageNum: number) =>
    `https://www.jobstack.it/it-jobs?keywords=${q}&isDetail=1${seniorityParam}${pageNum > 1 ? `&page=${pageNum}` : ""}`;

  for (let pageNum = 1; pageNum <= MAX_PAGES; pageNum++) {
    const searchUrl = buildPageUrl(pageNum);
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
        source: "JOBSTACK" as const,
        salary: extracted.salary || undefined,
        workType: extracted.workType || undefined,
      };
    });

    jobs.push(...batchedJobs);

    if (deepSearch) {
      const { prisma } = await import("@/lib/prisma");
      const pageSourceUrls = relevant.map((j) => j.url);
      const existingCount = await prisma.jobPosting.count({
        where: { sourceUrl: { in: pageSourceUrls } },
      });
      if (existingCount === pageSourceUrls.length) break;
    }
  }

  return jobs;
}
