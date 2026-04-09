import { fetchPage } from "./fetcher";
import { ScrapedJob } from "./types";
import { batchProcess } from "./utils";
import { extractJobFromText } from "./extract";

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
  const perPage = deepSearch ? 25 : 10;
  const jobs: ScrapedJob[] = [];

  const q = encodeURIComponent(query);
  const buildPageUrl = (pageNum: number) =>
    `https://www.jobstack.it/it-jobs?keywords=${q}&isDetail=1${seniorityParam}${pageNum > 1 ? `&page=${pageNum}` : ""}`;

  for (let pageNum = 1; pageNum <= MAX_PAGES; pageNum++) {
    const searchUrl = buildPageUrl(pageNum);
    const { links } = await fetchPage(searchUrl);

    type CardSeed = { url: string; title: string; company: string; location: string };
    const seeds: CardSeed[] = links
      .filter((l) => /\/it-job\/[^/]+\/\w+/.test(l.url))
      .filter((l, i, arr) => arr.findIndex((x) => x.url === l.url) === i) // dedupe
      .slice(0, perPage)
      .map((l) => ({
        url: l.url,
        title: l.text || l.url.split("/it-job/")[1]?.split("/")[0]?.replace(/-/g, " ") || "",
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
        source: "JOBSTACK" as const,
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
