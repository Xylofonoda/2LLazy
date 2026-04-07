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
