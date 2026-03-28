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

/** Magic-byte signatures for allowed file types. */
const MAGIC_SIGNATURES: Array<{ bytes: number[]; offset?: number }> = [
  { bytes: [0x25, 0x50, 0x44, 0x46] },            // %PDF
  { bytes: [0x50, 0x4b, 0x03, 0x04] },            // PK (DOCX/ZIP)
  { bytes: [0xd0, 0xcf, 0x11, 0xe0] },            // DOC (OLE2)
];

function hasMagicBytes(buf: Buffer): boolean {
  // Plain-text files have no magic bytes — allow any printable content
  const isPrintable = Array.from(buf.subarray(0, 512)).every(
    (b) => b === 0x09 || b === 0x0a || b === 0x0d || (b >= 0x20 && b <= 0x7e)
  );
  if (isPrintable) return true;
  return MAGIC_SIGNATURES.some(({ bytes, offset = 0 }) =>
    bytes.every((b, i) => buf[offset + i] === b)
  );
}

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

  const arrayBuffer = await file.arrayBuffer();
  const buf = Buffer.from(arrayBuffer);

  if (!hasMagicBytes(buf)) {
    return NextResponse.json(
      { error: "File content does not match its declared type" },
      { status: 400 }
    );
  }

  // Sanitize filename
  const safeName = path.basename(file.name).replace(/[^a-zA-Z0-9._-]/g, "_");
  const dest = path.join(UPLOADS_DIR, safeName);

  fs.writeFileSync(dest, buf);

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
