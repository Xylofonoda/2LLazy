import * as cheerio from "cheerio";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

/**
 * Fetches a URL with a plain HTTP GET (no JavaScript execution).
 * Parses the HTML with Cheerio and returns extracted text + links.
 */
export async function rawFetch(
  url: string,
): Promise<{ text: string; links: Array<{ text: string; url: string }> }> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9,cs;q=0.8",
    },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`rawFetch ${url} → ${res.status}`);
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

