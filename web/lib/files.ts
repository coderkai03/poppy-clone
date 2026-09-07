export const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_FILE_CHARS = 300_000;

const TEXT_EXTENSIONS = new Set([
  ".txt",
  ".md",
  ".markdown",
  ".csv",
  ".tsv",
  ".json",
  ".html",
  ".htm",
  ".xml",
  ".log",
  ".yml",
  ".yaml",
  ".rst",
  ".tex",
  ".ini",
  ".cfg",
  ".pdf",
]);

export const FILE_ACCEPT = [...TEXT_EXTENSIONS].join(",");

export type FileKind =
  | "csv"
  | "tsv"
  | "markdown"
  | "json"
  | "html"
  | "xml"
  | "yaml"
  | "pdf"
  | "text";

export const FILE_KIND_LABEL: Record<FileKind, string> = {
  csv: "CSV",
  tsv: "TSV",
  markdown: "Markdown",
  json: "JSON",
  html: "HTML",
  xml: "XML",
  yaml: "YAML",
  pdf: "PDF",
  text: "Text",
};

export function fileKind(name: string, mime: string): FileKind {
  const ext = extensionOf(name);
  if (ext === ".csv" || mime === "text/csv") return "csv";
  if (ext === ".tsv" || mime === "text/tab-separated-values") return "tsv";
  if (ext === ".md" || ext === ".markdown") return "markdown";
  if (ext === ".json" || mime === "application/json") return "json";
  if (ext === ".html" || ext === ".htm" || mime.startsWith("text/html")) return "html";
  if (ext === ".xml" || mime === "application/xml" || mime === "text/xml") return "xml";
  if (ext === ".yml" || ext === ".yaml") return "yaml";
  if (ext === ".pdf" || mime === "application/pdf") return "pdf";
  return "text";
}

export function fileNodeWidth(kind: FileKind): number {
  if (kind === "csv" || kind === "tsv") return 480;
  if (kind === "pdf") return 400;
  if (kind === "text") return 320;
  return 380;
}

export function isPdf(file: File): boolean {
  return extensionOf(file.name) === ".pdf" || file.type === "application/pdf";
}

export type FileReadOk = {
  ok: true;
  name: string;
  mime: string;
  size: number;
  text: string;
  truncated: boolean;
};

export type FileReadErr = { ok: false; error: string };
export type FileReadResult = FileReadOk | FileReadErr;

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot).toLowerCase();
}

export function isSupportedTextFile(file: File): boolean {
  if (file.type.startsWith("text/") || file.type === "application/json") return true;
  if (file.type === "application/pdf") return true;
  return TEXT_EXTENSIONS.has(extensionOf(file.name));
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10_240 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function looksLikeText(text: string): boolean {
  const sample = text.slice(0, 8000);
  if (!sample) return true;
  const nuls = (sample.match(/\0/g) ?? []).length;
  const replacement = (sample.match(/\uFFFD/g) ?? []).length;
  return nuls === 0 && replacement / sample.length < 0.05;
}

export async function readTextUpload(file: File): Promise<FileReadResult> {
  if (file.size > MAX_FILE_BYTES) {
    return {
      ok: false,
      error: `"${file.name}" is over ${formatFileSize(MAX_FILE_BYTES)}. Use a smaller file.`,
    };
  }

  if (isPdf(file)) {
    return readPdfUpload(file);
  }

  if (!isSupportedTextFile(file)) {
    return {
      ok: false,
      error: "Upload a text file (.txt, .md, .csv, .json, .html, .xml, .log, .pdf).",
    };
  }

  let text: string;
  try {
    text = await file.text();
  } catch {
    return { ok: false, error: `Could not read "${file.name}".` };
  }

  if (!looksLikeText(text)) {
    return {
      ok: false,
      error: `"${file.name}" doesn't look like text. Try exporting it as UTF-8.`,
    };
  }

  const truncated = text.length > MAX_FILE_CHARS;
  return {
    ok: true,
    name: file.name,
    mime: file.type || "text/plain",
    size: file.size,
    text: truncated ? text.slice(0, MAX_FILE_CHARS) : text,
    truncated,
  };
}

async function readPdfUpload(file: File): Promise<FileReadResult> {
  let text: string;
  try {
    const { extractPdfText } = await import("@/lib/pdf");
    text = await extractPdfText(file);
  } catch {
    return {
      ok: false,
      error: `Could not extract text from "${file.name}". The file may be corrupt.`,
    };
  }

  if (!text.trim()) {
    return {
      ok: false,
      error: `"${file.name}" has no selectable text. It may be a scanned document — OCR support is planned but not available yet.`,
    };
  }

  const truncated = text.length > MAX_FILE_CHARS;
  return {
    ok: true,
    name: file.name,
    mime: file.type || "application/pdf",
    size: file.size,
    text: truncated ? text.slice(0, MAX_FILE_CHARS) : text,
    truncated,
  };
}

const MAX_SHEET_ROWS = 80;
const MAX_SHEET_COLS = 24;

/** RFC4180-ish split for preview tables. Not a full CSV library. */
export function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const src = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === delimiter) {
      row.push(cell);
      cell = "";
      continue;
    }
    if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += ch;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((entry) => entry.some((value) => value.length > 0));
}

export function sheetPreview(text: string, delimiter: string): {
  header: string[];
  body: string[][];
  hiddenRows: number;
  hiddenCols: number;
} {
  const rows = parseDelimited(text, delimiter);
  if (rows.length === 0) return { header: [], body: [], hiddenRows: 0, hiddenCols: 0 };

  const colCount = rows.reduce((max, row) => Math.max(max, row.length), 0);
  const clippedCols = Math.min(colCount, MAX_SHEET_COLS);
  const pad = (row: string[]) => {
    const next = row.slice(0, clippedCols);
    while (next.length < clippedCols) next.push("");
    return next;
  };

  const [first, ...rest] = rows;
  const visible = rest.slice(0, MAX_SHEET_ROWS).map(pad);
  return {
    header: pad(first ?? []),
    body: visible,
    hiddenRows: Math.max(0, rest.length - visible.length),
    hiddenCols: Math.max(0, colCount - clippedCols),
  };
}

export function prettyJson(text: string): { formatted: string; valid: boolean } {
  try {
    return { formatted: JSON.stringify(JSON.parse(text), null, 2), valid: true };
  } catch {
    return { formatted: text, valid: false };
  }
}
