import { z } from "zod";

/**
 * Zod schema for the structured output of a single job posting extraction.
 * Used with LangChain's .withStructuredOutput() to guarantee shape.
 */
export const JobPostingSchema = z.object({
  title: z.string().describe("The job title, e.g. 'Senior React Developer'"),
  company: z.string().describe("The hiring company name"),
  location: z
    .string()
    .optional()
    .describe("Job location or 'Remote' / 'Hybrid'"),
  description: z
    .string()
    .describe(
      "Full job description including responsibilities and requirements",
    ),
  salary: z
    .string()
    .optional()
    .describe("Salary range if mentioned, e.g. '80–100k CZK/month'"),
  stack: z
    .array(z.string())
    .describe(
      "Required / mentioned tech stack and skills, e.g. ['React', 'TypeScript', 'Node.js']",
    ),
  applyUrl: z
    .string()
    .optional()
    .describe("Direct URL to apply for this job, if different from page URL"),
});

export type JobPosting = z.infer<typeof JobPostingSchema>;

/** Link metadata extracted from a page for LLM-based discovery. */
export interface PageLink {
  text: string;
  href: string;
}
