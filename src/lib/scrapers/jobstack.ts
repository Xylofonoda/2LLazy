import { getBrowser } from "@/lib/browser";
import { randomDelay } from "@/lib/auth/sessionManager";
import { ScrapedJob } from "./types";
import { dismissCookies } from "./utils";

export async function scrapeJobstack(
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

  const seniorityMap: Record<string, string> = {
    Junior: "junior",
    Mid: "medior",
    Senior: "senior",
    Lead: "lead",
  };
  const seniority = seniorityMap[skillLevel];
  const seniorityParam = seniority ? `&seniority=${seniority}` : "";

  try {
    const q = encodeURIComponent(query);
    const searchUrl = `https://www.jobstack.it/it-jobs?keywords=${q}&isDetail=1${seniorityParam}`;
    await page.goto(searchUrl, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => null);
    await randomDelay(800, 1400);

    await dismissCookies(page);
    await randomDelay(300, 600);

    // Wait for any job link to appear
    await page.waitForSelector('a[href*="/it-job/"]', { timeout: 15000 }).catch(() => null);

    // Scroll to load lazy content
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight));
      await randomDelay(500, 900);
    }

    // Extract seed data (title, company, location, url) from listing cards
    type CardSeed = { url: string; title: string; company: string; location: string };
    const seeds: CardSeed[] = await page.evaluate(() => {
      const results: CardSeed[] = [];
      const anchors = Array.from(document.querySelectorAll('a[href*="/it-job/"]'))
        .filter((a) => /\/it-job\/[^/]+\/\w+/.test((a as HTMLAnchorElement).href));
      const seen = new Set<string>();
      for (const anchor of anchors) {
        const url = (anchor as HTMLAnchorElement).href;
        if (seen.has(url)) continue;
        seen.add(url);
        const card = anchor.closest('[class*="card"], [class*="Card"], [class*="job"], [class*="Job"], article, li') ?? anchor;
        const h = card.querySelector("h1, h2, h3")?.textContent?.trim()
          ?? anchor.textContent?.trim()
          ?? url.split("/it-job/")[1]?.split("/")[0]?.replace(/-/g, " ") ?? "";
        // Company: prefer company-profile link, then class-based selectors
        const co =
          (card.querySelector('a[href*="/company-profile/"]') as HTMLAnchorElement | null)?.textContent?.trim()
          ?? card.querySelector('[class*="company"], [class*="Company"], [class*="employer"]')?.textContent?.trim()
          ?? "";
        const loc = card.querySelector('[class*="location"], [class*="city"], [class*="Location"]')?.textContent?.trim() ?? "Czech Republic";
        results.push({ url, title: h, company: co, location: loc || "Czech Republic" });
        if (results.length >= 20) break;
      }
      return results;
    });

    for (const seed of seeds) {
      try {
        const detailPage = await context.newPage();
        await detailPage.goto(seed.url, { waitUntil: "domcontentloaded" });
        await detailPage.waitForLoadState("networkidle").catch(() => null);
        await randomDelay(600, 1200);
        await dismissCookies(detailPage);

        const extracted = await detailPage.evaluate((s) => {
          // ── 1. Title ────────────────────────────────────────────────────────────
          const h1 = document.querySelector("h1")?.textContent?.trim();
          const docTitle = document.title?.split(/[|\-–]/)[0]?.trim();
          const urlSlug = s.url.split("/it-job/")[1]?.split("/")[0]?.replace(/-/g, " ");
          const title = h1 || s.title || docTitle || urlSlug || "";

          // ── 2. Company — company profile link anchor text ────────────────────────
          const companyLink = (document.querySelector('a[href*="/company-profile/"]') as HTMLAnchorElement | null)
            ?.textContent?.trim();
          const company = companyLink || s.company;

          // ── 3. Location — table row "Místo pracoviště" first ─────────────────────
          const rows = Array.from(document.querySelectorAll("tr"));
          const mistoRow = rows.find((r) => /místo pracoviště/i.test(r.cells[0]?.textContent ?? ""));
          const tableLocation = mistoRow?.cells[1]?.textContent?.trim();
          // Fallback: city text adjacent to the company profile link
          const infoBox = (document.querySelector('a[href*="/company-profile/"]') as HTMLElement | null)
            ?.closest("div, section, aside") as HTMLElement | null;
          const infoLines = (infoBox?.innerText ?? "").split("\n").map((l: string) => l.trim())
            .filter((l: string) => l && l !== company);
          const cityFallback = infoLines[0];
          const location = tableLocation || cityFallback || s.location || "Czech Republic";

          // ── 4. Salary — table row "Mzda" first, then h6 sibling scan ────────────
          const mzdaRow = rows.find((r) => r.cells[0]?.textContent?.trim() === "Mzda");
          const tableSalary = mzdaRow?.cells[1]?.textContent?.trim();
          let h6Salary = "";
          if (!tableSalary) {
            for (const h6 of Array.from(document.querySelectorAll("h6"))) {
              if (!/mzda/i.test(h6.textContent ?? "")) continue;
              let sib = h6.nextElementSibling;
              while (sib) {
                const t = sib.textContent?.trim();
                if (t && /Kč/.test(t)) { h6Salary = t; break; }
                sib = sib.nextElementSibling;
              }
              if (!h6Salary) {
                const pt = (h6.parentElement?.textContent ?? "").replace(h6.textContent ?? "", "").trim();
                if (/Kč/.test(pt)) h6Salary = pt;
              }
              break;
            }
          }
          const salary = tableSalary || h6Salary || undefined;

          // ── 5. Description — "Popis pozice" section content ──────────────────────
          let description = "";
          for (const heading of Array.from(document.querySelectorAll("h2, h3"))) {
            if (!/popis pozice/i.test(heading.textContent ?? "")) continue;
            let node = heading.nextElementSibling;
            const parts: string[] = [];
            while (node) {
              const tag = node.tagName.toLowerCase();
              if (tag === "h2" || tag === "h3") break;
              const t = (node as HTMLElement).innerText?.trim();
              if (t) parts.push(t);
              node = node.nextElementSibling;
            }
            description = parts.join("\n").trim();
            break;
          }
          // Fallback: largest content block
          if (!description || description.length < 100) {
            const candidates = Array.from(document.querySelectorAll("article, main")) as HTMLElement[];
            for (const el of candidates) {
              const t = el.innerText?.trim() ?? "";
              if (t.length > description.length) description = t;
            }
            if (!description) description = (document.body as HTMLElement).innerText ?? "";
          }
          description = description.slice(0, 4000).trim();

          return { title, company, location, description, salary };
        }, seed);

        await detailPage.close();

        if (!extracted.title) continue;

        jobs.push({
          title: extracted.title,
          company: extracted.company,
          location: extracted.location,
          description: extracted.description,
          sourceUrl: seed.url,
          source: "JOBSTACK",
          salary: extracted.salary,
        });
      } catch {
        // skip broken detail pages
      }
    }
  } finally {
    await context.close();
  }

  return jobs;
}
