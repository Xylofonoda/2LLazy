import { Page } from "playwright";
import { randomDelay } from "@/lib/auth/sessionManager";
import { applyGeneric } from "./applyGeneric";

/**
 * Indeed Apply — handles both "Indeed Apply" button (hosted form)
 * and external redirects.
 */
export async function applyIndeed(
  page: Page,
  jobUrl: string,
  coverLetterText?: string
): Promise<boolean> {
  await page.goto(jobUrl, { waitUntil: "domcontentloaded" });
  await randomDelay(1500, 2500);

  const applyBtn = await page
    .$('#indeedApplyButton, [data-testid="indeedApplyButton"], button:has-text("Apply on company site")')
    .catch(() => null);

  if (!applyBtn) return false;

  await applyBtn.click();
  await randomDelay(2000, 4000);

  // If redirected to external site, use generic filler
  const currentUrl = page.url();
  if (!currentUrl.includes("indeed.com")) {
    return applyGeneric(page, currentUrl, coverLetterText);
  }

  // Indeed hosted apply flow — up to 5 steps
  for (let step = 0; step < 5; step++) {
    await applyGeneric(page, currentUrl, coverLetterText).catch(() => undefined);

    await randomDelay(600, 1200);

    const continueBtn = await page
      .$('[data-testid="IndeedApplyButton"], button:has-text("Continue"), button:has-text("Next")')
      .catch(() => null);

    const submitBtn = await page
      .$('button:has-text("Submit"), button:has-text("Send Application")')
      .catch(() => null);

    if (submitBtn) {
      await submitBtn.click();
      return true;
    }

    if (continueBtn) {
      await continueBtn.click();
      await randomDelay(1000, 2000);
    } else {
      break;
    }
  }

  return false;
}
