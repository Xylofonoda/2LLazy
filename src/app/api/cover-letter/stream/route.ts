import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateCoverLetterStream } from "@/lib/ollama";
import { findCvFile, readFileText } from "@/lib/cv";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const jobId: string = body.jobId ?? "";

  if (!jobId) {
    return new Response("Missing jobId", { status: 400 });
  }

  const job = await prisma.jobPosting.findUnique({ where: { id: jobId } });
  if (!job) {
    return new Response("Job not found", { status: 404 });
  }

  const userProfile = await prisma.userProfile.findFirst({
    select: { coverLetterLanguage: true },
  });
  const language = userProfile?.coverLetterLanguage ?? "English";

  let cvText = "";
  const cvFile = findCvFile();
  if (cvFile) cvText = await readFileText(cvFile).catch(() => "");

  const encoder = new TextEncoder();
  const transform = new TransformStream<Uint8Array, Uint8Array>();
  const writer = transform.writable.getWriter();

  const send = (payload: Record<string, unknown>) =>
    writer.write(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));

  (async () => {
    let fullContent = "";
    try {
      for await (const token of generateCoverLetterStream(
        job.title,
        job.company,
        job.description,
        cvText,
        language,
      )) {
        fullContent += token;
        await send({ token });
      }

      // Persist to DB and auto-favourite atomically
      await prisma.$transaction([
        prisma.coverLetter.create({
          data: { jobId, content: fullContent, generatedByAI: true },
        }),
        prisma.jobPosting.update({
          where: { id: jobId },
          data: { favourited: true },
        }),
      ]);

      await send({ done: true });
    } catch (err) {
      await send({ error: String(err) });
    } finally {
      await writer.close();
    }
  })();

  return new Response(transform.readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
