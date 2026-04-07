import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { UploadedFile, UserProfile } from "@/types";

export const SETTINGS_TAG = "settings";

async function _getSettingsData(): Promise<{
  profile: UserProfile;
  uploadedFiles: UploadedFile[];
  aiHealth: { ok: boolean; missing: string[] };
  hasOpenAI: boolean;
}> {
  const [dbProfile, dbFiles] = await Promise.all([
    prisma.userProfile.findFirst(),
    prisma.cvDocument.findMany({ orderBy: { uploadedAt: "desc" }, select: { id: true, originalName: true, size: true, uploadedAt: true } }),
  ]);

  const hasOpenAI = Boolean(process.env.OPENAI_API_KEY?.trim());

  const profile: UserProfile = {
    name: dbProfile?.name ?? "",
    email: dbProfile?.email ?? "",
    phone: dbProfile?.phone ?? "",
    linkedInUrl: dbProfile?.linkedInUrl ?? "",
    githubUrl: dbProfile?.githubUrl ?? "",
    coverLetterLanguage: dbProfile?.coverLetterLanguage ?? "English",
  };

  const uploadedFiles: UploadedFile[] = dbFiles.map((f) => ({
    id: f.id,
    filename: f.originalName,
    size: f.size,
    uploadedAt: f.uploadedAt.toISOString(),
  }));

  const aiHealth = { ok: hasOpenAI, missing: hasOpenAI ? [] : ["OPENAI_API_KEY"] };

  return { profile, uploadedFiles, aiHealth, hasOpenAI };
}

export const getSettingsData = unstable_cache(_getSettingsData, ["get-settings"], {
  revalidate: 300,
  tags: [SETTINGS_TAG],
});
