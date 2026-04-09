import { ChatOpenAI } from "@langchain/openai";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY?.trim();

export interface ExtractedJob {
  title: string;
  company: string;
  location: string;
  salary: string;
  description: string;
  workType: string;
}

export interface JobHint {
  url: string;
  title?: string;
  company?: string;
  location?: string;
}

const SYSTEM_PROMPT = `You are a job data extraction assistant. Extract structured data from job page text.
Return ONLY a JSON object with these exact keys:
- "title": the job title (string)
- "company": the employer / company name (string)
- "location": city, country, or "Remote" (string)
- "salary": salary range if visible on the page, otherwise "" (string)
- "description": the full job description text, max 3000 characters (string)
- "workType": one of "Remote", "Hybrid", "Onsite", or "" if not clear (string)`;

/**
 * Uses GPT-4o-mini to extract structured job data from raw page body text.
 * Playwright fetches and renders the page; this function parses what it finds.
 * Falls back gracefully to hint values when OPENAI_API_KEY is absent or the
 * call fails, so scrapers keep working without an OpenAI key.
 */
export async function extractJobFromText(
  pageText: string,
  hint: JobHint,
): Promise<ExtractedJob> {
  const fallback: ExtractedJob = {
    title: hint.title ?? "",
    company: hint.company ?? "",
    location: hint.location ?? "Remote",
    salary: "",
    description: pageText.slice(0, 4000).trim(),
    workType: "",
  };

  if (!OPENAI_API_KEY) return fallback;

  try {
    const model = new ChatOpenAI({
      model: "gpt-4o-mini",
      apiKey: OPENAI_API_KEY,
      temperature: 0,
      modelKwargs: { response_format: { type: "json_object" } },
    });

    const result = await model.invoke([
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Page URL: ${hint.url}\n\n<page_text>\n${pageText.slice(0, 6000)}\n</page_text>`,
      },
    ]);

    const parsed = JSON.parse(result.content as string) as Partial<ExtractedJob>;
    return {
      title: parsed.title?.trim() || fallback.title,
      company: parsed.company?.trim() || fallback.company,
      location: parsed.location?.trim() || fallback.location,
      salary: parsed.salary?.trim() ?? "",
      description: (parsed.description?.trim() || fallback.description).slice(0, 4000),
      workType: parsed.workType?.trim() ?? "",
    };
  } catch {
    return fallback;
  }
}
