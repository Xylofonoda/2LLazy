"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { favouriteTag } from "@/lib/data/favourites";
import { applicationTag } from "@/lib/data/applications";
import { requireUserId } from "@/lib/auth/sessionManager";

export async function toggleFavourite(jobId: string): Promise<void> {
  const userId = await requireUserId();
  const existing = await prisma.userFavourite.findUnique({
    where: { userId_jobId: { userId, jobId } },
  });
  if (existing) {
    await prisma.userFavourite.delete({ where: { userId_jobId: { userId, jobId } } });
  } else {
    await prisma.userFavourite.create({ data: { userId, jobId } });
  }
  revalidateTag(favouriteTag(userId), "default");
  revalidatePath("/favourites");
  revalidatePath("/");
}

export async function trackJob(jobId: string): Promise<void> {
  const userId = await requireUserId();
  const existing = await prisma.application.findFirst({
    where: { userId, jobId, status: { in: ["APPLIED", "PENDING"] } },
  });
  if (existing) return;

  await prisma.application.create({
    data: { userId, jobId, status: "PENDING" },
  });

  revalidateTag(applicationTag(userId), "default");
  revalidatePath("/dashboard");
  revalidatePath("/");
}


