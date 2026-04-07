import { fetchPage } from "./fetcher";
import { ScrapedJob } from "./types";
import { batchProcess } from "./utils";
import { extractJobFromText } from "./extract";

/**
 * Maps a free-text query to one or more StartupJobs.cz category slugs.
 * StartupJobs uses path-based category slugs, not keyword search.
 * e.g. /nabidky/front-end-vyvojar,full-stack-vyvojar
 */
function queryToStartupJobsSlugs(query: string): string[] {
  const q = query.toLowerCase();
  const slugs: string[] = [];

  // React Native / mobile — check before plain "react" to avoid false frontend match
  if (/react[.\s-]?native|\brn\b/.test(q)) {
    slugs.push("react-native-vyvojar", "mobilni-vyvojar");
  }
  // iOS
  if (/\bios\b|\bswift\b/.test(q)) slugs.push("ios-vyvojar");
  // Android
  if (/\bandroid\b|\bkotlin\b/.test(q)) slugs.push("android-vyvojar");
  // Frontend
  if (/front[.\s-]?end|\breact\b|\bvue\b|\bangular\b|\bnext\.?js\b|\bnuxt\b|\bsvelte\b|\btypescript\b|\bjavascript\b|\bcss\b|\bhtml\b/.test(q)) {
    slugs.push("front-end-vyvojar");
  }
  // Backend
  if (/back[.\s-]?end|\bnode\.?js\b|\bexpress\b|\bjava\b|\bpython\b|\bdjango\b|\bphp\b|\bruby\b|\.net\b|\bc#\b|\bgolang\b|\bgo\b|\brust\b|\bspring\b|\bnest\.?js\b/.test(q)) {
    slugs.push("back-end-vyvojar");
  }
  // Fullstack — also pull in front + back so we cast a wider net
  if (/full[.\s-]?stack/.test(q)) {
    slugs.push("full-stack-vyvojar");
    if (!slugs.includes("front-end-vyvojar")) slugs.push("front-end-vyvojar");
    if (!slugs.includes("back-end-vyvojar")) slugs.push("back-end-vyvojar");
  }
  // DevOps / Cloud
  if (/devops|dev[.\s-]?ops|\bkubernetes\b|\bk8s\b|\bdocker\b|ci[/\s-]?cd|\bterraform\b|\bansible\b|\baws\b|\bazure\b|\bgcp\b|\bcloud\b/.test(q)) {
    slugs.push("devops-inzenyr");
  }
  // Data Science / ML / AI
  if (/data[.\s-]?scien|machine[.\s-]?learn|\bml\b|\bai\b|\bllm\b|\bnlp\b|\bpytorch\b|\btensorflow\b/.test(q)) {
    slugs.push("data-scientist");
  }
  // Data Analyst
  if (/data[.\s-]?anal/.test(q)) slugs.push("data-analyst");
  // QA / Testing
  if (/\bqa\b|\btester\b|\btesting\b|quality[.\s-]?assur|\bselenium\b|\bcypress\b|playwright/.test(q)) {
    slugs.push("qa-tester");
  }
  // UI/UX Design
  if (/\bui\b|\bux\b|\bdesigner\b|\bfigma\b|\bsketch\b/.test(q)) slugs.push("ui-ux-designer");
  // Product
  if (/product[.\s-]?manager|product[.\s-]?owner|\bpm\b/.test(q)) slugs.push("product-manager");
  // Security
  if (/security|cyber|pentest|penetration/.test(q)) slugs.push("security-inzenyr");

  // Fallback: cast broad net across the most common dev categories
  if (slugs.length === 0) {
    slugs.push("front-end-vyvojar", "full-stack-vyvojar", "back-end-vyvojar");
  }

  return [...new Set(slugs)];
}

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
  const slugs = queryToStartupJobsSlugs(query);
  const slugPath = slugs.join(",");
  const MAX_PAGES = deepSearch ? 5 : 1;
  const perPage = deepSearch ? 25 : 10;
  const jobs: ScrapedJob[] = [];

  const buildPageUrl = (pageNum: number) => {
    const parts: string[] = [];
    if (seniority) parts.push(`seniority=${seniority}`);
    if (pageNum > 1) parts.push(`page=${pageNum}`);
    const qs = parts.length ? `?${parts.join("&")}` : "";
    return `https://www.startupjobs.cz/nabidky/${slugPath}${qs}`;
  };

  for (let pageNum = 1; pageNum <= MAX_PAGES; pageNum++) {
    const searchUrl = buildPageUrl(pageNum);
    const { links } = await fetchPage(searchUrl);

    type CardSeed = { url: string; title: string; company: string; location: string };
    const seeds: CardSeed[] = links
      .filter(
        (l) => l.url.includes("startupjobs.cz") && l.url.includes("/nabidka/"),
      )
      .filter((l, i, arr) => arr.findIndex((x) => x.url === l.url) === i) // dedupe
      .slice(0, perPage)
      .map((l) => ({
        url: l.url,
        title: l.text || l.url.split("/nabidka/")[1]?.replace(/-/g, " ") || "",
        company: "",
        location: "Czech Republic",
      }));

    if (seeds.length === 0) break;

    const batchedJobs = await batchProcess(seeds, 4, async (seed) => {
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
