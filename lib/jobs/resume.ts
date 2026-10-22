import "server-only";
import { extractText, getDocumentProxy } from "unpdf";

export const RESUME_PDF_MAX_BYTES = 5 * 1024 * 1024;

/** Plain text from a text-based PDF (scanned/image PDFs yield little or no text). */
export async function extractPdfText(bytes: Uint8Array) {
  const pdf = await getDocumentProxy(bytes);
  const { totalPages, text } = await extractText(pdf, { mergePages: true });
  const clean = text
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { text: clean, pages: totalPages };
}
