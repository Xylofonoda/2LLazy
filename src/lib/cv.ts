import { prisma } from "@/lib/prisma";

export async function readCvText(): Promise<string> {
  const doc = await prisma.cvDocument.findFirst({ orderBy: { uploadedAt: "desc" } });
  if (!doc) return "";
  const ext = doc.originalName.split(".").pop()?.toLowerCase();
  const buf = Buffer.from(doc.data);
  if (ext === "txt") return buf.toString("utf-8");
  if (ext === "pdf") {
    const pdfParse = (await import("pdf-parse")).default;
    const data = await pdfParse(buf);
    return data.text;
  }
  return buf.toString("utf-8").replace(/[^\x20-\x7E\n]/g, " ");
}
