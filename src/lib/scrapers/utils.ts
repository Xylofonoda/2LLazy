import type { Page } from "playwright";

/**
 * Runs `fn` over all items in sequential batches of `batchSize`.
 * Items within a batch run concurrently; batches run one after another.
 * Null / rejected results are silently dropped.
 */
export async function batchProcess<T, R>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<R | null>,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const settled = await Promise.allSettled(
      items.slice(i, i + batchSize).map(fn),
    );
    for (const r of settled) {
      if (r.status === "fulfilled" && r.value !== null) results.push(r.value);
    }
  }
  return results;
}

/**
 * Tries to dismiss a cookie/GDPR consent modal.
 * Covers OneTrust, Cookiebot, cc-banner, and Czech text variants.
 * Silently no-ops if no modal is present.
 * All selectors are raced in parallel with a 2s overall deadline so pages
 * without a cookie banner never block more than 2 seconds.
 */
export async function dismissCookies(page: Page): Promise<void> {
  const selectors = [
    "#onetrust-accept-btn-handler",
    "#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll",
    "#CybotCookiebotDialogBodyButtonAccept",
    'button[id*="accept-all"]',
    'button[id*="acceptAll"]',
    'button[class*="accept-all"]',
    'button[class*="acceptAll"]',
    ".cc-btn.cc-allow",
    '[aria-label*="Accept all"]',
    '[aria-label*="accept all"]',
    'button:text("Přijmout vše")',
    'button:text("Přijmout všechny")',
    'button:text("Souhlasím")',
    'button:text("Přijmout")',
    'button:text("Accept all")',
    'button:text("Accept All")',
    'button:text("Allow all")',
    '[id*="cookie"] button',
    '[class*="cookie-banner"] button',
    '[class*="cookieBanner"] button',
    '[class*="consent"] button[class*="primary"]',
  ];

  const deadline = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("timeout")), 2000),
  );

  await Promise.race([
    Promise.any(
      selectors.map(async (sel) => {
        const btn = page.locator(sel).first();
        await btn.waitFor({ state: "visible", timeout: 2000 });
        await btn.click({ timeout: 1500 });
      }),
    ).catch(() => { /* no cookie banner found — that's fine */ }),
    deadline,
  ]).catch(() => { /* overall 2s deadline hit — move on */ });
}
