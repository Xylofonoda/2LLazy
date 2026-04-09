import * as cheerio from "cheerio";
// undici is Node.js's built-in fetch engine — lets us control TCP connect timeout
import { Agent } from "undici";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// Custom agent with 30s TCP connect timeout (undici default is 10s)
const agent = new Agent({ connect: { timeout: 30_000 } });

async function fetchWithRetry(url: string, retries = 3, delayMs = 1500): Promise<Response> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "cs,en-US,en;q=0.9",
          "Cache-Control": "no-cache",
        },
        redirect: "follow",
        // @ts-expect-error undici dispatcher not in fetch type definitions
        dispatcher: agent,
      });
      if (res.ok) return res;
      if (res.status === 429 && attempt < retries) {
        await new Promise((r) => setTimeout(r, delayMs * attempt * 2));
        continue;
      }
      throw new Error(`HTTP ${res.status} for ${url}`);
    } catch (err) {
      const isLast = attempt === retries;
      if (isLast) {
        // Ensure we always throw a proper Error with a message
        if (err instanceof Error) throw err;
        throw new Error(`Fetch failed for ${url}: ${String(err)}`);
      }
      await new Promise((r) => setTimeout(r, delayMs * attempt));
    }
  }
  throw new Error(`fetchPage: all retries exhausted for ${url}`);
}

/**
 * Fetches a URL with a plain HTTP GET (no JavaScript execution).
 * Retries up to 3 times with 30s timeout. Parses HTML with Cheerio.
 */
export async function rawFetch(
  url: string,
): Promise<{ text: string; links: Array<{ text: string; url: string }> }> {
  const res = await fetchWithRetry(url);
  const html = await res.text();
  const $ = cheerio.load(html);

  $("script, style, nav, footer, header, noscript, svg").remove();
  const text = $("body").text().replace(/\s+/g, " ").trim();

  const base = new URL(url);
  const links: Array<{ text: string; url: string }> = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const linkText = $(el).text().trim();
    try {
      const resolved = new URL(href, base).href;
      if (resolved.startsWith("http")) {
        links.push({ text: linkText, url: resolved });
      }
    } catch {
      // ignore unparseable hrefs
    }
  });

  return { text, links };
}

/**
 * Fetch a page. For JS-rendered sites that return bare HTML shells,
 * callers must handle empty link results themselves.
 */
export async function fetchPage(
  url: string,
): Promise<{ text: string; links: Array<{ text: string; url: string }> }> {
  return rawFetch(url);
}

