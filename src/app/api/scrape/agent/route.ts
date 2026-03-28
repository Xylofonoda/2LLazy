import { NextRequest, NextResponse } from "next/server";
import { agentScraper } from "@/lib/agent/graph";

export const runtime = "nodejs";
/**
 * Long timeout: the graph navigates multiple pages and calls the LLM for each.
 * 300 s matches the existing /api/scrape route limit.
 */
export const maxDuration = 300;

/**
 * POST /api/scrape/agent
 *
 * Body (JSON):
 *   { "targetUrl": "https://www.linkedin.com/jobs/search/?keywords=react+developer" }
 *
 * Response (JSON):
 *   {
 *     "jobs":        JobPosting[],   // extracted structured data
 *     "visitedUrls": string[],       // all URLs the agent visited
 *     "errors":      string[]        // non-fatal errors logged during the run
 *   }
 *
 * Requirements:
 *   - OPENAI_API_KEY must be set in the environment.
 *   - Playwright browsers must be installed (`npx playwright install chromium`).
 */
export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured on the server." },
      { status: 500 },
    );
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const targetUrl = body.targetUrl;

  if (!targetUrl || typeof targetUrl !== "string") {
    return NextResponse.json(
      { error: "Missing or invalid 'targetUrl' in request body." },
      { status: 400 },
    );
  }

  // Basic URL validation — defence against SSRF
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    return NextResponse.json({ error: "targetUrl is not a valid URL." }, { status: 400 });
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    return NextResponse.json(
      { error: "targetUrl must use http or https." },
      { status: 400 },
    );
  }

  try {
    const result = await agentScraper.invoke({ searchUrl: targetUrl });

    return NextResponse.json({
      jobs: result.extractedJobs,
      visitedUrls: result.visitedUrls,
      errors: result.errors,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[POST /api/scrape/agent]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
