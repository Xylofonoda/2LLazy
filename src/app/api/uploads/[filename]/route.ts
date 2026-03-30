import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename: id } = await params;

  const doc = await prisma.cvDocument.findUnique({ where: { id } });
  if (!doc) {
    return new NextResponse("Not found", { status: 404 });
  }

  const ext = path.extname(doc.originalName).toLowerCase();
  const contentType =
    ext === ".pdf"
      ? "application/pdf"
      : ext === ".docx"
        ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        : "application/octet-stream";

  return new NextResponse(Buffer.from(doc.data), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${doc.originalName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
