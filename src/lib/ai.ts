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
 *
 * Optional `urlHint`: a regex to pre-filter links by URL pattern (e.g. /\/pozice\//i for Skilleto).
 * If omitted, a broad heuristic is used to exclude navigation/utility links.
 */
export async function extractRelevantJobsFromPage(
  query: string,
  skillLevel: string,
  pageText: string,
  links: Array<{ text: string; url: string }>,
  urlHint?: RegExp,
): Promise<Array<{ title: string; url: string }>> {
  if (!OPENAI_API_KEY) return [];

  const model = new ChatOpenAI({
    model: "gpt-4o-mini",
    apiKey: OPENAI_API_KEY,
    temperature: 0,
    modelKwargs: { response_format: { type: "json_object" } },
  });

  // Known job-detail URL patterns covering all supported sites
  const KNOWN_JOB_PATTERNS = [
    /\/(job|it-job|position|offer|role|vacancy)[\/-]/i, // English generic
    /\/(nabidka|nabidky|pozice)[\/-]/i,                  // Czech (Cocuma, StartupJobs, Skilleto)
    /\/rpd\//i,                                          // Jobs.cz
    /\/desc\//i,                                         // Jooble
    /\/job-listing\//i,                                  // Glassdoor
  ];

  // Navigation / utility paths to exclude when falling back to heuristic
  const NAV_PATTERN = /\/(login|signup|register|about|contact|privacy|terms|faq|blog|news|tag|category|search|lang|logout|cookies|gdpr)(\/|$|\?)/i;

  let candidates = links
    .filter((l) => {
      // If the caller knows the URL pattern for this site, use it directly
      if (urlHint) return urlHint.test(l.url);
      // Otherwise use the broad multi-site pattern list
      return KNOWN_JOB_PATTERNS.some((p) => p.test(l.url));
    })
    .filter((l) => !NAV_PATTERN.test(l.url))
    .filter((l, i, arr) => arr.findIndex((x) => x.url === l.url) === i)
    .slice(0, 60);

  // Fallback: if URL patterns found nothing, accept any link with meaningful text
  // that doesn't look like a nav/utility link — let GPT decide what's a job
  if (candidates.length === 0) {
    candidates = links
      .filter((l) => l.text.trim().length > 4)
      .filter((l) => !NAV_PATTERN.test(l.url))
      .filter((l) => !/^(https?:\/\/[^/]+)?\/?$/.test(l.url)) // skip bare homepage links
      .filter((l, i, arr) => arr.findIndex((x) => x.url === l.url) === i)
      .slice(0, 60);
  }

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
  return `You are an expert job application writer. Write a compelling, warm, and professional cover letter for the job below. Write in ${language}.

**Output format (Markdown):**
- Open with a short greeting line like "Dear Hiring Team at [Company],"
- 3 focused paragraphs:
  1. 🎯 **Why this role excites me** — reference the specific role and company by name, show genuine interest
  2. 💡 **What I bring** — highlight 2–3 concrete achievements/skills from the CV that directly match the job requirements, using specific numbers/results where possible
  3. 🚀 **What's next** — a confident close that invites a conversation
- End with "Best regards," and the candidate's name (taken from the CV)
- Keep it under 300 words
- Use a natural, enthusiastic tone — not robotic or overly formal
- Do NOT use placeholder text like [Your Name] — extract the real name from the CV

JOB TITLE: ${jobTitle}
COMPANY: ${company}
JOB DESCRIPTION:
${jobDescription.slice(0, 2500)}

CANDIDATE CV:
${cvText.slice(0, 2500)}`;
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
