"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { CalendarEventForm, ScheduleInterviewForm } from "@/types";

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

export async function createCalendarEvent(form: CalendarEventForm): Promise<void> {
  if (!form.title.trim()) throw new Error("Event title is required.");
  await prisma.calendarEvent.create({
    data: {
      title: form.title.trim(),
      scheduledAt: new Date(form.scheduledAt),
      durationMinutes: Math.max(5, form.durationMinutes),
      notes: form.notes.trim() || null,
    },
  });
  revalidatePath("/interviews");
}

export async function updateCalendarEvent(id: string, form: CalendarEventForm): Promise<void> {
  if (!form.title.trim()) throw new Error("Event title is required.");
  await prisma.calendarEvent.update({
    where: { id },
    data: {
      title: form.title.trim(),
      scheduledAt: new Date(form.scheduledAt),
      durationMinutes: Math.max(5, form.durationMinutes),
      notes: form.notes.trim() || null,
    },
  });
  revalidatePath("/interviews");
}

export async function deleteCalendarEvent(id: string): Promise<void> {
  await prisma.calendarEvent.delete({ where: { id } });
  revalidatePath("/interviews");
}
