/**
 * NoFluffJobs scraper — uses their internal search API (POST).
 * URL: https://nofluffjobs.com/cz/jobs/search?keyword={query}&region=czech-republic
 * The site is a React SPA, so we use their JSON API endpoint instead of HTML scraping.
 * Job detail pages are fetched via Playwright to get the full description.
 */
import { pwFetch } from "./playwright-browser";
import { batchProcess } from "./utils";
import { ScrapedJob } from "./types";
import { extractRelevantJobsFromPage } from "@/lib/ai";
import { Agent } from "undici";

const BASE = "https://nofluffjobs.com";
const agent = new Agent({ connect: { timeout: 30_000 } });

const HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "cs,en-US,en;q=0.9",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Origin: "https://nofluffjobs.com",
  Referer: "https://nofluffjobs.com/cz/jobs/",
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-origin",
};

interface NFJPosting {
  id: string;
  title: string;
  name: string;
  url: string;
  company: { name: string };
  location: { placeEn?: string; placePl?: string; place?: string; remote?: boolean };
  salary?: { from?: number; to?: number; currency?: string; type?: string };
  seniority?: string[];
  technology?: string[];
  categoryEn?: string;
}

interface NFJSearchResponse {
  postings?: NFJPosting[];
  totalCount?: number;
}

function formatNFJSalary(s: NFJPosting["salary"]): string | undefined {
  if (!s) return undefined;
  const currency = s.currency ?? "CZK";
  const period = s.type === "b2b" ? " B2B" : s.type === "permanent" ? "/mo" : "";
  if (s.from && s.to) return `${s.from.toLocaleString()} – ${s.to.toLocaleString()} ${currency}${period}`;
  if (s.from) return `From ${s.from.toLocaleString()} ${currency}${period}`;
  if (s.to) return `Up to ${s.to.toLocaleString()} ${currency}${period}`;
  return undefined;
}

async function fetchWithRetry(url: string, body: object, retries = 3, delayMs = 1500): Promise<Response> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: HEADERS,
        body: JSON.stringify(body),
        // @ts-expect-error undici dispatcher not in fetch type definitions
        dispatcher: agent,
      });
      if (res.ok) return res;
      const wait = res.status === 429 ? delayMs * attempt * 2 : delayMs * attempt;
      if (attempt < retries) await new Promise((r) => setTimeout(r, wait));
      else throw new Error(`HTTP ${res.status} for ${url}`);
    } catch (err) {
      if (attempt === retries) {
        if (err instanceof Error) throw err;
        throw new Error(`NoFluffJobs fetch failed: ${String(err)}`);
      }
      await new Promise((r) => setTimeout(r, delayMs * attempt));
    }
  }
  throw new Error(`NoFluffJobs: all retries exhausted`);
}

export async function scrapeNoFluffJobs(
  query: string,
  skillLevel: string,
  deepSearch = false,
  city = "",
): Promise<ScrapedJob[]> {
  const seniorityMap: Record<string, string> = {
    Junior: "junior",
    Mid: "mid",
    Senior: "senior",
    Lead: "lead",
  };
  const seniority = seniorityMap[skillLevel];
  const MAX_PAGES = deepSearch ? 4 : 2;
  const pageSize = 20;
  const jobs: ScrapedJob[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const criteria = [`keyword=${query}`, "region=cz"];
    if (city) criteria.push(`city=${city}`);
    if (seniority) criteria.push(`seniority=${seniority}`);

    const searchBody = {
      criteria: criteria.join(" "),
      page,
      pageSize,
      salaryCurrency: "CZK",
      salaryPeriod: "month",
    };

    let data: NFJSearchResponse;
    try {
      const res = await fetchWithRetry(`${BASE}/api/search/posting`, searchBody);
      data = await res.json() as NFJSearchResponse;
    } catch {
      break;
    }

    const postings = data.postings ?? [];
    if (postings.length === 0) break;

    // Build title+url pairs for GPT pre-filtering
    const titleLinks = postings.map((p) => ({
      text: p.name || p.title || "",
      url: `${BASE}/cz/job/${p.url || p.id}`,
    }));
    const relevant = await extractRelevantJobsFromPage(query, skillLevel, "", titleLinks);
    const relevantUrls = new Set(relevant.map((r) => r.url));

    // Build a lookup for API metadata (location, salary, workType)
    const postingByUrl = new Map(
      postings.map((p) => [`${BASE}/cz/job/${p.url || p.id}`, p]),
    );

    // Fetch full detail pages for each relevant job (SPA — needs Playwright)
    const batchedJobs = await batchProcess(relevant, 5, async ({ title, url }) => {
      try {
        const p = postingByUrl.get(url);
        const locationParts: string[] = [];
        if (p?.location?.placeEn) locationParts.push(p.location.placeEn);
        else if (p?.location?.place) locationParts.push(p.location.place);
        const locationStr = locationParts.join(", ") || (p?.location?.remote ? "Remote" : "Czech Republic");
        const workType = p?.location?.remote ? "Remote" : undefined;

        // Fetch the actual detail page for a rich description
        const { text: pageText } = await pwFetch(url, "[class*='description'], [class*='job-desc'], main");
        // Build a rich description — combine page text with API metadata
        const apiMeta = `${p?.categoryEn ? `Category: ${p.categoryEn}. ` : ""}Technologies: ${(p?.technology ?? []).join(", ")}.`;
        const richDescription = pageText.length > 300
          ? pageText.slice(0, 3500)
          : `${title}. ${apiMeta} ${pageText}`.slice(0, 4000);

        return {
          title: title,
          company: p?.company?.name ?? "",
          location: locationStr,
          description: richDescription,
          sourceUrl: url,
          source: "NOFLUFFJOBS" as const,
          salary: formatNFJSalary(p?.salary),
          workType,
        };
      } catch {
        return null;
      }
    });

    jobs.push(...batchedJobs);

    if (deepSearch) {
      const { prisma } = await import("@/lib/prisma");
      const urls = postings.map((p) => `${BASE}/cz/job/${p.url || p.id}`);
      const existingCount = await prisma.jobPosting.count({
        where: { sourceUrl: { in: urls } },
      });
      if (existingCount === urls.length) break;
    }

    if (page < MAX_PAGES) await new Promise((r) => setTimeout(r, 600));
  }

  return jobs;
}
