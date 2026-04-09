"use server";

import { revalidatePath, updateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { CalendarEventForm, ScheduleInterviewForm } from "@/types";
import { INTERVIEWS_TAG } from "@/lib/data/interviews";
import { APPLICATIONS_TAG } from "@/lib/data/applications";

export async function scheduleInterview(
  form: ScheduleInterviewForm,
): Promise<void> {
  await prisma.$transaction([
    prisma.application.update({
      where: { id: form.applicationId },
      data: { status: "INTERVIEW" },
    }),
    prisma.interview.upsert({
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
    }),
  ]);

  updateTag(INTERVIEWS_TAG);
  updateTag(APPLICATIONS_TAG);
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
  updateTag(INTERVIEWS_TAG);
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
  updateTag(INTERVIEWS_TAG);
  revalidatePath("/interviews");
}

export async function deleteCalendarEvent(id: string): Promise<void> {
  await prisma.calendarEvent.delete({ where: { id } });
  updateTag(INTERVIEWS_TAG);
  revalidatePath("/interviews");
}

