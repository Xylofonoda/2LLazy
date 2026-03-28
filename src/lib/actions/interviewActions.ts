"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { ScheduleInterviewForm } from "@/types";

export async function scheduleInterview(
  form: ScheduleInterviewForm,
): Promise<void> {
  await prisma.application.update({
    where: { id: form.applicationId },
    data: { status: "INTERVIEW" },
  });

  await prisma.interview.upsert({
    where: { applicationId: form.applicationId },
    create: {
      applicationId: form.applicationId,
      scheduledAt: new Date(form.scheduledAt),
      durationMinutes: form.durationMinutes,
      timezone: "UTC",
      notes: form.notes || null,
    },
    update: {
      scheduledAt: new Date(form.scheduledAt),
      durationMinutes: form.durationMinutes,
      notes: form.notes || null,
    },
  });

  revalidatePath("/interviews");
  revalidatePath("/dashboard");
}
