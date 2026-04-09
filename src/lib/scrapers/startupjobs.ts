import { ScrapedJob } from "./types";
import { extractRelevantJobsFromPage } from "@/lib/ai";
import { Agent } from "undici";

const BASE = "https://www.startupjobs.cz";

interface ApiOffer {
  id: number;
  name: string;
  description: string;
  url: string;
  company: string;
  locations: string;
  seniorities: string[];
  salary: { min?: number; max?: number; measure?: string; currency?: string } | null;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function formatSalary(salary: ApiOffer["salary"]): string | undefined {
  if (!salary) return undefined;
  const currency = salary.currency ?? "CZK";
  const period = salary.measure === "monthly" ? "/mo" : salary.measure === "yearly" ? "/yr" : "";
  if (salary.min && salary.max) return `${salary.min.toLocaleString()} – ${salary.max.toLocaleString()} ${currency}${period}`;
  if (salary.min) return `From ${salary.min.toLocaleString()} ${currency}${period}`;
  if (salary.max) return `Up to ${salary.max.toLocaleString()} ${currency}${period}`;
  return undefined;
}

const HEADERS = {
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "cs,en;q=0.9",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Referer: "https://www.startupjobs.cz/nabidky",
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-origin",
};

const agent = new Agent({ connect: { timeout: 30_000 } });

async function fetchWithRetry(url: string, retries = 3, delayMs = 1500): Promise<Response> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: HEADERS,
        // @ts-expect-error undici dispatcher not in fetch type definitions
        dispatcher: agent,
      });
      if (res.ok) return res;
      const wait = res.status === 429 ? delayMs * attempt * 2 : delayMs * attempt;
      if (attempt < retries) await new Promise((r) => setTimeout(r, wait));
    } catch (err) {
      if (attempt === retries) {
        if (err instanceof Error) throw err;
        throw new Error(`StartupJobs fetch failed: ${String(err)}`);
      }
      await new Promise((r) => setTimeout(r, delayMs * attempt));
    }
  }
  throw new Error(`StartupJobs: all ${retries} fetch attempts failed for ${url}`);
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
  const MAX_PAGES = deepSearch ? 5 : 2;
  const perPage = deepSearch ? 25 : 20;
  const jobs: ScrapedJob[] = [];

  for (let pageNum = 1; pageNum <= MAX_PAGES; pageNum++) {
    const params = new URLSearchParams({ search: query, limit: String(perPage) });
    if (seniority) params.set("seniority", seniority);
    if (pageNum > 1) params.set("page", String(pageNum));

    const apiUrl = `${BASE}/api/offers?${params.toString()}`;
    const res = await fetchWithRetry(apiUrl);

    const data = await res.json() as { resultSet?: ApiOffer[] };
    const resultSet = data.resultSet ?? [];
    if (resultSet.length === 0) break;

    // GPT reads the titles like a human and picks only the relevant ones
    const titleLinks = resultSet.map((i) => ({ text: i.name ?? "", url: `${BASE}${i.url}` }));
    const relevant = await extractRelevantJobsFromPage(query, skillLevel, "", titleLinks);
    const relevantUrls = new Set(relevant.map((r) => r.url));

    for (const item of resultSet) {
      const sourceUrl = `${BASE}${item.url}`;
      if (!relevantUrls.has(sourceUrl)) continue;
      jobs.push({
        title: item.name ?? "",
        company: item.company ?? "",
        location: item.locations || "Czech Republic",
        description: stripHtml(item.description ?? "").slice(0, 4000),
        sourceUrl,
        source: "STARTUPJOBS" as const,
        salary: formatSalary(item.salary),
      });
    }

    if (deepSearch) {
      const { prisma } = await import("@/lib/prisma");
      const urls = resultSet.map((i) => `${BASE}${i.url}`);
      const existingCount = await prisma.jobPosting.count({
        where: { sourceUrl: { in: urls } },
      });
      if (existingCount === urls.length) break;
    }

    // Small polite delay between pages to avoid rate limiting
    if (pageNum < MAX_PAGES) await new Promise((r) => setTimeout(r, 800));
  }

  return jobs;
}
