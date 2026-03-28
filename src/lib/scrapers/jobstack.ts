import { getBrowser } from "@/lib/browser";
import { randomDelay } from "@/lib/auth/sessionManager";
import { ScrapedJob } from "./types";
import { dismissCookies, batchProcess } from "./utils";
import { extractJobFromText } from "./extract";

export async function scrapeJobstack(
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
  const seniorityParam = seniority ? `&seniority=${seniority}` : "";

  try {
    const q = encodeURIComponent(query);
    const searchUrl = `https://www.jobstack.it/it-jobs?keywords=${q}&isDetail=1${seniorityParam}`;
    await page.goto(searchUrl, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => null);
    await randomDelay(800, 1400);

    await dismissCookies(page);
    await randomDelay(300, 600);

    await page.waitForSelector('a[href*="/it-job/"]', { timeout: 15000 }).catch(() => null);

    // Scroll to load lazy content
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight));
      await randomDelay(500, 900);
    }

    type CardSeed = { url: string; title: string; company: string; location: string };
    const seeds: CardSeed[] = await page.evaluate(() => {
      const results: CardSeed[] = [];
      const anchors = Array.from(document.querySelectorAll('a[href*="/it-job/"]'))
        .filter((a) => /\/it-job\/[^/]+\/\w+/.test((a as HTMLAnchorElement).href));
      const seen = new Set<string>();
      for (const anchor of anchors) {
        const url = (anchor as HTMLAnchorElement).href;
        if (seen.has(url)) continue;
        seen.add(url);
        const card = anchor.closest('[class*="card"], [class*="Card"], [class*="job"], [class*="Job"], article, li') ?? anchor;
        const titleText = card.querySelector("h1, h2, h3")?.textContent?.trim()
          ?? anchor.textContent?.trim()
          ?? url.split("/it-job/")[1]?.split("/")[0]?.replace(/-/g, " ") ?? "";
        const companyText =
          (card.querySelector('a[href*="/company-profile/"]') as HTMLAnchorElement | null)?.textContent?.trim()
          ?? card.querySelector('[class*="company"], [class*="Company"], [class*="employer"]')?.textContent?.trim()
          ?? "";
        const loc = card.querySelector('[class*="location"], [class*="city"], [class*="Location"]')?.textContent?.trim() ?? "Czech Republic";
        results.push({ url, title: titleText, company: companyText, location: loc || "Czech Republic" });
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
          source: "JOBSTACK" as const,
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
