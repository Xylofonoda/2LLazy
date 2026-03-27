import { Page } from "playwright";
import { randomDelay } from "@/lib/auth/sessionManager";
import { applyGeneric } from "./applyGeneric";
import path from "path";
import fs from "fs";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

function findCvPath(): string | null {
  if (!fs.existsSync(UPLOADS_DIR)) return null;
  const files = fs.readdirSync(UPLOADS_DIR).filter((f) =>
    /cv|resume/i.test(f) && /\.(pdf|docx|doc)$/i.test(f)
  );
  return files[0] ? path.join(UPLOADS_DIR, files[0]) : null;
}

/**
 * LinkedIn Easy Apply — handles multi-step modal.
 */
export async function applyLinkedIn(
  page: Page,
  jobUrl: string,
  coverLetterText?: string
): Promise<boolean> {
  await page.goto(jobUrl, { waitUntil: "domcontentloaded" });
  await randomDelay(1500, 3000);

  // Click "Easy Apply" button
  const easyApplyBtn = await page
    .$('button.jobs-apply-button:has-text("Easy Apply")')
    .catch(() => null);

  if (!easyApplyBtn) {
    // Fall back to external apply link
    const applyBtn = await page.$('a.jobs-apply-button');
    if (applyBtn) {
      await applyBtn.click();
      await page.waitForLoadState("networkidle").catch(() => undefined);
      return applyGeneric(page, jobUrl, coverLetterText);
    }
    return false;
  }

  await easyApplyBtn.click();
  await randomDelay(1000, 2000);

  // Multi-step form — keep clicking Next until we reach Submit
  for (let step = 0; step < 10; step++) {
    // Fill generic fields on current step
    await applyGeneric(page, jobUrl, coverLetterText).catch(() => undefined);

    // Upload CV if file input appears
    const fileInput = await page.$('input[type="file"]').catch(() => null);
    if (fileInput) {
      const cvPath = findCvPath();
      if (cvPath) await fileInput.setInputFiles(cvPath).catch(() => undefined);
      await randomDelay(500, 1000);
    }

    // Check for cover letter textarea
    if (coverLetterText) {
      const cl = await page
        .$('textarea[id*="cover"], textarea[aria-label*="cover" i]')
        .catch(() => null);
      if (cl) await cl.fill(coverLetterText).catch(() => undefined);
    }

    await randomDelay(700, 1500);

    // Try Submit first
    const submitBtn = await page
      .$('button[aria-label="Submit application"]')
      .catch(() => null);
    if (submitBtn) {
      await submitBtn.click();
      await randomDelay(1500, 3000);
      return true;
    }

    // Try Review
    const reviewBtn = await page
      .$('button[aria-label="Review your application"]')
      .catch(() => null);
    if (reviewBtn) {
      await reviewBtn.click();
      await randomDelay(800, 1500);
      continue;
    }

    // Try Next
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
