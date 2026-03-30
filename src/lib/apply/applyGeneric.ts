import { Page } from "playwright";
import { randomDelay } from "@/lib/auth/sessionManager";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import os from "os";
import path from "path";
import fs from "fs";

// ─── Error ────────────────────────────────────────────────────────────────────

/** Thrown when the AI cannot identify a submit button on the current page. */
export class FormNotFoundError extends Error {
  constructor(message = "No submit button found on the page") {
    super(message);
    this.name = "FormNotFoundError";
  }
}

// ─── LLM schema ───────────────────────────────────────────────────────────────

const FillPlanSchema = z.object({
  fields: z
    .array(
      z.object({
        idx: z.number().describe("The data-aaf-idx value of the field to fill"),
        value: z.string().describe("The value to enter into this field"),
      })
    )
    .describe(
      "Text/textarea fields to fill — omit file inputs, checkboxes, radio buttons, and dropdowns"
    ),
  fileUploadIdx: z
    .number()
    .nullable()
    .describe(
      "data-aaf-idx of the CV/resume file upload input, or null if no file input exists"
    ),
  submitIdx: z
    .number()
    .nullable()
    .describe(
      "data-aaf-idx of the submit or Apply button. Return null ONLY if no submit button exists at all on this step."
    ),
});

type FillPlan = z.infer<typeof FillPlanSchema>;

// ─── Field snapshot ───────────────────────────────────────────────────────────

interface FieldSnapshot {
  idx: number;
  tag: string;
  type: string;
  id: string;
  name: string;
  placeholder: string;
  ariaLabel: string;
  labelText: string;
  required: boolean;
}

/**
 * Injects `data-aaf-idx` attributes onto every visible interactive element in
 * the page and returns a serialised snapshot — giving the LLM a stable handle
 * for every element.
 */
