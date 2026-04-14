import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { readCvText } from "@/lib/cv";
import { ChatOpenAI } from "@langchain/openai";
import { auth } from "@/auth";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
  const userId = session.user.id;

  const body = await req.json().catch(() => ({}));
  const { jobId } = body as { jobId?: string };

  if (!jobId) {
    return new Response("Missing jobId", { status: 400 });
  }

  const job = await prisma.jobPosting.findUnique({ where: { id: jobId } });
  if (!job) return new Response("Job not found", { status: 404 });

  const cvText = await readCvText(userId).catch(() => "");
  if (!cvText) {
    return new Response(
      `data: ${JSON.stringify({ error: "No CV uploaded. Please upload your CV in Settings first." })}\n\n`,
      { status: 200, headers: { "Content-Type": "text/event-stream" } },
    );
  }

  const prompt = `You are an expert CV writer and personal branding specialist. Tailor the candidate's CV specifically for the job below — reorder sections, rewrite bullet points to use stronger action verbs, and emphasise directly relevant skills and achievements.

**Output format: structured Markdown with emojis as section icons**

Use this structure (adapt to what's in the CV):

# [Full Name]
[email] · [phone] · [LinkedIn/GitHub if present]

---

## 🎯 Professional Summary
2–3 sentences tailored to this specific role. Mention the job title and key skills the employer is looking for.

## 🛠️ Skills
Comma-separated list, most relevant to this job first. Bold the top 5–6 matching skills.

## 💼 Experience
### [Job Title] · [Company] · [Dates]
- Strong action-verb bullet points (e.g. "Built...", "Led...", "Reduced...")
- Quantify results where possible (%, time saved, team size, etc.)
- Put the most job-relevant bullets first

## 🎓 Education
### [Degree] · [University] · [Year]

## 🏆 Achievements / Projects (if present in CV)
Highlight any that are relevant to this job.

---

**Rules:**
- Do NOT fabricate experience, skills, or qualifications not in the original CV
- Do NOT use placeholder text like [Your Name] — use the real name from the CV
- Keep total length reasonable (1–2 pages equivalent)
- Write in the same language as the original CV

--- JOB ---
Title: ${job.title}
Company: ${job.company}
${job.description.slice(0, 3000)}

--- ORIGINAL CV ---
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
