import { Page } from "playwright";
import { randomDelay } from "@/lib/auth/sessionManager";
import { applyGeneric } from "./applyGeneric";

/**
 * LinkedIn Easy Apply — handles multi-step modal and external redirects.
 *
 * If the apply button redirects outside linkedin.com (e.g. to the employer's
 * own ATS), `applyGeneric` takes over and uses the AI form filler automatically.
 */
export async function applyLinkedIn(
  page: Page,
  jobUrl: string,
  coverLetterText?: string
): Promise<boolean> {
  await page.goto(jobUrl, { waitUntil: "domcontentloaded" });
  await randomDelay(1500, 3000);

  // Click "Easy Apply" button if present
  const easyApplyBtn = await page
    .$('button.jobs-apply-button:has-text("Easy Apply")')
    .catch(() => null);

  if (!easyApplyBtn) {
    // Fall back to external apply link (e.g. "Apply on company site")
    const applyBtn = await page.$("a.jobs-apply-button");
    if (applyBtn) {
      await applyBtn.click();
      await page.waitForLoadState("networkidle").catch(() => undefined);
      // AI filler handles whatever page we landed on
      return applyGeneric(page, page.url(), coverLetterText);
    }
    return false;
  }

  await easyApplyBtn.click();
  await randomDelay(1000, 2000);

  // If the click redirected us off LinkedIn (external ATS), let the AI handle it
  if (!page.url().includes("linkedin.com")) {
    await page.waitForLoadState("networkidle").catch(() => undefined);
    return applyGeneric(page, page.url(), coverLetterText);
  }

  // LinkedIn Easy Apply modal — loop through multi-step form
  for (let step = 0; step < 10; step++) {
    // AI fills this step's fields; navigation is handled below, not by applyGeneric
    await applyGeneric(page, jobUrl, coverLetterText, { skipSubmit: true }).catch(() => undefined);

    await randomDelay(700, 1500);

    // Submit (final step)
    const submitBtn = await page
      .$('button[aria-label="Submit application"]')
      .catch(() => null);
    if (submitBtn) {
      await submitBtn.click();
      await randomDelay(1500, 3000);
      return true;
    }

    // Review step
    const reviewBtn = await page
      .$('button[aria-label="Review your application"]')
      .catch(() => null);
    if (reviewBtn) {
      await reviewBtn.click();
      await randomDelay(800, 1500);
      continue;
    }

    // Continue to next step
    const nextBtn = await page
      .$('button[aria-label="Continue to next step"]')
      .catch(() => null);
    if (nextBtn) {
      await nextBtn.click();
      await randomDelay(800, 1500);
      continue;
    }

    break;
  }

  return false;
}
