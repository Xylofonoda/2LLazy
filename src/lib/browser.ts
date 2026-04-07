import { Browser } from "playwright-core";

let browserInstance: Browser | null = null;

async function launchBrowser(headless = true): Promise<Browser> {
  // In production (serverless / Netlify), use @sparticuz/chromium-min with playwright-core.
  // In development, use the local Chromium bundled with the playwright package.
  if (process.env.NODE_ENV === "production" || process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    const { default: chromium } = await import("@sparticuz/chromium-min");
    const { chromium: playwrightChromium } = await import("playwright-core");

    const executablePath =
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ??
      (await chromium.executablePath(
        `https://github.com/Sparticuz/chromium/releases/download/v131.0.0/chromium-v131.0.0-pack.tar`
      ));

    return playwrightChromium.launch({
      args: chromium.args,
      executablePath,
      headless: chromium.headless,
    });
  }

  const { chromium } = await import("playwright-core");
  return chromium.launch({
    headless,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--disable-infobars",
    ],
  });
}

/**
 * Returns a singleton Playwright Chromium browser.
 * Reconnects automatically if the previous instance has disconnected.
 */
export async function getBrowser(): Promise<Browser> {
  if (browserInstance && browserInstance.isConnected()) {
    return browserInstance;
  }

  browserInstance = await launchBrowser(true);

  browserInstance.on("disconnected", () => {
    browserInstance = null;
  });

  return browserInstance;
}

/**
 * Returns a visible (headless=false) browser for manual takeover scenarios.
 * This is a separate instance from the headless scraping singleton.
 * Only useful when the application is running locally.
 */
let visibleBrowserInstance: Browser | null = null;

export async function getVisibleBrowser(): Promise<Browser> {
  if (visibleBrowserInstance && visibleBrowserInstance.isConnected()) {
    return visibleBrowserInstance;
  }

  visibleBrowserInstance = await launchBrowser(false);

  visibleBrowserInstance.on("disconnected", () => {
    visibleBrowserInstance = null;
  });

  return visibleBrowserInstance;
}

/**
 * Close the browser (call on graceful shutdown if needed).
 */
export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}
