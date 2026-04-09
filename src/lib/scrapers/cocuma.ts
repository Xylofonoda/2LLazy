import { fetchPage } from "./fetcher";
import { batchProcess } from "./utils";
import { extractJobFromText } from "./extract";
import { ScrapedJob } from "./types";

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
  const perPage = deepSearch ? 25 : 10;
  const jobs: ScrapedJob[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const searchUrl =
      `https://www.cocuma.cz/jobs/?search=${encodeURIComponent(query)}${seniorityParam}` +
      (page > 1 ? `&page=${page}` : "");

    const { links } = await fetchPage(searchUrl);

    // Job detail pages are deeper than /jobs/ (e.g. /jobs/company/position-slug)
    const jobLinks = links
      .filter((l) => {
        try {
          const u = new URL(l.url);
          const parts = u.pathname.split("/").filter(Boolean);
          return u.hostname.includes("cocuma.cz") && parts[0] === "jobs" && parts.length >= 2;
        } catch {
          return false;
        }
      })
      .filter((l, i, arr) => arr.findIndex((x) => x.url === l.url) === i) // dedupe
      .slice(0, perPage);

    if (jobLinks.length === 0) break;

    const batchedJobs = await batchProcess(jobLinks, 6, async (link) => {
      const { text } = await fetchPage(link.url);
      const seed = {
        url: link.url,
        title: link.text,
        company: "",
        location: "Czech Republic",
      };
      const extracted = await extractJobFromText(text, seed);
      if (!extracted.title) return null;

      return {
        title: extracted.title,
        company: extracted.company,
        location: extracted.location,
        description: extracted.description,
        sourceUrl: link.url,
        source: "COCUMA" as const,
        salary: extracted.salary || undefined,
      };
    });

    jobs.push(...batchedJobs);

    if (deepSearch) {
      const { prisma } = await import("@/lib/prisma");
      const pageUrls = jobLinks.map((l) => l.url);
      const existingCount = await prisma.jobPosting.count({
        where: { sourceUrl: { in: pageUrls } },
      });
      if (existingCount === pageUrls.length) break;
    }
  }

  return jobs;
}
