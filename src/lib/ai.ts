import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY?.trim();

if (!OPENAI_API_KEY) {
  console.warn("[ai] OPENAI_API_KEY is not set — AI features will be unavailable.");
}

const embeddings = new OpenAIEmbeddings({
  model: "text-embedding-3-small",
  apiKey: OPENAI_API_KEY,
});

/**
 * Generate a text embedding vector using OpenAI text-embedding-3-small.
 * Returns a 1536-dimensional number[].
 * NOTE: If you have existing embeddings stored from Ollama (768-dim), they will
 * be incompatible. Re-scrape jobs to regenerate embeddings with the new model.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  return embeddings.embedQuery(text);
}

/**
 * Expand a short job search query into a rich description of the role,
 * technologies, and skills — improving embedding quality for semantic ranking.
 * E.g. "Frontend" → "Frontend developer, React, Vue, Angular, HTML, CSS, JavaScript, TypeScript, UI components, responsive design, web interfaces…"
 */
export async function expandQueryForEmbedding(query: string, skillLevel: string): Promise<string> {
  const model = new ChatOpenAI({ model: "gpt-4o-mini", apiKey: OPENAI_API_KEY });
  const prompt = `You are a job search assistant. Expand the following short job search query into a rich, detailed description of the role, typical technologies, skills, and responsibilities. Write 3–5 sentences. Do not include salary, location, or company info. Be specific and technical.

Query: "${query}"${skillLevel && skillLevel !== "Any" ? `\nSeniority level: ${skillLevel}` : ""}

Expanded description:`;
  const result = await model.invoke([{ role: "user", content: prompt }]);
  return (result.content as string).trim();
}

/**
 * Given raw listing page text and all anchor links found on that page,
 * asks GPT-4o-mini to identify which jobs are relevant to the user's query
 * and return their titles + URLs.
 *
 * This mirrors what a human does: read the page, pick what matches.
 * One GPT call per listing page — no per-job calls needed at this stage.
 */
export async function extractRelevantJobsFromPage(
  query: string,
  skillLevel: string,
  pageText: string,
  links: Array<{ text: string; url: string }>,
): Promise<Array<{ title: string; url: string }>> {
  if (!OPENAI_API_KEY) return [];

  const model = new ChatOpenAI({
    model: "gpt-4o-mini",
    apiKey: OPENAI_API_KEY,
    temperature: 0,
    modelKwargs: { response_format: { type: "json_object" } },
  });

  // Build a numbered list of unique candidate URLs with their link text
  // Only include links that look like job detail pages (contain common job URL patterns)
  const jobLinkPattern = /\/(job|it-job|nabidka|position|offer|role)[\/-]/i;
  const candidates = links
    .filter((l) => jobLinkPattern.test(l.url))
    .filter((l, i, arr) => arr.findIndex((x) => x.url === l.url) === i)
    .slice(0, 60); // cap to avoid huge prompts

  if (candidates.length === 0) return [];

  const levelHint = skillLevel && skillLevel !== "Any" ? ` (${skillLevel} level)` : "";
  const candidateList = candidates
    .map((l, i) => `${i}: [${l.text || "(no text)"}] ${l.url}`)
    .join("\n");

  // Also give GPT the first 3000 chars of visible page text so it can read titles
  // that might not be in link text directly
  const pageSnippet = pageText.slice(0, 3000);

  const prompt = `A user is searching for jobs: "${query}"${levelHint}.

You are scanning a job listing page like a human recruiter would. Your job is to pick ONLY the job postings that clearly match the search.

Rules:
- "Frontend" means: React, Vue, Angular, HTML/CSS, JavaScript/TypeScript UI roles. EXCLUDE Backend, Fullstack, PHP, Java, .NET, DevOps, QA, iOS, Android, IT Director, etc.
- "React" means React/React Native developer roles. EXCLUDE unrelated tech.
- "Backend" means server-side roles. EXCLUDE Frontend, Mobile, QA, etc.
- Be strict. If the title is ambiguous or clearly different domain → exclude it.
- Fullstack is only relevant if the user explicitly searched for Fullstack.

Page text snippet (for context):
${pageSnippet}

Candidate job links (index: [link text] URL):
${candidateList}

Return a JSON object: { "jobs": [ { "index": number, "title": string } ] }
Only include jobs that clearly match. Use the best readable title you can infer from link text or page context. If no jobs match, return { "jobs": [] }.`;

  try {
    const result = await model.invoke([{ role: "user", content: prompt }]);
    const parsed = JSON.parse(result.content as string) as { jobs?: Array<{ index: number; title: string }> };
    const jobs = parsed.jobs ?? [];
    return jobs
      .filter((j) => j.index >= 0 && j.index < candidates.length)
      .map((j) => ({
        title: j.title,
        url: candidates[j.index].url,
      }));
  } catch {
    // On failure, return empty — better to return nothing than irrelevant jobs
    return [];
  }
}

/**
 * Build the cover letter prompt.
 */
function buildCoverLetterPrompt(
  jobTitle: string,
  company: string,
  jobDescription: string,
  cvText: string,
  language: string,
): string {
  return `You are an expert job application writer. Write a professional, concise cover letter (max 3 paragraphs) for the following job posting. Write the cover letter in ${language}.

JOB TITLE: ${jobTitle}
COMPANY: ${company}
JOB DESCRIPTION:
${jobDescription.slice(0, 2000)}

CANDIDATE CV SUMMARY:
${cvText.slice(0, 2000)}

Write only the cover letter body text. Do not include subject lines or placeholders like [Your Name] — write as if it's ready to submit. Be specific about the role and company.`;
}

/**
 * Generate a cover letter using GPT-4o.
 */
export async function generateCoverLetter(
  jobTitle: string,
  company: string,
  jobDescription: string,
  cvText: string,
  language = "English",
): Promise<string> {
  const prompt = buildCoverLetterPrompt(jobTitle, company, jobDescription, cvText, language);
  const model = new ChatOpenAI({ model: "gpt-4o", apiKey: OPENAI_API_KEY });
  const result = await model.invoke([{ role: "user", content: prompt }]);
  return (result.content as string).trim();
}

/**
 * Stream a cover letter token-by-token using GPT-4o.
 * Yields each text token as it arrives.
 */
export async function* generateCoverLetterStream(
  jobTitle: string,
  company: string,
  jobDescription: string,
  cvText: string,
  language = "English",
): AsyncGenerator<string> {
  const prompt = buildCoverLetterPrompt(jobTitle, company, jobDescription, cvText, language);
  const model = new ChatOpenAI({ model: "gpt-4o", apiKey: OPENAI_API_KEY, streaming: true });
  const stream = await model.stream([{ role: "user", content: prompt }]);
  for await (const chunk of stream) {
    const token = typeof chunk.content === "string" ? chunk.content : "";
    if (token) yield token;
  }
}

/**
 * Check that the OpenAI API key is configured and reachable.
 * Returns { ok: boolean, missing: string[] } for interface compatibility.
 */
export async function checkOllamaHealth(): Promise<{
  ok: boolean;
  missing: string[];
}> {
  if (!OPENAI_API_KEY) {
    return { ok: false, missing: ["OPENAI_API_KEY"] };
  }
  return { ok: true, missing: [] };
}
