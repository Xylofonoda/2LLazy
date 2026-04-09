import { fetchPage } from "./fetcher";
import { ScrapedJob } from "./types";
import { batchProcess } from "./utils";
import { extractJobFromText } from "./extract";

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
  const MAX_PAGES = deepSearch ? 5 : 2;
  const perPage = deepSearch ? 25 : 10;
  const jobs: ScrapedJob[] = [];

  // Build search URLs — try text search first, then fall back to category slugs.
  // Text search (/nabidky?search=) is more flexible than category slug browsing.
  const buildSearchUrl = (pageNum: number): string => {
    const params = new URLSearchParams({ search: query });
    if (seniority) params.set("seniority", seniority);
    if (pageNum > 1) params.set("page", String(pageNum));
    return `https://www.startupjobs.cz/nabidky?${params.toString()}`;
  };

  for (let pageNum = 1; pageNum <= MAX_PAGES; pageNum++) {
    const searchUrl = buildSearchUrl(pageNum);
    const { links } = await fetchPage(searchUrl);

    type CardSeed = { url: string; title: string; company: string; location: string };
    // Job detail URLs contain /nabidka/ (singular) — list page uses /nabidky/ (plural)
    const seeds: CardSeed[] = links
      .filter(
        (l) => l.url.includes("startupjobs.cz") && l.url.includes("/nabidka/"),
      )
      .filter((l, i, arr) => arr.findIndex((x) => x.url === l.url) === i)
      .slice(0, perPage)
      .map((l) => ({
        url: l.url,
        title: l.text || l.url.split("/nabidka/")[1]?.replace(/-/g, " ") || "",
        company: "",
        location: "Czech Republic",
      }));

    if (seeds.length === 0) break;

    const batchedJobs = await batchProcess(seeds, 6, async (seed) => {
      const { text } = await fetchPage(seed.url);
      const extracted = await extractJobFromText(text, seed);
      if (!extracted.title) return null;

      return {
        title: extracted.title,
        company: extracted.company,
        location: extracted.location,
        description: extracted.description,
        sourceUrl: seed.url,
        source: "STARTUPJOBS" as const,
        salary: extracted.salary || undefined,
      };
    });

    jobs.push(...batchedJobs);

    if (deepSearch) {
      const { prisma } = await import("@/lib/prisma");
      const pageSourceUrls = seeds.map((s) => s.url);
      const existingCount = await prisma.jobPosting.count({
        where: { sourceUrl: { in: pageSourceUrls } },
      });
      if (existingCount === pageSourceUrls.length) break;
    }
  }

  return jobs;
}
