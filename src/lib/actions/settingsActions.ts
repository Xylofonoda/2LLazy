"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";
import { SiteName } from "@prisma/client";

const VALID_SITES: SiteName[] = ["LINKEDIN"];

export async function saveSiteCredentials(
  site: string,
  username: string,
  password: string,
): Promise<void> {
  if (!VALID_SITES.includes(site as SiteName)) {
    throw new Error(`Invalid site: ${site}`);
  }
  const encryptedPassword = encrypt(password);
  await prisma.siteCredential.upsert({
    where: { site: site as SiteName },
    create: { site: site as SiteName, username, encryptedPassword },
    update: { username, encryptedPassword, cookieJson: null },
  });
  revalidatePath("/settings");
}

export async function clearSiteCredentials(site: string): Promise<void> {
  if (!VALID_SITES.includes(site as SiteName)) {
    throw new Error(`Invalid site: ${site}`);
  }
  await prisma.siteCredential.deleteMany({ where: { site: site as SiteName } });
  revalidatePath("/settings");
}

export async function saveUserProfile(profile: {
  name: string;
  email: string;
  phone?: string;
  linkedInUrl?: string;
  githubUrl?: string;
  coverLetterLanguage?: string;
}): Promise<void> {
  const existing = await prisma.userProfile.findFirst();
  if (existing) {
    await prisma.userProfile.update({ where: { id: existing.id }, data: profile });
  } else {
    await prisma.userProfile.create({ data: profile });
  }
  revalidatePath("/settings");
}
