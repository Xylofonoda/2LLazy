/**
 * applyRouter
 *
 * Routes an auto-apply request to the correct site handler based on JobSource.
 * Unsupported sources return MANUAL_REQUIRED immediately.
 *
 * To add support for a new board: implement an `applyXxx()` function in
 * its own file (following the pattern in applyStartupjobs.ts) and add a
 * case here.
 */
import { JobSource } from "@prisma/client";
import { applyStartupjobs, type ApplyResult } from "./applyStartupjobs";
import type { ApplicantProfile } from "./fillPlan";

export async function applyRouter(
  source: JobSource,
  jobUrl: string,
  profile: ApplicantProfile,
  cvBuffer?: Buffer,
): Promise<ApplyResult> {
  switch (source) {
    case JobSource.STARTUPJOBS:
      return applyStartupjobs(jobUrl, profile, cvBuffer);

    default:
      return {
        status: "MANUAL_REQUIRED",
        errorMessage: `Auto-apply is not yet supported for ${source}. Use manual application.`,
      };
  }
}
