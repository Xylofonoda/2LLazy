import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { JobPostingSchema } from "./types";
import type { AgentState } from "./state";

const navigateAndExtract = async (_url: string) => ({ markdown: "", links: [] as { text: string; href: string }[] });
const chunkToRelevantSection = (content: string, max: number) => content.slice(0, max);

// ─── Cost tiers ──────────────────────────────────────────────────────────────
// Discovery: cheap, only needs to classify links  → gpt-4o-mini
// Extraction: must output structured JSON reliably → gpt-4o-mini (high quality enough)

const discoveryLLM = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0,
});

const extractionLLM = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0,
}).withStructuredOutput(JobPostingSchema);

/** Max job URLs to process in a single graph run (cost/time guard). */
const MAX_JOB_URLS = 10;

/** Max characters sent to the extraction LLM (≈ 3 k tokens for gpt-4o-mini). */
const MAX_CONTENT_CHARS = 12_000;

// ─── Node 1: Scrape the search-results page ──────────────────────────────────

/**
 * Navigates to the initial `searchUrl`, cleans the page, and stores:
 *  - `currentHtml`: Markdown of the page (for LLM context)
 *  - `pageLinks`:   All anchor tags (text + href) for the discovery node
 */
export async function scrapeSearchResultsNode(
  state: AgentState,
): Promise<Partial<AgentState>> {
  const { searchUrl } = state;

  try {
    const { markdown, links } = await navigateAndExtract(searchUrl);

    return {
      currentHtml: markdown,
      pageLinks: links,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[scrapeSearchResults] Failed:", message);
    return {
      errors: [`scrapeSearchResults: ${message}`],
    };
  }
}

// ─── Node 2: Filter links → only job-detail URLs ─────────────────────────────

/**
 * Sends the search-results page links to gpt-4o-mini.
 * The LLM returns only the URLs that represent individual job postings
 * (not search result lists, company homepages, login pages, etc.).
 *
 * Deduplication against `visitedUrls` is applied before and after LLM filtering.
 */
export async function filterJobLinksNode(
  state: AgentState,
): Promise<Partial<AgentState>> {
  const { pageLinks, visitedUrls, currentHtml } = state;

  if (pageLinks.length === 0) {
    return { errors: ["filterJobLinks: no links found on search page"] };
  }

  // Format links as a numbered list so the LLM can reason about them easily
  const linkList = pageLinks
    .filter((l) => !visitedUrls.includes(l.href))
    .slice(0, 80) // cap to avoid huge prompts
    .map((l, i) => `${i + 1}. ${l.text || "(no text)"} — ${l.href}`)
    .join("\n");

  // Brief page context for the LLM (first 1 500 chars is enough for relevance)
  const pageContext = currentHtml.slice(0, 1_500);

  try {
    const response = await discoveryLLM.invoke([
      new SystemMessage(
        `You are a job-board link classifier. Given a numbered list of page links and brief page context, ` +
        `identify which links point to INDIVIDUAL JOB DETAIL pages (not search result lists, ` +
        `company overview pages, login/register pages, or navigation links). ` +
        `Return ONLY a valid JSON array of the qualifying URLs, with no extra text or markdown fencing. ` +
        `Example output: ["https://example.com/jobs/123","https://example.com/jobs/456"]`,
      ),
      new HumanMessage(
        `Page context (first 1500 chars):\n${pageContext}\n\n` +
        `Links:\n${linkList}`,
      ),
    ]);

    const raw =
      typeof response.content === "string" ? response.content.trim() : "";

    // Robustly extract JSON array even if the model adds surrounding text
    const match = raw.match(/\[[\s\S]*\]/);
    if (!match) {
      return {
        errors: ["filterJobLinks: LLM returned no JSON array"],
        urlsToVisit: [],
      };
    }

    const parsed: unknown = JSON.parse(match[0]);
    if (!Array.isArray(parsed)) {
      return { errors: ["filterJobLinks: parsed result is not an array"], urlsToVisit: [] };
    }

    const filtered = (parsed as unknown[])
      .filter((u): u is string => typeof u === "string" && u.startsWith("http"))
      .filter((u) => !visitedUrls.includes(u))
      .slice(0, MAX_JOB_URLS);

    console.log(`[filterJobLinks] Found ${filtered.length} job URLs to visit`);

    return { urlsToVisit: filtered };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[filterJobLinks] Failed:", message);
    return {
      errors: [`filterJobLinks: ${message}`],
      urlsToVisit: [],
    };
  }
}

// ─── Node 3: Scrape & extract one job detail page ────────────────────────────

/**
 * Processes the first URL in `urlsToVisit`:
 *  1. Navigates to the job detail page.
 *  2. Converts HTML → Markdown (Turndown).
 *  3. Chunks oversized content to stay within the LLM context window.
 *  4. Calls gpt-4o-mini with structured output to extract job data.
 *
 * On any failure the URL is still moved to `visitedUrls` and an error is
 * logged — the graph continues to the next URL instead of crashing.
 */
export async function scrapeJobDetailNode(
  state: AgentState,
): Promise<Partial<AgentState>> {
  const { urlsToVisit } = state;

  if (urlsToVisit.length === 0) return {};

  const [currentUrl, ...remainingUrls] = urlsToVisit;

  try {
    const { markdown } = await navigateAndExtract(currentUrl);
    const content = chunkToRelevantSection(markdown, MAX_CONTENT_CHARS);

    console.log(
      `[scrapeJobDetail] Extracting ${currentUrl} (${content.length} chars)`,
    );

    const job = await extractionLLM.invoke([
      new SystemMessage(
        `You are a precise job-posting data extractor. ` +
        `Extract all available structured fields from the following Markdown content of a job detail page. ` +
        `For the 'stack' field, list every technology, language, framework, or tool mentioned. ` +
        `If a field is genuinely not present in the content, omit it rather than guessing.`,
      ),
      new HumanMessage(`Job page content:\n\n${content}`),
    ]);

    return {
      urlsToVisit: remainingUrls,
      visitedUrls: [currentUrl],
      extractedJobs: [job],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[scrapeJobDetail] Failed for ${currentUrl}:`, message);

    return {
      urlsToVisit: remainingUrls,
      visitedUrls: [currentUrl],
      errors: [`scrapeJobDetail(${currentUrl}): ${message}`],
    };
  }
}
