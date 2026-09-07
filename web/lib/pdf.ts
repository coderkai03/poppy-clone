/**
 * Client-side PDF text extraction using Mozilla's pdf.js.
 *
 * Text is pulled from each page via getTextContent(). This works for PDFs that
 * contain selectable text (the vast majority of documents). Scanned/image-only
 * PDFs produce empty strings — the caller should check for that and surface a
 * helpful message.
 */

import { getDocument, GlobalWorkerOptions, version } from "pdfjs-dist";

let workerReady = false;

function ensureWorker() {
  if (workerReady) return;
  GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.mjs`;
  workerReady = true;
}

/**
 * Extracts all selectable text from a PDF file.
 *
 * Returns one string with page breaks represented as double newlines.
 * Throws on corrupt/unreadable PDFs.
 */
export async function extractPdfText(file: File): Promise<string> {
  ensureWorker();

  const buffer = await file.arrayBuffer();
  const pdf = await getDocument({ data: buffer }).promise;

  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .filter((item) => "str" in item)
      .map((item) => (item as { str: string }).str)
      .join(" ");
    if (text.trim()) pages.push(text);
  }

  return pages.join("\n\n");
}
