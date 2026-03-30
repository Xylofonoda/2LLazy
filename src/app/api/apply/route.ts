import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { applyToJobSite } from "@/lib/apply/applyRouter";

export const runtime = "nodejs";
export const maxDuration = 120;

const BodySchema = z.object({
  applicationId: z.string(),
  coverLetterId: z.string().nullable().optional(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { applicationId, coverLetterId } = parsed.data;

  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { job: true },
  });

  if (!application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  const result = await applyToJobSite(application.job, applicationId, coverLetterId);

  if (result.status === "APPLIED") {
    return NextResponse.json({ success: true });
  }

  if (result.status === "MANUAL_REQUIRED") {
    return NextResponse.json({ success: false, manual: true, url: result.url });
  }

  // FAILED
  return NextResponse.json({ success: false, errorMessage: result.errorMessage });
}
