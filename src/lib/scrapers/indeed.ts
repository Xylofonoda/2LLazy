import { getBrowser } from "@/lib/browser";
import { randomDelay } from "@/lib/auth/sessionManager";
import { ScrapedJob } from "./types";
import { dismissCookies } from "./utils";

export async function scrapeIndeed(
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

  // Map skill level to Indeed experience filter
  const indeedLevel: Record<string, string> = {
    Junior: "entry_level",
    Mid: "mid_level",
    Senior: "senior_level",
  };
  const explvl = indeedLevel[skillLevel];
  const explvlParam = explvl ? `&sc.0.fexp=${explvl}` : "";

  try {
    const q = encodeURIComponent(query);
    await page.goto(
      `https://cz.indeed.com/jobs?q=${q}&l=czech+republic${explvlParam}`,
      { waitUntil: "domcontentloaded" }
    );
    await randomDelay(1500, 2500);

    // Dismiss cookie consent if present
    await dismissCookies(page);

    // Wait for job cards to appear
    await page.waitForSelector('[data-jk], .job_seen_beacon, .tapItem', { timeout: 12000 }).catch(() => null);

    // Scroll for dynamic content
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight));
      await randomDelay(800, 1500);
    }

    // Try multiple card selectors Indeed uses
    let cards = await page.$$('[data-jk]');
    if (cards.length === 0) cards = await page.$$('.job_seen_beacon');
    if (cards.length === 0) cards = await page.$$('.tapItem');

    for (const card of cards.slice(0, 25)) {
      try {
        const jobKey =
          (await card.getAttribute("data-jk")) ??
          (await card.$eval('[data-jk]', (e) => e.getAttribute('data-jk')).catch(() => null));
        const title =
          (await card.$eval(
            '[data-testid="jobTitle"] span, .jobTitle span, h2.jobTitle span',
            (e) => e.textContent?.trim()
          ).catch(() => "")) ?? "";
        const company =
          (await card.$eval(
            '[data-testid="company-name"], .companyName',
            (e) => e.textContent?.trim()
          ).catch(() => "")) ?? "";
        const location =
          (await card.$eval(
            '[data-testid="text-location"], .companyLocation',
            (e) => e.textContent?.trim()
          ).catch(() => "Czech Republic")) ?? "Czech Republic";
        const salary =
          (await card.$eval(
            '[data-testid="attribute_snippet_testid"], .salary-snippet-container',
            (e) => e.textContent?.trim()
          ).catch(() => undefined));

        if (!title || !jobKey) continue;

        // Use cz.indeed.com for the view URL to stay on Czech Indeed
        const sourceUrl = `https://cz.indeed.com/viewjob?jk=${jobKey}`;

        let description = "";
        try {
          const detailPage = await context.newPage();
          await detailPage.goto(sourceUrl, { waitUntil: "domcontentloaded" });
          await randomDelay(1000, 2000);
          description =
            (await detailPage.$eval(
              '#jobDescriptionText, .jobsearch-jobDescriptionText',
              (e) => e.textContent?.trim()
            ).catch(() => "")) ?? "";
          await detailPage.close();
        } catch {
          // skip
        }

        jobs.push({
          title,
          company,
          location,
          description,
          sourceUrl,
          source: "INDEED",
          salary,
        });
      } catch {
        // skip malformed card
      }
    }
  } finally {
    await context.close();
  }

  return jobs;
}
