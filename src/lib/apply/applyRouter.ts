import { JobPosting } from "@prisma/client";
import { getBrowser } from "@/lib/browser";
import { getAuthenticatedPage } from "@/lib/auth/sessionManager";
import { prisma } from "@/lib/prisma";
import { applyGeneric } from "./applyGeneric";
import { applyLinkedIn } from "./applyLinkedIn";

export async function applyToJobSite(
  job: JobPosting,
  applicationId: string,
  coverLetterId?: string | null
): Promise<void> {
  let coverLetterText: string | undefined;

  if (coverLetterId) {
    const cl = await prisma.coverLetter.findUnique({ where: { id: coverLetterId } });
    coverLetterText = cl?.content;
  }

  const browser = await getBrowser();

  let success = false;
  let errorMessage: string | undefined;

  try {
    switch (job.source) {
      case "LINKEDIN": {
        const page = await getAuthenticatedPage("LINKEDIN");
        try {
          success = await applyLinkedIn(page, job.sourceUrl, coverLetterText);
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
          success = await applyGeneric(page, job.sourceUrl, coverLetterText);
        } finally {
          await context.close();
        }
        break;
      }
    }
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : String(err);
  }

  await prisma.application.update({
    where: { id: applicationId },
    data: {
      status: success ? "APPLIED" : "FAILED",
      appliedAt: success ? new Date() : null,
      errorMessage: errorMessage ?? (!success ? "Could not detect or complete application form" : null),
    },
  });
}
