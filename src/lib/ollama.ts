import { ChatOpenAI } from "@langchain/openai";

const OLLAMA_BASE_URL =
  process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL ?? "nomic-embed-text";
const CHAT_MODEL = process.env.OLLAMA_CHAT_MODEL ?? "llama3";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY?.trim();
const hasOpenAI = Boolean(OPENAI_API_KEY);

/**
 * Generate a text embedding vector using the local Ollama embed model.
 * Returns a number[] (768 dimensions for nomic-embed-text).
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const res = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, prompt: text }),
  });

  if (!res.ok) {
    throw new Error(
      `Ollama embedding request failed: ${res.status} ${res.statusText}`
    );
  }

  const data = (await res.json()) as { embedding: number[] };
  return data.embedding;
}

/**
 * Build the cover letter prompt shared by both chat backends.
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
 * Generate a cover letter. Uses OpenAI GPT-4o-mini when OPENAI_API_KEY is set,
 * otherwise falls back to the local Ollama chat model.
 */
export async function generateCoverLetter(
  jobTitle: string,
  company: string,
  jobDescription: string,
  cvText: string,
  language = "English",
): Promise<string> {
  const prompt = buildCoverLetterPrompt(jobTitle, company, jobDescription, cvText, language);

  if (hasOpenAI) {
    const model = new ChatOpenAI({ model: "gpt-4o-mini", apiKey: OPENAI_API_KEY });
    const result = await model.invoke([{ role: "user", content: prompt }]);
    return (result.content as string).trim();
  }

  const res = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: CHAT_MODEL, prompt, stream: false }),
  });

  if (!res.ok) {
    throw new Error(
      `Ollama generation request failed: ${res.status} ${res.statusText}`
    );
  }

  const data = (await res.json()) as { response: string };
  return data.response.trim();
}

/**
 * Stream a cover letter token-by-token. Uses OpenAI GPT-4o-mini when
 * OPENAI_API_KEY is set, otherwise falls back to local Ollama.
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

  if (hasOpenAI) {
    const model = new ChatOpenAI({ model: "gpt-4o-mini", apiKey: OPENAI_API_KEY, streaming: true });
    const stream = await model.stream([{ role: "user", content: prompt }]);
    for await (const chunk of stream) {
      const token = typeof chunk.content === "string" ? chunk.content : "";
      if (token) yield token;
    }
    return;
  }

  const res = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: CHAT_MODEL, prompt, stream: true }),
  });

  if (!res.ok || !res.body) {
    throw new Error(
      `Ollama generation request failed: ${res.status} ${res.statusText}`,
    );
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const chunk = JSON.parse(line) as { response: string; done: boolean };
        if (chunk.response) yield chunk.response;
        if (chunk.done) return;
      } catch {
        // ignore partial/malformed lines
      }
    }
  }
}

/**
 * Check that Ollama is reachable and the required models exist.
 * When OPENAI_API_KEY is set, only the embedding model is checked
 * (chat is handled by OpenAI).
 * Returns { ok: boolean, missing: string[] }
 */
export async function checkOllamaHealth(): Promise<{
  ok: boolean;
  missing: string[];
}> {
  const requiredModels = hasOpenAI
    ? [EMBED_MODEL]  // chat is handled by OpenAI
    : [EMBED_MODEL, CHAT_MODEL];
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return { ok: false, missing: [] };

    const data = (await res.json()) as { models: { name: string }[] };
    const names = data.models.map((m) => m.name.split(":")[0]);
    const missing = requiredModels.filter((m) => !names.includes(m.split(":")[0]));

    return { ok: missing.length === 0, missing };
  } catch {
    return { ok: false, missing: requiredModels };
  }
}
