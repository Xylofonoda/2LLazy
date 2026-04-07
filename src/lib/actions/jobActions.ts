"use server";

import { revalidatePath, updateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { FAVOURITES_TAG } from "@/lib/data/favourites";
import { APPLICATIONS_TAG } from "@/lib/data/applications";

export async function toggleFavourite(jobId: string): Promise<void> {
  const job = await prisma.jobPosting.findUniqueOrThrow({ where: { id: jobId } });
  await prisma.jobPosting.update({
    where: { id: jobId },
    data: { favourited: !job.favourited },
  });
  updateTag(FAVOURITES_TAG);
  revalidatePath("/favourites");
  revalidatePath("/");
}

export async function trackJob(jobId: string): Promise<void> {
  const existing = await prisma.application.findFirst({
    where: { jobId, status: { in: ["APPLIED", "PENDING"] } },
  });
  if (existing) return;

  await prisma.application.create({
    data: { jobId, status: "PENDING" },
  });

  updateTag(APPLICATIONS_TAG);
  revalidatePath("/dashboard");
  revalidatePath("/");
}
