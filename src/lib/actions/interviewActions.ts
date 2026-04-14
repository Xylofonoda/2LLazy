"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { CalendarEntry, CalendarEventForm, ScheduleInterviewForm } from "@/types";
import { getCalendarEntriesForMonth, interviewTag } from "@/lib/data/interviews";
import { applicationTag } from "@/lib/data/applications";
import { requireUserId } from "@/lib/auth/sessionManager";
import {
  hasCalendarSync,
  createGCalEvent,
  updateGCalEvent,
  deleteGCalEvent,
  buildGCalPayload,
} from "@/lib/googleCalendar";

/** Lightweight server action for client-side month navigation — no full page reload. */
export async function fetchCalendarEntriesAction(
  month: number,
  year: number,
): Promise<CalendarEntry[]> {
  const userId = await requireUserId();
  return getCalendarEntriesForMonth(userId, month, year);
}

export async function scheduleInterview(
  form: ScheduleInterviewForm,
): Promise<void> {
  const userId = await requireUserId();
  const scheduledDate = new Date(form.scheduledAt);

  // Look up existing interview to get its gcal event id (if any)
  const existing = await prisma.interview.findUnique({
    where: { applicationId: form.applicationId },
    select: { googleCalendarEventId: true },
  });

  const [, interview] = await prisma.$transaction([
    prisma.application.update({
      where: { id: form.applicationId, userId },
      data: { status: "INTERVIEW" },
    }),
    prisma.interview.upsert({
      where: { applicationId: form.applicationId },
      create: {
        applicationId: form.applicationId,
        scheduledAt: scheduledDate,
        durationMinutes: form.durationMinutes,
        timezone: "UTC",
        notes: form.notes || null,
      },
      update: {
        scheduledAt: scheduledDate,
        durationMinutes: form.durationMinutes,
        notes: form.notes || null,
      },
    }),
  ]);

  // Google Calendar sync (non-blocking — failure doesn't break the action)
  if (await hasCalendarSync(userId)) {
    const app = await prisma.application.findUnique({
      where: { id: form.applicationId },
      include: { job: { select: { title: true, company: true } } },
    });
    const summary = app
      ? `Interview – ${app.job.title} @ ${app.job.company}`
      : "Job Interview";
    const payload = buildGCalPayload(
      summary,
      scheduledDate,
      form.durationMinutes,
      form.notes || null,
      "UTC"
    );

    const existingGcalId = existing?.googleCalendarEventId ?? null;
    if (existingGcalId) {
      await updateGCalEvent(userId, existingGcalId, payload);
    } else {
      const gcalId = await createGCalEvent(userId, payload);
      if (gcalId) {
        await prisma.interview.update({
          where: { id: interview.id },
          data: { googleCalendarEventId: gcalId },
        });
      }
    }
  }

  revalidateTag(interviewTag(userId), "default");
  revalidateTag(applicationTag(userId), "default");
  revalidatePath("/interviews");
  revalidatePath("/dashboard");
}

export async function createCalendarEvent(form: CalendarEventForm): Promise<void> {
  const userId = await requireUserId();
  if (!form.title.trim()) throw new Error("Event title is required.");
  const scheduledDate = new Date(form.scheduledAt);
  const event = await prisma.calendarEvent.create({
    data: {
      userId,
      title: form.title.trim(),
      scheduledAt: scheduledDate,
      durationMinutes: Math.max(5, form.durationMinutes),
      notes: form.notes.trim() || null,
    },
  });

  if (await hasCalendarSync(userId)) {
    const payload = buildGCalPayload(
      form.title.trim(),
      scheduledDate,
      form.durationMinutes,
      form.notes.trim() || null
    );
    const gcalId = await createGCalEvent(userId, payload);
    if (gcalId) {
      await prisma.calendarEvent.update({
        where: { id: event.id },
        data: { googleCalendarEventId: gcalId },
      });
    }
  }

  revalidateTag(interviewTag(userId), "default");
  revalidatePath("/interviews");
}

export async function updateCalendarEvent(id: string, form: CalendarEventForm): Promise<void> {
  const userId = await requireUserId();
  if (!form.title.trim()) throw new Error("Event title is required.");
  const scheduledDate = new Date(form.scheduledAt);
  const event = await prisma.calendarEvent.update({
    where: { id, userId },
    data: {
      title: form.title.trim(),
      scheduledAt: scheduledDate,
      durationMinutes: Math.max(5, form.durationMinutes),
      notes: form.notes.trim() || null,
    },
  });

  if (event.googleCalendarEventId && await hasCalendarSync(userId)) {
    const payload = buildGCalPayload(
      form.title.trim(),
      scheduledDate,
      form.durationMinutes,
      form.notes.trim() || null
    );
    await updateGCalEvent(userId, event.googleCalendarEventId, payload);
  }

  revalidateTag(interviewTag(userId), "default");
  revalidatePath("/interviews");
}

export async function deleteCalendarEvent(id: string): Promise<void> {
  const userId = await requireUserId();
  const event = await prisma.calendarEvent.findUnique({
    where: { id, userId },
    select: { googleCalendarEventId: true },
  });
  await prisma.calendarEvent.delete({ where: { id, userId } });

  if (event?.googleCalendarEventId && await hasCalendarSync(userId)) {
    await deleteGCalEvent(userId, event.googleCalendarEventId);
  }

  revalidateTag(interviewTag(userId), "default");
  revalidatePath("/interviews");
}


