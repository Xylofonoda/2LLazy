import TurndownService from "turndown";
import { getBrowser } from "@/lib/browser";
import type { PageLink } from "../types";

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
});

// Strip raw image/link noise that bloats token count
turndown.addRule("removeImages", {
  filter: "img",
  replacement: () => "",
});

export interface PageData {
  /** Cleaned Markdown representation of the page body. */
  markdown: string;
  /** All visible anchor links extracted before cleanup. */
  links: PageLink[];
}

/**
 * Navigate to `url` with Playwright, strip boilerplate DOM, and return:
 *  - `markdown`  – Turndown-converted body (token-efficient for LLMs)
 *  - `links`     – All `<a>` tags with innerText + resolved href
 *
 * A fresh browser context is used per call so sessions don't leak.
 */
export async function navigateAndExtract(url: string): Promise<PageData> {
  const browser = await getBrowser();

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    locale: "en-US",
    extraHTTPHeaders: { "Accept-Language": "en-US,en;q=0.9" },
  });

  const page = await context.newPage();

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });

    // Give JS-heavy pages a moment to hydrate
    await page.waitForTimeout(2_000);

    // ─── Extract all links BEFORE cleanup (cleanup removes some anchors) ────
    const links: PageLink[] = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("a[href]"))
        .map((a) => ({
          text: ((a as HTMLAnchorElement).innerText ?? "").trim().slice(0, 200),
          href: (a as HTMLAnchorElement).href,
        }))
        .filter(
          (l) =>
            l.href &&
            !l.href.startsWith("javascript:") &&
            l.href.startsWith("http"),
        );
    });

    // ─── DOM Cleanup: remove noisy / invisible elements ─────────────────────
    await page.evaluate(() => {
      // Remove structural noise
      const tagsToRemove = [
        "script",
        "style",
        "iframe",
        "noscript",
        "svg",
        "canvas",
        "video",
        "audio",
        "header",
        "footer",
        "nav",
      ];
      tagsToRemove.forEach((tag) =>
        document.querySelectorAll(tag).forEach((el) => el.remove()),
      );

      // Remove elements explicitly hidden via inline style or attribute
      document
        .querySelectorAll('[style*="display:none"], [style*="display: none"]')
        .forEach((el) => el.remove());
      document
        .querySelectorAll(
          '[style*="visibility:hidden"], [style*="visibility: hidden"]',
        )
        .forEach((el) => el.remove());
      document.querySelectorAll("[hidden]").forEach((el) => el.remove());

      // Remove common cookie banners / GDPR overlays by role/aria
      document
        .querySelectorAll(
          '[role="dialog"], [aria-label*="cookie" i], [class*="cookie" i], [id*="cookie" i]',
        )
        .forEach((el) => el.remove());
    });

    const bodyHtml = await page.evaluate(() => document.body?.innerHTML ?? "");
    const markdown = turndown.turndown(bodyHtml);

    return { markdown, links };
  } finally {
    await context.close();
  }
}

/**
 * Chunk an oversized Markdown string to fit within `maxChars`.
 *
 * Strategy: locate the first heading/keyword that signals the job description
 * section and return `maxChars` characters from there. Falls back to the
 * mid-section of the document which typically holds the most content.
 */
export function chunkToRelevantSection(
  content: string,
  maxChars: number,
): string {
  if (content.length <= maxChars) return content;

  const lower = content.toLowerCase();
  const sectionMarkers = [
    "## about the role",
    "## job description",
    "## responsibilities",
    "## requirements",
    "## qualifications",
    "## what you",
    "## the role",
    "about this job",
    "job description",
    "responsibilities",
    "requirements",
    "qualifications",
  ];

  for (const marker of sectionMarkers) {
    const idx = lower.indexOf(marker);
    if (idx !== -1) {
      // Include a small preamble so the LLM has company/title context
      const start = Math.max(0, idx - 300);
      return content.slice(start, start + maxChars);
    }
  }

  // Fallback: take a window centred at 40 % of the document
  // (intros/boilerplate tend to occupy the first quarter)
  const start = Math.floor(content.length * 0.25);
  return content.slice(start, start + maxChars);
}
