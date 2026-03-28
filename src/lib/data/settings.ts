import { prisma } from "@/lib/prisma";
import { checkOllamaHealth } from "@/lib/ollama";
import { SiteName } from "@prisma/client";
import fs from "fs";
import path from "path";
import type { SiteCredStatus, UploadedFile, UserProfile } from "@/types";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");
const SITES: SiteName[] = ["LINKEDIN"];

export async function getSettingsData(): Promise<{
  credentials: SiteCredStatus[];
  profile: UserProfile;
  uploadedFiles: UploadedFile[];
  ollamaHealth: { ok: boolean; missing: string[] };
}> {
  const [creds, dbProfile, ollamaHealth] = await Promise.all([
    prisma.siteCredential.findMany(),
    prisma.userProfile.findFirst(),
    checkOllamaHealth(),
  ]);

  const credentials: SiteCredStatus[] = SITES.map((site) => {
    const found = creds.find((c) => c.site === site);
    return { site, configured: !!found, username: found?.username ?? null };
  });

  const uploadedFiles: UploadedFile[] = fs.existsSync(UPLOADS_DIR)
    ? fs.readdirSync(UPLOADS_DIR).map((filename) => {
      const stat = fs.statSync(path.join(UPLOADS_DIR, filename));
      return { filename, size: stat.size, uploadedAt: stat.mtime.toISOString() };
    })
    : [];

  const profile: UserProfile = {
    name: dbProfile?.name ?? "",
    email: dbProfile?.email ?? "",
    phone: dbProfile?.phone ?? "",
    linkedInUrl: dbProfile?.linkedInUrl ?? "",
    githubUrl: dbProfile?.githubUrl ?? "",
    coverLetterLanguage: dbProfile?.coverLetterLanguage ?? "English",
  };

  return { credentials, profile, uploadedFiles, ollamaHealth };
}
