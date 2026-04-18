/**
 * fillPlan
 *
 * Sends the form field snapshot + user profile + cover letter to GPT-4o-mini
 * and receives a Zod-validated FillPlan describing exactly which fields to fill
 * and which button to submit.
 */
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import type { FieldSnapshot } from "./snapshotFormFields";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY?.trim();

// ─── Schema ───────────────────────────────────────────────────────────────────

export const FillPlanSchema = z.object({
  fills: z.array(
    z.object({
      idx: z.number().int().describe("data-aaf-idx of the field to fill"),
      value: z.string().describe("Value to enter into the field"),
    }),
  ).describe("List of field fills to perform, in order"),
  fileUploadIdx: z.number().int().optional()
    .describe("data-aaf-idx of the file-upload input for the CV, if present"),
  submitIdx: z.number().int()
    .describe("data-aaf-idx of the submit / next button to click last"),
});

export type FillPlan = z.infer<typeof FillPlanSchema>;

// ─── User profile shape passed in from the route ──────────────────────────────
export interface ApplicantProfile {
  name: string;
  email: string;
  phone?: string | null;
  linkedInUrl?: string | null;
  githubUrl?: string | null;
  coverLetterText?: string | null;
}

// ─── Main function ────────────────────────────────────────────────────────────

export async function generateFillPlan(
  fields: FieldSnapshot[],
  profile: ApplicantProfile,
): Promise<FillPlan | null> {
  if (!OPENAI_API_KEY) return null;
  if (fields.length === 0) return null;

  const model = new ChatOpenAI({
    model: "gpt-4o-mini",
    apiKey: OPENAI_API_KEY,
    temperature: 0,
  }).withStructuredOutput(FillPlanSchema);

  const fieldList = fields
    .map(
      (f) =>
        `[${f.idx}] ${f.tag}${f.type ? ` type="${f.type}"` : ""}` +
        (f.labelText ? ` label="${f.labelText}"` : "") +
        (f.placeholder ? ` placeholder="${f.placeholder}"` : "") +
        (f.ariaLabel ? ` aria="${f.ariaLabel}"` : "") +
        (f.isRequired ? " (required)" : ""),
    )
    .join("\n");

  const profileSummary =
    `Name: ${profile.name}\n` +
    `Email: ${profile.email}\n` +
    (profile.phone ? `Phone: ${profile.phone}\n` : "") +
    (profile.linkedInUrl ? `LinkedIn: ${profile.linkedInUrl}\n` : "") +
    (profile.githubUrl ? `GitHub: ${profile.githubUrl}\n` : "") +
    (profile.coverLetterText
      ? `Cover letter (first 800 chars):\n${profile.coverLetterText.slice(0, 800)}\n`
      : "");

  return model.invoke([{
    role: "user",
    content:
      `You are helping fill out a job application form automatically.\n\n` +
      `Applicant profile:\n${profileSummary}\n\n` +
      `Form fields (index, tag, label, placeholder):\n${fieldList}\n\n` +
      `Instructions:\n` +
      `- Map applicant data to the correct fields using label/placeholder as context.\n` +
      `- For a file-upload input (<input type="file">), set fileUploadIdx to that field's index.\n` +
      `- For the submit button, set submitIdx to that field's index.\n` +
      `- Skip fields you cannot confidently fill (don't guess sensitive data like salary expectations unless clearly provided).\n` +
      `- If there is a cover letter textarea, use the cover letter text.\n` +
      `- Do not include the submit button in "fills".`,
  }]);
}
