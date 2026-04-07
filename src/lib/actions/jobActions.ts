"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function toggleFavourite(jobId: string): Promise<void> {
  const job = await prisma.jobPosting.findUniqueOrThrow({ where: { id: jobId } });
  await prisma.jobPosting.update({
    where: { id: jobId },
    data: { favourited: !job.favourited },
  });
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

  revalidatePath("/dashboard");
  revalidatePath("/");
}
