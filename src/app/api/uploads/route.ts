import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";

const UPLOADS_DIR = path.join(process.cwd(), "uploads");

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const ALLOWED_EXTENSIONS = new Set([".pdf", ".docx", ".doc", ".txt"]);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File too large (max 10 MB)" }, { status: 400 });
  }

  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return NextResponse.json(
      { error: "Only PDF, DOCX, DOC, and TXT files are allowed" },
      { status: 400 }
    );
  }

  // Sanitize filename
  const safeName = path.basename(file.name).replace(/[^a-zA-Z0-9._-]/g, "_");
  const dest = path.join(UPLOADS_DIR, safeName);

  const arrayBuffer = await file.arrayBuffer();
  fs.writeFileSync(dest, Buffer.from(arrayBuffer));

  return NextResponse.json({ filename: safeName, size: file.size });
}

export async function GET() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    return NextResponse.json({ files: [] });
  }

  const files = fs
    .readdirSync(UPLOADS_DIR)
    .filter((f) => ALLOWED_EXTENSIONS.has(path.extname(f).toLowerCase()))
    .map((f) => {
      const stat = fs.statSync(path.join(UPLOADS_DIR, f));
      return { filename: f, size: stat.size, uploadedAt: stat.mtime };
    });

  return NextResponse.json({ files });
}
