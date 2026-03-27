import type { Page } from "playwright";

/**
 * Tries to dismiss a cookie/GDPR consent modal.
 * Covers OneTrust, Cookiebot, cc-banner, and Czech text variants.
 * Silently no-ops if no modal is present.
 */
export async function dismissCookies(page: Page): Promise<void> {
  const selectors = [
    // OneTrust (used by many EU sites)
    "#onetrust-accept-btn-handler",
    // Cookiebot
    "#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll",
    "#CybotCookiebotDialogBodyButtonAccept",
    // Generic accept-all patterns
    'button[id*="accept-all"]',
    'button[id*="acceptAll"]',
    'button[class*="accept-all"]',
    'button[class*="acceptAll"]',
    // cookie-consent libraries
    ".cc-btn.cc-allow",
    '[aria-label*="Accept all"]',
    '[aria-label*="accept all"]',
    // Czech text variants
    'button:text("Přijmout vše")',
    'button:text("Přijmout všechny")',
    'button:text("Souhlasím")',
    'button:text("Přijmout")',
    // English fallbacks
    'button:text("Accept all")',
    'button:text("Accept All")',
    'button:text("Allow all")',
    // Generic cookie banner button (last resort — click first visible button inside banner)
    '[id*="cookie"] button',
    '[class*="cookie-banner"] button',
    '[class*="cookieBanner"] button',
    '[class*="consent"] button[class*="primary"]',
  ];

  for (const sel of selectors) {
    try {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 800 })) {
        await btn.click({ timeout: 1500 });
        return;
      }
    } catch {
      // not found — try next
    }
  }
}
