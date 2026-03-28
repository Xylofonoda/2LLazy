import fs from "fs";
import path from "path";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

export function findCvFile(): string | null {
  if (!fs.existsSync(UPLOADS_DIR)) return null;
  const files = fs
    .readdirSync(UPLOADS_DIR)
    .filter((f) => /cv|resume/i.test(f) && /\.(pdf|docx|doc|txt)$/i.test(f));
  return files[0] ? path.join(UPLOADS_DIR, files[0]) : null;
}

export async function readFileText(filePath: string): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".txt") return fs.readFileSync(filePath, "utf-8");
  if (ext === ".pdf") {
    const pdfParse = (await import("pdf-parse")).default;
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return data.text;
  }
  return fs.readFileSync(filePath, "utf-8").replace(/[^\x20-\x7E\n]/g, " ");
}
