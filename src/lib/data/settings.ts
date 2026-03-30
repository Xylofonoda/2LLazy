import { prisma } from "@/lib/prisma";
import { unstable_cache } from "next/cache";
import { checkOllamaHealth } from "@/lib/ollama";
import { SiteName } from "@prisma/client";
import type { SiteCredStatus, UploadedFile, UserProfile } from "@/types";

const SITES: SiteName[] = ["LINKEDIN"];

const getCachedOllamaHealth = unstable_cache(checkOllamaHealth, ["ollama-health"], { revalidate: 30 });

export async function getSettingsData(): Promise<{
  credentials: SiteCredStatus[];
  profile: UserProfile;
  uploadedFiles: UploadedFile[];
  ollamaHealth: { ok: boolean; missing: string[] };
  hasOpenAI: boolean;
}> {
  const [creds, dbProfile, ollamaHealth, dbFiles] = await Promise.all([
    prisma.siteCredential.findMany(),
    prisma.userProfile.findFirst(),
    getCachedOllamaHealth(),
    prisma.cvDocument.findMany({ orderBy: { uploadedAt: "desc" }, select: { id: true, originalName: true, size: true, uploadedAt: true } }),
  ]);

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

  return { credentials, profile, uploadedFiles, ollamaHealth, hasOpenAI: Boolean(process.env.OPENAI_API_KEY?.trim()) };
}
