import { getAuthenticatedPage, randomDelay } from "@/lib/auth/sessionManager";
import { getBrowser } from "@/lib/browser";
import { ScrapedJob } from "./types";

export async function scrapeLinkedIn(
  query: string,
  skillLevel: string,
): Promise<ScrapedJob[]> {
  const browser = await getBrowser();
  let page;
  let ownContext = false;

  try {
    page = await getAuthenticatedPage("LINKEDIN");
  } catch {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    });
    page = await context.newPage();
    ownContext = true;
  }

  const jobs: ScrapedJob[] = [];

  // Map skill level to LinkedIn experience filter
  // f_E: 1=Internship, 2=Entry, 3=Associate, 4=Mid-Senior, 5=Director, 6=Executive
  const experienceFilter: Record<string, string> = {
    Junior: "1,2",
    Mid: "3,4",
    Senior: "4,5",
    Lead: "5,6",
  };
  const fE = experienceFilter[skillLevel];
  const expParam = fE ? `&f_E=${fE}` : "";

  try {
    const q = encodeURIComponent(query);
    // geoId 104508036 = Czechia; also keep f_WT=2 for remote to broaden results
    const url = `https://www.linkedin.com/jobs/search/?keywords=${q}&location=Czechia&geoId=104508036${expParam}`;
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await randomDelay(2000, 3500);

    // Wait for job results to render (authenticated or unauthenticated layout)
    await page
      .waitForSelector(
        ".jobs-search-results__list-item, li.scaffold-layout__list-item, .jobs-search__results-list li",
        { timeout: 15000 },
      )
      .catch(() => null);

    // Scroll to load more jobs
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, 800));
      await randomDelay(800, 1500);
    }

    // Authenticated layout uses different selectors than public/unauthenticated
    let cards = await page.$$(".jobs-search-results__list-item");
    if (cards.length === 0)
      cards = await page.$$("li.scaffold-layout__list-item");
    if (cards.length === 0)
      cards = await page.$$(".jobs-search__results-list li");

    for (const card of cards.slice(0, 20)) {
      try {
        // Extract title from aria-label (clean) or first text node only,
        // to avoid "with verification" badge text that sits inside the same <a>
        const title =
          (await card
            .$eval(
              ".job-card-list__title--link, .artdeco-entity-lockup__title, .base-search-card__title",
              (e) => {
                const el = e as HTMLElement;
                // Prefer aria-label — it's always the clean job title
                if (el.getAttribute("aria-label")) return el.getAttribute("aria-label")!.trim();
                // Fallback: first direct text node only (skips child badge elements)
                for (const node of Array.from(el.childNodes)) {
                  if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
                    return node.textContent.trim();
                  }
                }
                return el.innerText?.split("\n")[0]?.trim() ?? "";
              },
            )
            .catch(() => "")) ?? "";

        // Company
        const company =
          (await card
            .$eval(
              ".artdeco-entity-lockup__subtitle span:first-child, .job-card-container__company-name, .base-search-card__subtitle",
              (e) => (e as HTMLElement).innerText?.trim(),
            )
            .catch(() => "")) ?? "";

        // Location
        const location =
          (await card
            .$eval(
              ".artdeco-entity-lockup__caption, .job-card-container__metadata-item, .job-search-card__location",
              (e) => (e as HTMLElement).innerText?.trim(),
            )
            .catch(() => "Remote")) ?? "Remote";

        // Link href
        const href =
          (await card
            .$eval(
              "a.job-card-list__title--link, a.job-card-container__link, a.base-card__full-link",
              (e) => e.getAttribute("href"),
            )
            .catch(() => "")) ?? "";

        if (!title || !href) continue;

        // Build an absolute URL. LinkedIn authenticated pages return relative hrefs.
        const absoluteHref = href.startsWith("http")
          ? href
          : `https://www.linkedin.com${href}`;

        // Keep the full URL including query params — stripping them breaks
        // authenticated job links that encode the job ID in the query string.
        // But normalise to a canonical /jobs/view/{id}/ form when possible.
        const jobIdMatch = absoluteHref.match(/\/jobs\/view\/(\d+)/);
        const sourceUrl = jobIdMatch
          ? `https://www.linkedin.com/jobs/view/${jobIdMatch[1]}/`
          : absoluteHref;

        // Get description from detail page
        let description = "";
        try {
          const detailPage = await page.context().newPage();
          await detailPage.goto(absoluteHref, { waitUntil: "domcontentloaded" });
          await randomDelay(1500, 2500);
          description =
            (await detailPage
              .$eval(
                "#job-details, .jobs-description__content .jobs-box__html-content, .jobs-description-content__text, .description__text",
                (e) => e.textContent?.trim(),
              )
              .catch(() => "")) ?? "";
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
          source: "LINKEDIN",
        });
      } catch {
        // skip
      }
    }
  } finally {
    if (ownContext) {
      await page.context().close();
    } else {
      await page.close();
    }
  }

  return jobs;
}
