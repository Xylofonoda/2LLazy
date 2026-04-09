/**
 * Glassdoor scraper — uses Playwright to bypass basic bot protection.
 * URL: https://www.glassdoor.com/Job/czech-republic-{query}-jobs-SRCH_IL.0,14_IN77.htm
 * Note: Glassdoor has heavy anti-bot; Playwright without stealth may still be blocked.
 * This scraper fails gracefully — errors surface as SSE error events, not crashes.
 */
import { pwFetch } from "./playwright-browser";
import { batchProcess } from "./utils";
import { extractJobFromText } from "./extract";
import { ScrapedJob } from "./types";
import { extractRelevantJobsFromPage } from "@/lib/ai";

function buildGlassdoorUrl(query: string, page: number): string {
  const slug = query.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const offset = (page - 1) * 30;
  const base = `https://www.glassdoor.com/Job/czech-republic-${slug}-jobs-SRCH_IL.0,14_IN77_KO15,${15 + slug.length}.htm`;
  return page > 1 ? `${base}?start=${offset}` : base;
}

export async function scrapeGlassdoor(
  query: string,
  skillLevel: string,
  deepSearch = false,
  city = "",
): Promise<ScrapedJob[]> {
  const MAX_PAGES = deepSearch ? 2 : 1;
  const jobs: ScrapedJob[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const searchUrl = buildGlassdoorUrl(query, page);

    let result: { text: string; links: Array<{ text: string; url: string }> };
    try {
      result = await pwFetch(searchUrl, "[data-test='jobListing'], .JobCard, [class*='jobCard']");
    } catch {
      break;
    }

    const { text: pageText, links } = result;
    if (!pageText || pageText.length < 200) break; // blocked / empty

    const relevant = await extractRelevantJobsFromPage(query, skillLevel, pageText, links);
    if (relevant.length === 0) break;

    const batchedJobs = await batchProcess(relevant, 4, async ({ title, url }) => {
      try {
        const { text } = await pwFetch(url);
        const extracted = await extractJobFromText(text, { url, title, company: "", location: city || "Czech Republic" });
        if (!extracted.title) return null;

        return {
          title: extracted.title,
          company: extracted.company,
          location: extracted.location,
          description: extracted.description,
          sourceUrl: url,
          source: "GLASSDOOR" as const,
          salary: extracted.salary || undefined,
          workType: extracted.workType || undefined,
        };
      } catch {
        return null;
      }
    });

    jobs.push(...batchedJobs);
  }

  return jobs;
}