async function snapshotFormFields(page: Page): Promise<FieldSnapshot[]> {
  return page.evaluate((): FieldSnapshot[] => {
    interface FieldSnapshot {
      idx: number; tag: string; type: string; id: string; name: string;
      placeholder: string; ariaLabel: string; labelText: string; required: boolean;
    }
    const fields: FieldSnapshot[] = [];
    const elements = Array.from(
      document.querySelectorAll<HTMLElement>("input, textarea, select, button")
    ).filter((el) => {
      const style = window.getComputedStyle(el);
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        (el as HTMLInputElement).type !== "hidden" &&
        !el.hasAttribute("disabled")
      );
    });

    elements.forEach((el, idx) => {
      el.setAttribute("data-aaf-idx", String(idx));

      let labelText = "";
      if (el.id) {
        const lbl = document.querySelector<HTMLLabelElement>(`label[for="${el.id}"]`);
        if (lbl) labelText = lbl.textContent?.trim() ?? "";
      }
      if (!labelText) {
        const labelledBy = el.getAttribute("aria-labelledby");
        if (labelledBy) {
          const lbl = document.getElementById(labelledBy);
          if (lbl) labelText = lbl.textContent?.trim() ?? "";
        }
      }
      if (!labelText) {
        const ancestor = el.closest("label");
        if (ancestor) labelText = ancestor.textContent?.trim() ?? "";
      }
      if (!labelText) {
        labelText = (el.parentElement?.textContent?.trim() ?? "").slice(0, 80);
      }

      fields.push({
        idx,
        tag: el.tagName.toLowerCase(),
        type: (el as HTMLInputElement).type ?? "",
        id: el.id ?? "",
        name: el.getAttribute("name") ?? "",
        placeholder: el.getAttribute("placeholder") ?? "",
        ariaLabel: el.getAttribute("aria-label") ?? "",
        labelText,
        required: el.hasAttribute("required"),
      });
    });

    return fields;
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function getOrWriteTempCv(): Promise<string | null> {
  const { prisma } = await import("@/lib/prisma");
  const cv = await prisma.cvDocument.findFirst({ orderBy: { uploadedAt: "desc" } });
  if (!cv) return null;
  const tmpPath = path.join(os.tmpdir(), cv.originalName);
  fs.writeFileSync(tmpPath, Buffer.from(cv.data));
  return tmpPath;
}

async function getProfile() {
  const { prisma } = await import("@/lib/prisma");
  return prisma.userProfile.findFirst();
}

async function buildFillPlan(
  fields: FieldSnapshot[],
  profile: { name: string; email: string; phone?: string | null } | null,
  coverLetterText: string | undefined,
  cvFilename: string | undefined
): Promise<FillPlan | null> {
  if (!process.env.OPENAI_API_KEY) {
    console.warn("[applyGeneric] OPENAI_API_KEY not set — AI form filler disabled");
    return null;
  }

  const llm = new ChatOpenAI({ model: "gpt-4o-mini", temperature: 0 }).withStructuredOutput(
    FillPlanSchema
  );

  const profileLines = profile
    ? [
      `Full Name: ${profile.name}`,
      `First Name: ${profile.name.split(" ")[0]}`,
      `Last Name: ${profile.name.split(" ").slice(1).join(" ")}`,
      `Email: ${profile.email}`,
      profile.phone ? `Phone: ${profile.phone}` : null,
      coverLetterText ? `Cover Letter (excerpt): ${coverLetterText.slice(0, 400)}` : null,
      cvFilename ? `CV filename: ${cvFilename}` : null,
    ].filter(Boolean)
    : ["(no profile configured)"];

  // Separate fillable fields from submit candidates to stay within token budget
  const fillable = fields.filter(
    (f) => !["hidden", "checkbox", "radio", "image", "submit"].includes(f.type)
  );
  const submitCandidates = fields.filter(
    (f) =>
      f.type === "submit" ||
      (f.tag === "button" &&
        /apply|submit|send|continue|next|weiter/i.test(
          `${f.ariaLabel} ${f.labelText} ${f.placeholder}`
        ))
  );

  const snapshot = [...fillable.slice(0, 50), ...submitCandidates.slice(0, 10)];
  if (snapshot.length === 0) return null;

  const prompt = `You are filling out a job application form on behalf of a user.

User profile:
${profileLines.join("\n")}

Visible form fields (idx is the stable handle — use it in your response):
${JSON.stringify(snapshot, null, 2)}

Instructions:
• Match profile fields to the most appropriate form elements by label/placeholder/aria-label.
• Only fill text, email, tel, textarea fields — skip checkboxes, radio buttons, and selects.
• fileUploadIdx: set to the idx of the file input that accepts a CV/resume, or null.
• submitIdx: set to the idx of the primary submit/Apply button. Look for "Apply", "Submit", "Continue", "Next", or button[type=submit]. Return null ONLY if genuinely absent.
• Do NOT fabricate values — only use the provided profile data.`;

  try {
    return await llm.invoke(prompt);
  } catch (err) {
    console.warn("[applyGeneric] LLM call failed:", err);
    return null;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface ApplyGenericOptions {
  /**
   * When true, fills form fields but does NOT click submit.
   * Use this for multi-step flows (e.g. LinkedIn Easy Apply) where the caller
   * handles navigation between steps.
   */
  skipSubmit?: boolean;
}

/**
 * AI-powered generic form filler.
 * Snapshots the page's interactive elements, asks GPT-4o-mini for a fill plan,
 * then executes it. Works on any website — including external URLs.
 *
 * @throws {FormNotFoundError} when `skipSubmit` is false (default) and no
 * submit button can be identified.
 */
export async function applyGeneric(
  page: Page,
  _jobUrl: string,
  coverLetterText?: string,
  options: ApplyGenericOptions = {}
): Promise<boolean> {
  await page.waitForLoadState("networkidle").catch(() => undefined);

  const [profile, fields] = await Promise.all([getProfile(), snapshotFormFields(page)]);

  if (fields.length === 0) {
    if (!options.skipSubmit) throw new FormNotFoundError("No interactive fields found on the page");
    return false;
  }

  const cvPath = await getOrWriteTempCv();
  const cvFilename = cvPath ? path.basename(cvPath) : undefined;

  const plan = await buildFillPlan(fields, profile, coverLetterText, cvFilename);

  // Clean up temp CV whether we succeed or fail
  const cleanupCv = () => {
    if (cvPath) {
      try { fs.unlinkSync(cvPath); } catch { /* ignore */ }
    }
  };

  if (!options.skipSubmit && (!plan || plan.submitIdx === null)) {
    cleanupCv();
    throw new FormNotFoundError("AI could not identify a submit button on the page");
  }

  if (!plan) {
    cleanupCv();
    return false;
  }

  // Fill text fields
  for (const { idx, value } of plan.fields) {
    try {
      await randomDelay(150, 400);
      await page.fill(`[data-aaf-idx="${idx}"]`, value);
    } catch {
      // Custom widget or stale element — skip
    }
  }

  // Handle CV file upload
  if (plan.fileUploadIdx !== null && cvPath) {
    try {
      await page.setInputFiles(`[data-aaf-idx="${plan.fileUploadIdx}"]`, cvPath);
      await randomDelay(500, 1000);
    } catch {
      console.warn("[applyGeneric] CV file upload failed");
    }
  }

  cleanupCv();

  if (options.skipSubmit || plan.submitIdx === null) {
    return true;
  }

  // Click submit
  await randomDelay(800, 1500);
  await page.click(`[data-aaf-idx="${plan.submitIdx}"]`);
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => undefined);

  return true;
}
