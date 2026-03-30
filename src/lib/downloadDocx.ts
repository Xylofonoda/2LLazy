import { Document, Packer, Paragraph, TextRun } from "docx";

/**
 * Converts plain text to a .docx Blob.
 * Double newlines become paragraph breaks; single newlines become soft line breaks.
 */
function textToDocx(text: string): Promise<Blob> {
  const paragraphs = text.split(/\n\n+/).map((block) => {
    const runs = block.split("\n").flatMap((line, i, arr) => {
      const run = new TextRun({ text: line, size: 24, font: "Calibri" });
      // Add a line break after every line except the last in the block
      return i < arr.length - 1 ? [run, new TextRun({ break: 1 })] : [run];
    });
    return new Paragraph({ children: runs, spacing: { after: 200 } });
  });

  const doc = new Document({
    sections: [{ children: paragraphs }],
  });

  return Packer.toBlob(doc);
}

/**
 * Generates a Word document from plain text and triggers a browser download.
 * @param text    The cover letter plain text content
 * @param stem    Filename without extension, e.g. "cover-letter-react-developer"
 */
export async function downloadAsDocx(text: string, stem: string): Promise<void> {
  const blob = await textToDocx(text);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${stem}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}
