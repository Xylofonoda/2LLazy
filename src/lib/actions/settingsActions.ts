"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import path from "path";
import { randomUUID } from "crypto";
import { settingsTag } from "@/lib/data/settings";
import { requireUserId } from "@/lib/auth/sessionManager";

const ALLOWED_EXTENSIONS = new Set([".pdf", ".docx", ".doc", ".txt"]);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const MAGIC_SIGNATURES: Array<{ bytes: number[] }> = [
  { bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { bytes: [0x50, 0x4b, 0x03, 0x04] }, // PK (DOCX/ZIP)
  { bytes: [0xd0, 0xcf, 0x11, 0xe0] }, // DOC (OLE2)
];

function hasMagicBytes(buf: Buffer): boolean {
  const isPrintable = Array.from(buf.subarray(0, 512)).every(
    (b) => b === 0x09 || b === 0x0a || b === 0x0d || (b >= 0x20 && b <= 0x7e),
  );
  if (isPrintable) return true;
  return MAGIC_SIGNATURES.some(({ bytes }) =>
    bytes.every((b, i) => buf[i] === b),
  );
}

export async function uploadCvAction(
  _prevState: { error?: string; filename?: string } | null,
  formData: FormData,
): Promise<{ error?: string; filename?: string }> {
  const userId = await requireUserId();
  const file = formData.get("file") as File | null;
  if (!file || !file.name) return { error: "No file provided" };
  if (file.size > MAX_FILE_SIZE) return { error: "File too large (max 10 MB)" };

  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext))
    return { error: "Only PDF, DOCX, DOC, and TXT files are allowed" };

  const arrayBuffer = await file.arrayBuffer();
  const buf = Buffer.from(arrayBuffer);
  if (!hasMagicBytes(buf))
    return { error: "File content does not match its declared type" };

  const safeName = `${randomUUID()}-${path.basename(file.name).replace(/[^a-zA-Z0-9._-]/g, "_")}`;

  await prisma.cvDocument.create({
    data: { userId, originalName: safeName, data: buf, size: buf.length },
  });

  revalidateTag(settingsTag(userId), "default");
  revalidatePath("/settings");
  return { filename: safeName };
}

export async function deleteUploadedFileAction(id: string): Promise<{ error?: string }> {
  const userId = await requireUserId();
  try {
    await prisma.cvDocument.delete({ where: { id, userId } });
  } catch {
    return { error: "File not found or could not be deleted." };
  }
  revalidateTag(settingsTag(userId), "default");
  revalidatePath("/settings");
  return {};
}

export async function saveUserProfile(profile: {
  name: string;
  email: string;
  phone?: string;
  linkedInUrl?: string;
  githubUrl?: string;
  coverLetterLanguage?: string;
}): Promise<void> {
  const userId = await requireUserId();
  await prisma.userProfile.upsert({
    where: { userId },
    update: profile,
    create: { userId, ...profile },
  });
  revalidateTag(settingsTag(userId), "default");
  revalidatePath("/settings");
}

export async function toggleGoogleCalendarSync(enabled: boolean): Promise<void> {
  const userId = await requireUserId();
  await prisma.userProfile.upsert({
    where: { userId },
    update: { googleCalendarSync: enabled },
    create: {
      userId,
      name: "",
      email: "",
      googleCalendarSync: enabled,
    },
  });
  revalidateTag(settingsTag(userId), "default");
  revalidatePath("/settings");
}

/**
 * Returns true if the user's stored Google OAuth token includes the
 * calendar.events scope (i.e. they have already granted it via incremental auth).
 */
export async function checkCalendarAccess(): Promise<boolean> {
  const userId = await requireUserId();
  const account = await prisma.account.findFirst({
    where: { userId, provider: "google" },
    select: { scope: true },
  });
  return (account?.scope ?? "").includes("calendar");
}

