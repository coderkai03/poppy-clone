"use client";

import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { fileKind, prettyJson, sheetPreview } from "@/lib/files";

const PREVIEW_FRAME =
  "nodrag nowheel max-h-[280px] overflow-auto rounded-md border border-border bg-background";

export function FilePreview({ name, mime, text }: { name: string; mime: string; text: string }) {
  const kind = fileKind(name, mime);

  if (!text.trim()) {
    return <p className="px-1 text-xs text-muted">This file is empty.</p>;
  }

  if (kind === "csv") return <SheetPreview text={text} delimiter="," />;
  if (kind === "tsv") return <SheetPreview text={text} delimiter={"\t"} />;
  if (kind === "markdown") {
    return (
      <div className={`${PREVIEW_FRAME} markdown-card px-2.5 py-2 text-sm leading-relaxed`}>
        <Markdown remarkPlugins={[remarkGfm]}>{text}</Markdown>
      </div>
    );
  }
  if (kind === "json") return <JsonPreview text={text} />;
  if (kind === "html") return <HtmlPreview text={text} />;

  return (
    <pre className={`${PREVIEW_FRAME} px-2.5 py-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap`}>
      {text}
    </pre>
  );
}

function SheetPreview({ text, delimiter }: { text: string; delimiter: string }) {
  const sheet = sheetPreview(text, delimiter);
  if (sheet.header.length === 0) {
    return <p className="px-1 text-xs text-muted">No rows to display.</p>;
  }

  return (
    <div className={PREVIEW_FRAME}>
      <table className="file-sheet">
        <thead>
          <tr>
            {sheet.header.map((cell, index) => (
              <th key={index}>{cell || `Col ${index + 1}`}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sheet.body.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {sheet.hiddenRows > 0 || sheet.hiddenCols > 0 ? (
        <p className="border-t border-border px-2 py-1 text-[10px] text-muted">
          {sheet.hiddenRows > 0 ? `${sheet.hiddenRows} more row${sheet.hiddenRows === 1 ? "" : "s"}` : null}
          {sheet.hiddenRows > 0 && sheet.hiddenCols > 0 ? " · " : null}
          {sheet.hiddenCols > 0 ? `${sheet.hiddenCols} more column${sheet.hiddenCols === 1 ? "" : "s"}` : null}
        </p>
      ) : null}
    </div>
  );
}

function JsonPreview({ text }: { text: string }) {
  const { formatted, valid } = prettyJson(text);
  return (
    <div className={PREVIEW_FRAME}>
      {valid ? null : (
        <p className="border-b border-border px-2 py-1 text-[10px] text-amber-300">
          Invalid JSON — showing the raw file.
        </p>
      )}
      <pre className="px-2.5 py-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap">
        {formatted}
      </pre>
    </div>
  );
}

function HtmlPreview({ text }: { text: string }) {
  return (
    <iframe
      title="HTML preview"
      sandbox=""
      srcDoc={text}
      className="nodrag nowheel h-[280px] w-full rounded-md border border-border bg-white"
    />
  );
}
