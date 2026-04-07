import { prisma } from "@/lib/prisma";
import { SiteName } from "@prisma/client";
import type { SiteCredStatus, UploadedFile, UserProfile } from "@/types";

const SITES: SiteName[] = ["LINKEDIN"];

export async function getSettingsData(): Promise<{
  credentials: SiteCredStatus[];
  profile: UserProfile;
  uploadedFiles: UploadedFile[];
  aiHealth: { ok: boolean; missing: string[] };
  hasOpenAI: boolean;
}> {
  const [creds, dbProfile, dbFiles] = await Promise.all([
    prisma.siteCredential.findMany(),
    prisma.userProfile.findFirst(),
    prisma.cvDocument.findMany({ orderBy: { uploadedAt: "desc" }, select: { id: true, originalName: true, size: true, uploadedAt: true } }),
  ]);

  const hasOpenAI = Boolean(process.env.OPENAI_API_KEY?.trim());

  const credentials: SiteCredStatus[] = SITES.map((site) => {
    const found = creds.find((c) => c.site === site);
    return { site, configured: !!found, username: found?.username ?? null };
  });

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

  return { credentials, profile, uploadedFiles, aiHealth, hasOpenAI };
}
