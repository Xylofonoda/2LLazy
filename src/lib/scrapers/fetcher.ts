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
 * Fetches a URL via Jina AI Reader (https://r.jina.ai/).
 * Returns Markdown content including embedded links.
 * Works on JS-heavy pages since Jina renders them server-side.
 */
export async function jinaFetch(url: string): Promise<string> {
  const jinaUrl = `https://r.jina.ai/${url}`;
  const res = await fetch(jinaUrl, {
    headers: {
      Accept: "text/plain",
      "X-No-Cache": "true",
    },
  });
  if (!res.ok) throw new Error(`jinaFetch ${url} → ${res.status}`);
  return res.text();
}

/**
 * Extracts all markdown-style links from Jina markdown output.
 */
export function extractLinksFromMarkdown(
  markdown: string,
): Array<{ text: string; url: string }> {
  const links: Array<{ text: string; url: string }> = [];
  const re = /\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown)) !== null) {
    links.push({ text: m[1].trim(), url: m[2].trim() });
  }
  return links;
}

/**
 * Smart page fetcher: tries raw HTTP + Cheerio first.
 * Falls back to Jina AI Reader when the extracted text is < 300 chars
 * (indicating a JS-heavy page that didn't render useful content).
 */
export async function fetchPage(
  url: string,
): Promise<{ text: string; links: Array<{ text: string; url: string }> }> {
  try {
    const result = await rawFetch(url);
    if (result.text.length >= 300) return result;
  } catch {
    // fall through to Jina
  }
  // JS-heavy or failed — use Jina AI Reader
  const markdown = await jinaFetch(url);
  return {
    text: markdown,
    links: extractLinksFromMarkdown(markdown),
  };
}
