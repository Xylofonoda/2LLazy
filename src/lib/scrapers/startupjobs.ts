import { getBrowser } from "@/lib/browser";
import { randomDelay } from "@/lib/auth/sessionManager";
import { ScrapedJob } from "./types";
import { dismissCookies, batchProcess } from "./utils";
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
): Promise<ScrapedJob[]> {
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    locale: "cs-CZ",
    extraHTTPHeaders: { "Accept-Language": "cs-CZ,cs;q=0.9,en;q=0.8" },
  });
  const page = await context.newPage();
  const jobs: ScrapedJob[] = [];

  const seniorityMap: Record<string, string> = {
    Junior: "junior",
    Mid: "medior",
    Senior: "senior",
    Lead: "lead",
  };
  const seniority = seniorityMap[skillLevel];
  const seniorityParam = seniority ? `?seniority=${seniority}` : "";

  const slugs = queryToStartupJobsSlugs(query);
  const slugPath = slugs.join(",");

  try {
    const searchUrl = `https://www.startupjobs.cz/nabidky/${slugPath}${seniorityParam}`;
    await page.goto(searchUrl, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => null);
    await randomDelay(800, 1400);

    await dismissCookies(page);
    await randomDelay(300, 600);

    await page.waitForSelector('a[href*="/nabidka/"]', { timeout: 15000 }).catch(() => null);

    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight));
      await randomDelay(500, 1000);
    }

    type CardSeed = { url: string; title: string; company: string; location: string };
    const seeds: CardSeed[] = await page.evaluate(() => {
      const results: CardSeed[] = [];
      const anchors = Array.from(document.querySelectorAll('a[href*="/nabidka/"]'));
      const seen = new Set<string>();
      for (const anchor of anchors) {
        const url = (anchor as HTMLAnchorElement).href;
        if (seen.has(url) || !url.includes('startupjobs.cz')) continue;
        seen.add(url);
        const card = anchor.closest('[class*="offer"], [class*="Offer"], [class*="job"], [class*="Job"], article, li') ?? anchor;
        const h = card.querySelector('h1, h2, h3')?.textContent?.trim()
          ?? anchor.textContent?.trim()
          ?? url.split('/nabidka/')[1]?.replace(/-/g, ' ') ?? '';
        // Company: prefer startup profile link, then class-based selectors
        const co =
          (card.querySelector('a[href*="/startup/"]') as HTMLAnchorElement | null)?.textContent?.trim()
          ?? card.querySelector('[class*="company"], [class*="Company"], [class*="employer"]')?.textContent?.trim()
          ?? '';
        const loc = card.querySelector('[class*="location"], [class*="Location"], [class*="city"]')?.textContent?.trim() ?? 'Czech Republic';
        results.push({ url, title: h, company: co, location: loc || 'Czech Republic' });
        if (results.length >= 10) break;
      }
      return results;
    });

    const batchedJobs = await batchProcess(seeds, 4, async (seed) => {
      const detailPage = await context.newPage();
      try {
        await detailPage.goto(seed.url, { waitUntil: "domcontentloaded" });
        await detailPage.waitForLoadState("networkidle").catch(() => null);
        await randomDelay(200, 500);
        await dismissCookies(detailPage);

        const bodyText = await detailPage.evaluate(() => (document.body as HTMLElement).innerText ?? "");
        const extracted = await extractJobFromText(bodyText, seed);
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
      } finally {
        await detailPage.close();
      }
    });
    jobs.push(...batchedJobs);
  } finally {
    await context.close();
  }

  return jobs;
}
