import { Page, BrowserContext } from "playwright";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import { getBrowser } from "@/lib/browser";

type SiteName = "LINKEDIN" | "INDEED";

interface LoginConfig {
  loginUrl: string;
  usernameSelector: string;
  passwordSelector: string;
  submitSelector: string;
  successIndicator: string; // selector that only appears when logged in
}

const LOGIN_CONFIGS: Record<SiteName, LoginConfig> = {
  // Only sites with credential-based login — StartupJobs/Jobstack use anonymous scraping
  LINKEDIN: {
    loginUrl: "https://www.linkedin.com/login",
    usernameSelector: "#username",
    passwordSelector: "#password",
    submitSelector: '[type="submit"]',
    // After login LinkedIn redirects to /feed — just wait for URL to leave /login
    successIndicator: ".global-nav, .scaffold-layout, #voyager-feed",
  },
  INDEED: {
    loginUrl: "https://secure.indeed.com/auth?hl=en&co=US",
    usernameSelector: "#ifl-InputFormField-3",
    passwordSelector: "#ifl-InputFormField-7",
    submitSelector: '[data-testid="signin-button"]',
    successIndicator: "#indeed-ia",
  },
};

/**
 * Inject cached session cookies into a browser context.
 * Returns true if cookies were found and injected.
 */
export async function injectSession(
  site: SiteName,
  context: BrowserContext
): Promise<boolean> {
  const cred = await prisma.siteCredential.findUnique({ where: { site } });
  if (!cred?.cookieJson) return false;

  try {
    const cookies = JSON.parse(decrypt(cred.cookieJson));
    await context.addCookies(cookies);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if the current page looks like a login/auth redirect page.
 */
export function isLoginPage(url: string): boolean {
  return (
    url.includes("/login") ||
    url.includes("/signin") ||
    url.includes("/auth") ||
    url.includes("/challenge")
  );
}

/**
 * Login to a site using stored credentials and cache the resulting cookies.
 * Returns true on success.
 */
export async function loginAndCacheSession(
  site: SiteName,
  page: Page
): Promise<boolean> {
  const cred = await prisma.siteCredential.findUnique({ where: { site } });
  if (!cred) {
    console.warn(`[sessionManager] No credentials stored for ${site}`);
    return false;
  }

  const config = LOGIN_CONFIGS[site];
  let password: string;
  try {
    password = decrypt(cred.encryptedPassword);
  } catch {
    console.error(`[sessionManager] Failed to decrypt password for ${site}`);
    return false;
  }

  try {
    await page.goto(config.loginUrl, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(config.usernameSelector, { timeout: 10000 });

    await page.fill(config.usernameSelector, cred.username);
    await randomDelay(500, 1200);
    await page.fill(config.passwordSelector, password);
    await randomDelay(400, 900);
    await page.click(config.submitSelector);

    // Wait for navigation away from the login page (up to 20s)
    await page.waitForURL(
      (url) => !url.href.includes("/login") && !url.href.includes("/checkpoint"),
      { timeout: 20000 }
    ).catch(async () => {
      // Fallback: try waiting for the success indicator element
      await page.waitForSelector(config.successIndicator, { timeout: 10000 });
    });

    // Small delay to let the session cookies settle
    await randomDelay(800, 1500);

    // Cache cookies back to DB
    const cookies = await page.context().cookies();
    const { encrypt } = await import("@/lib/crypto");
    await prisma.siteCredential.update({
      where: { site },
      data: { cookieJson: encrypt(JSON.stringify(cookies)) },
    });

    return true;
  } catch (err) {
    console.error(`[sessionManager] Login failed for ${site}:`, err);
    return false;
  }
}

/**
 * Ensures a page is authenticated for a given site.
 * 1. Tries cookie injection
 * 2. If session is expired, triggers fresh login
 * Returns false if no credentials are stored.
 */
export async function ensureAuthenticated(
  site: SiteName,
  page: Page
): Promise<boolean> {
  const cred = await prisma.siteCredential.findUnique({ where: { site } });
  if (!cred) return false;

  const injected = await injectSession(site, page.context());
  if (!injected) {
    return loginAndCacheSession(site, page);
  }

  // Navigate to the site home to verify session is still valid
  const config = LOGIN_CONFIGS[site];
  const homeUrl = new URL(config.loginUrl).origin;
  await page.goto(homeUrl, { waitUntil: "domcontentloaded" });

  if (isLoginPage(page.url())) {
    // Session expired — re-login
    return loginAndCacheSession(site, page);
  }

  return true;
}

/**
 * Open a fresh authenticated page for a given site.
 */
export async function getAuthenticatedPage(site: SiteName): Promise<Page> {
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();
  await ensureAuthenticated(site, page);
  return page;
}

export function randomDelay(minMs: number, maxMs: number): Promise<void> {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((resolve) => setTimeout(resolve, ms));
}
