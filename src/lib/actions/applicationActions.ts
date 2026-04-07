"use server";

import { revalidatePath, updateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { APPLICATIONS_TAG } from "@/lib/data/applications";

const StatusSchema = z.enum(["PENDING", "APPLIED", "REJECTED", "INTERVIEW", "FAILED"]);

export async function updateApplicationStatus(
  id: string,
  status: string,
): Promise<void> {
  const validated = StatusSchema.parse(status);
  await prisma.application.update({
    where: { id },
    data: { status: validated },
  });
  updateTag(APPLICATIONS_TAG);
  revalidatePath("/dashboard");
}

export async function getCoverLettersForJob(jobId: string) {
  return prisma.coverLetter.findMany({
    where: { jobId },
    select: { id: true, content: true, generatedByAI: true },
    orderBy: { id: "desc" },
  });
}

