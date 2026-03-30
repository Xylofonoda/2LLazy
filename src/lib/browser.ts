import { chromium, Browser } from "playwright";

let browserInstance: Browser | null = null;

/**
 * Returns a singleton Playwright Chromium browser.
 * Reconnects automatically if the previous instance has disconnected.
 */
export async function getBrowser(): Promise<Browser> {
  if (browserInstance && browserInstance.isConnected()) {
    return browserInstance;
  }

  browserInstance = await chromium.launch({
    headless: process.env.PLAYWRIGHT_HEADLESS !== "false",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--disable-infobars",
    ],
  });

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

  visibleBrowserInstance = await chromium.launch({
    headless: false,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
    ],
  });

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
