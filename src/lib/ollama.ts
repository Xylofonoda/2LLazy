const OLLAMA_BASE_URL =
  process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL ?? "nomic-embed-text";
const CHAT_MODEL = process.env.OLLAMA_CHAT_MODEL ?? "llama3";

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
 * Generate a cover letter using the local Ollama chat model.
 */
export async function generateCoverLetter(
  jobTitle: string,
  company: string,
  jobDescription: string,
  cvText: string
): Promise<string> {
  const prompt = `You are an expert job application writer. Write a professional, concise cover letter (max 3 paragraphs) for the following job posting.

JOB TITLE: ${jobTitle}
COMPANY: ${company}
JOB DESCRIPTION:
${jobDescription.slice(0, 2000)}

CANDIDATE CV SUMMARY:
${cvText.slice(0, 2000)}

Write only the cover letter body text. Do not include subject lines or placeholders like [Your Name] — write as if it's ready to submit. Be specific about the role and company.`;

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
 * Check that Ollama is reachable and the required models exist.
 * Returns { ok: boolean, missing: string[] }
 */
export async function checkOllamaHealth(): Promise<{
  ok: boolean;
  missing: string[];
}> {
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return { ok: false, missing: [] };

    const data = (await res.json()) as { models: { name: string }[] };
    const names = data.models.map((m) => m.name.split(":")[0]);
    const missing: string[] = [];
    if (!names.includes(EMBED_MODEL.split(":")[0])) missing.push(EMBED_MODEL);
    if (!names.includes(CHAT_MODEL.split(":")[0])) missing.push(CHAT_MODEL);

    return { ok: missing.length === 0, missing };
  } catch {
    return { ok: false, missing: [EMBED_MODEL, CHAT_MODEL] };
  }
}
