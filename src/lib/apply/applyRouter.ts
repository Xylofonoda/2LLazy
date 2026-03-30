import { JobPosting } from "@prisma/client";
import { getBrowser, getVisibleBrowser } from "@/lib/browser";
import { getAuthenticatedPage } from "@/lib/auth/sessionManager";
import { prisma } from "@/lib/prisma";
import { applyGeneric, FormNotFoundError } from "./applyGeneric";
import { applyLinkedIn } from "./applyLinkedIn";

export type ApplyResult =
  | { status: "APPLIED" }
  | { status: "FAILED"; errorMessage: string }
  /** Form couldn't be detected — a visible browser was opened for manual takeover. */
  | { status: "MANUAL_REQUIRED"; url: string };

export async function applyToJobSite(
  job: JobPosting,
  applicationId: string,
  coverLetterId?: string | null
): Promise<ApplyResult> {
  let coverLetterText: string | undefined;

  if (coverLetterId) {
    const cl = await prisma.coverLetter.findUnique({ where: { id: coverLetterId } });
    coverLetterText = cl?.content;
  }

  const browser = await getBrowser();
  let result: ApplyResult = { status: "FAILED", errorMessage: "Unknown error" };

  try {
    switch (job.source) {
      case "LINKEDIN": {
        const page = await getAuthenticatedPage("LINKEDIN");
        try {
          await applyLinkedIn(page, job.sourceUrl, coverLetterText);
        } finally {
          await page.close();
        }
        break;
      }

      case "STARTUPJOBS":
      case "JOBSTACK": {
        const context = await browser.newContext({
          userAgent:
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        });
        const page = await context.newPage();
        try {
          await page.goto(job.sourceUrl, { waitUntil: "domcontentloaded" });
          await applyGeneric(page, job.sourceUrl, coverLetterText);
        } finally {
          await context.close();
        }
        break;
      }
    }

    result = { status: "APPLIED" };
  } catch (err) {
    if (err instanceof FormNotFoundError) {
      // Open a visible browser so the user can complete the application manually
      try {
        const visibleBrowser = await getVisibleBrowser();
        const ctx = await visibleBrowser.newContext();
        const page = await ctx.newPage();
        // Don't await — the user takes over from here
        page.goto(job.sourceUrl).catch(() => undefined);
      } catch (browserErr) {
        console.warn("[applyRouter] Could not open visible browser:", browserErr);
      }
      result = { status: "MANUAL_REQUIRED", url: job.sourceUrl };
    } else {
      result = {
        status: "FAILED",
        errorMessage: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // Persist result to DB
  await prisma.application.update({
    where: { id: applicationId },
    data: {
      status:
        result.status === "APPLIED"
          ? "APPLIED"
          : result.status === "FAILED"
            ? "FAILED"
            : "PENDING", // MANUAL_REQUIRED → stays PENDING until user submits
      appliedAt: result.status === "APPLIED" ? new Date() : null,
      errorMessage: result.status === "FAILED" ? result.errorMessage : null,
    },
  });

  return result;
}
