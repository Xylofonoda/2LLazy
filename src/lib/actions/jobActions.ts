"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { applyToJobSite } from "@/lib/apply/applyRouter";

export async function toggleFavourite(jobId: string): Promise<void> {
  const job = await prisma.jobPosting.findUniqueOrThrow({ where: { id: jobId } });
  await prisma.jobPosting.update({
    where: { id: jobId },
    data: { favourited: !job.favourited },
  });
  revalidatePath("/favourites");
  revalidatePath("/");
}

export async function applyToJob(jobId: string): Promise<void> {
  const job = await prisma.jobPosting.findUniqueOrThrow({ where: { id: jobId } });

  const existing = await prisma.application.findFirst({
    where: { jobId, status: { in: ["APPLIED", "PENDING"] } },
  });
  if (existing) return;

  const application = await prisma.application.create({
    data: { jobId, status: "PENDING" },
    include: { job: true, coverLetter: true, interview: true },
  });

  // Fire-and-forget: Playwright automation runs in background
  applyToJobSite(job, application.id, undefined).catch(async (err) => {
    await prisma.application.update({
      where: { id: application.id },
      data: { status: "FAILED", errorMessage: String(err) },
    });
  });

  revalidatePath("/dashboard");
  revalidatePath("/");
}
