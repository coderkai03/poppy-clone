/**
 * Wire contracts shared between the browser, the Next route handlers and the
 * FastAPI engine. These mirror engine/models.py — change both together.
 */

export type TranscriptSource = "captions" | "whisper";

export interface IngestRequestBody {
  url: string;
}

/** Response body of POST /api/ingest, proxied verbatim from the engine. */
export interface IngestResult {
  text: string;
  source: TranscriptSource;
  platform: string;
  title: string | null;
  duration: number | null;
  language: string | null;
  thumbnail: string | null;
}

export interface TranscriptContext {
  title: string;
  text: string;
}

export interface LlmRequestBody {
  prompt: string;
  transcripts: TranscriptContext[];
}

export interface ApiError {
  error: string;
}

/**
 * Note: transcript trimming moved to the engine (MAX_CONTEXT_CHARS in
 * engine/services/llm.py) along with the prompt building, now that generation
 * runs against a local model instead of OpenRouter.
 */

export function isApiError(value: unknown): value is ApiError {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { error?: unknown }).error === "string"
  );
}

function isTranscriptContext(value: unknown): value is TranscriptContext {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { title?: unknown; text?: unknown };
  return typeof candidate.title === "string" && typeof candidate.text === "string";
}

/** Runtime guard for the /api/llm body — route handlers receive untrusted JSON. */
export function parseLlmRequestBody(value: unknown): LlmRequestBody | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as { prompt?: unknown; transcripts?: unknown };

  if (typeof candidate.prompt !== "string" || candidate.prompt.trim() === "") return null;
  if (!Array.isArray(candidate.transcripts)) return null;
  if (!candidate.transcripts.every(isTranscriptContext)) return null;

  return { prompt: candidate.prompt, transcripts: candidate.transcripts };
}

export function parseIngestRequestBody(value: unknown): IngestRequestBody | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as { url?: unknown };
  if (typeof candidate.url !== "string" || candidate.url.trim() === "") return null;
  return { url: candidate.url.trim() };
}
