import { Page } from "playwright";
import { randomDelay } from "@/lib/auth/sessionManager";
import path from "path";
import fs from "fs";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

function findCvPath(): string | null {
  if (!fs.existsSync(UPLOADS_DIR)) return null;
  const files = fs.readdirSync(UPLOADS_DIR).filter((f) =>
    /cv|resume/i.test(f) && /\.(pdf|docx|doc)$/i.test(f)
  );
  return files[0] ? path.join(UPLOADS_DIR, files[0]) : null;
}

/**
 * Generic form filler: attempts to fill common job application fields
 * by detecting them via aria-labels, placeholder text, and common selectors.
 * Returns true if the form was submitted, false if we couldn't detect a form.
 */
export async function applyGeneric(
  page: Page,
  _jobUrl: string,
  coverLetterText?: string
): Promise<boolean> {
  // Common selectors for form fields
  const FIELD_PATTERNS: Array<{
    label: RegExp;
    type: "name" | "email" | "phone" | "coverletter" | "cv";
  }> = [
      { label: /first.?name|given.?name/i, type: "name" },
      { label: /last.?name|surname/i, type: "name" },
      { label: /full.?name|your.?name/i, type: "name" },
      { label: /email|e-mail/i, type: "email" },
      { label: /phone|mobile|tel/i, type: "phone" },
      { label: /cover.?letter|motivation/i, type: "coverletter" },
      { label: /resume|curriculum|cv|upload/i, type: "cv" },
    ];

  const profile = await getProfile();

  let formFound = false;

  // Try to find form elements
  const inputs = await page.$$("input, textarea, [contenteditable='true']");
  for (const input of inputs) {
    const ariaLabel = (await input.getAttribute("aria-label")) ?? "";
    const placeholder = (await input.getAttribute("placeholder")) ?? "";
    const id = (await input.getAttribute("id")) ?? "";
    const name = (await input.getAttribute("name")) ?? "";
    const labelText = `${ariaLabel} ${placeholder} ${id} ${name}`;

    for (const pattern of FIELD_PATTERNS) {
      if (!pattern.label.test(labelText)) continue;
      formFound = true;
      await randomDelay(200, 600);

      const inputType = await input.getAttribute("type");
      if (inputType === "file" || pattern.type === "cv") {
        const cvPath = findCvPath();
        if (cvPath) {
          await input.setInputFiles(cvPath);
        }
      } else if (pattern.type === "name") {
        const namePart = /first/i.test(labelText)
          ? (profile?.name.split(" ")[0] ?? "")
          : /last/i.test(labelText)
            ? (profile?.name.split(" ").slice(1).join(" ") ?? "")
            : (profile?.name ?? "");
        await input.fill(namePart);
      } else if (pattern.type === "email") {
        await input.fill(profile?.email ?? "");
      } else if (pattern.type === "phone") {
        await input.fill(profile?.phone ?? "");
      } else if (pattern.type === "coverletter" && coverLetterText) {
        await input.fill(coverLetterText);
      }
      break;
    }
  }

  if (!formFound) return false;

  // Look for submit button
  const submitSelectors = [
    'button[type="submit"]',
    'input[type="submit"]',
    'button:has-text("Apply")',
    'button:has-text("Submit")',
    'button:has-text("Send Application")',
  ];

  for (const sel of submitSelectors) {
    const btn = await page.$(sel);
    if (btn) {
      await randomDelay(800, 1500);
      await btn.click();
      await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => undefined);
      return true;
    }
  }

  return formFound;
}

async function getProfile() {
  const { prisma } = await import("@/lib/prisma");
  return prisma.userProfile.findFirst();
}
