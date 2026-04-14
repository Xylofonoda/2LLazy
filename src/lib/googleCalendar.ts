/**
 * Google Calendar REST API helpers.
 *
 * Uses the OAuth access_token (and refresh_token) stored by NextAuth in the
 * Account table — no googleapis SDK needed.
 */

import { prisma } from "@/lib/prisma";

// ─── Token retrieval + refresh ────────────────────────────────────────────────

interface TokenRow {
  access_token: string | null;
  refresh_token: string | null;
  expires_at: number | null;
}

async function getValidAccessToken(userId: string): Promise<string | null> {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "google" },
    select: { access_token: true, refresh_token: true, expires_at: true },
  });
  if (!account?.access_token) return null;

  // expires_at is stored as seconds-since-epoch by NextAuth
  const nowSeconds = Math.floor(Date.now() / 1000);
  const isExpired = account.expires_at
    ? account.expires_at - 60 < nowSeconds // refresh 60s early
    : false;

  if (!isExpired) return account.access_token;

  // Attempt silent refresh
  if (!account.refresh_token) return null;
  const newToken = await refreshAccessToken(userId, account as TokenRow);
  return newToken;
}

async function refreshAccessToken(
  userId: string,
  account: TokenRow
): Promise<string | null> {
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: "refresh_token",
        refresh_token: account.refresh_token!,
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      access_token: string;
      expires_in: number;
    };
    const expiresAt = Math.floor(Date.now() / 1000) + data.expires_in;
    await prisma.account.updateMany({
      where: { userId, provider: "google" },
      data: { access_token: data.access_token, expires_at: expiresAt },
    });
    return data.access_token;
  } catch {
    return null;
  }
}

// ─── Check whether the user has Google Calendar sync enabled ─────────────────

export async function hasCalendarSync(userId: string): Promise<boolean> {
  const profile = await prisma.userProfile.findUnique({
    where: { userId },
    select: { googleCalendarSync: true },
  });
  return profile?.googleCalendarSync ?? false;
}

// ─── Google Calendar event shape ─────────────────────────────────────────────

interface GCalEventPayload {
  summary: string;
  description?: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

/** Creates a Google Calendar event; returns the gcal event ID or null on failure. */
export async function createGCalEvent(
  userId: string,
  payload: GCalEventPayload
): Promise<string | null> {
  const token = await getValidAccessToken(userId);
  if (!token) return null;

  const res = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );
  if (!res.ok) {
    console.error("[GCal] create failed", await res.text());
    return null;
  }
  const event = (await res.json()) as { id: string };
  return event.id;
}

/** Updates an existing Google Calendar event. No-ops if gcalEventId is null. */
export async function updateGCalEvent(
  userId: string,
  gcalEventId: string,
  payload: GCalEventPayload
): Promise<void> {
  const token = await getValidAccessToken(userId);
  if (!token) return;

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${gcalEventId}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );
  if (!res.ok) {
    console.error("[GCal] update failed", await res.text());
  }
}

/** Deletes a Google Calendar event. Silently ignores 404 (already deleted). */
export async function deleteGCalEvent(
  userId: string,
  gcalEventId: string
): Promise<void> {
  const token = await getValidAccessToken(userId);
  if (!token) return;

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${gcalEventId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    console.error("[GCal] delete failed", await res.text());
  }
}

// ─── Convenience builders ─────────────────────────────────────────────────────

export function buildGCalPayload(
  summary: string,
  scheduledAt: Date,
  durationMinutes: number,
  description?: string | null,
  timezone = "UTC"
): GCalEventPayload {
  const start = scheduledAt.toISOString();
  const end = new Date(
    scheduledAt.getTime() + durationMinutes * 60 * 1000
  ).toISOString();
  return {
    summary,
    ...(description ? { description } : {}),
    start: { dateTime: start, timeZone: timezone },
    end: { dateTime: end, timeZone: timezone },
  };
}
