import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { readCvText } from "@/lib/cv";
import { ChatOpenAI } from "@langchain/openai";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { jobId } = body as { jobId?: string };

  if (!jobId) {
    return new Response("Missing jobId", { status: 400 });
  }

  const job = await prisma.jobPosting.findUnique({ where: { id: jobId } });
  if (!job) return new Response("Job not found", { status: 404 });

  const cvText = await readCvText().catch(() => "");
  if (!cvText) {
    return new Response(
      `data: ${JSON.stringify({ error: "No CV uploaded. Please upload your CV in Settings first." })}\n\n`,
      { status: 200, headers: { "Content-Type": "text/event-stream" } },
    );
  }

  const prompt = `You are a professional CV writer. Tailor the following CV to the job description provided.
Reorder bullet points, adjust the summary, and emphasise relevant skills and experience.
Do NOT fabricate any experience, skills, or qualifications not present in the original CV.
Return the complete tailored CV as plain text.

--- JOB ---
Title: ${job.title}
Company: ${job.company}
${job.description.slice(0, 3000)}

--- CV ---
${cvText.slice(0, 6000)}`;

  const encoder = new TextEncoder();
  const stream = new TransformStream<Uint8Array, Uint8Array>();
  const writer = stream.writable.getWriter();

  (async () => {
    try {
      const llm = new ChatOpenAI({ model: "gpt-4o", streaming: true });
      const streamResult = await llm.stream(prompt);
      for await (const chunk of streamResult) {
        const token = typeof chunk.content === "string" ? chunk.content : "";
        if (token) {
          await writer.write(encoder.encode(`data: ${JSON.stringify({ token })}\n\n`));
        }
      }
      await writer.write(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
    } catch (err) {
      await writer.write(
        encoder.encode(`data: ${JSON.stringify({ error: String(err) })}\n\n`),
      );
    } finally {
      await writer.close();
    }
  })();

  return new Response(stream.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
