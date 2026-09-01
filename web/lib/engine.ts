/**
 * Shared plumbing for the two route handlers that call the FastAPI engine.
 * Both /api/ingest and /api/llm need the same config check, the same shared
 * secret header and the same error translation, so it lives here once.
 */

export interface EngineConfig {
  url: string;
  secret: string;
}

/** Reads and validates the engine config, or returns the error to send back. */
export function readEngineConfig(): { config: EngineConfig } | { error: string } {
  const url = process.env.MAC_MINI_URL;
  const secret = process.env.MAC_API_SECRET;

  if (!url || !secret) {
    return {
      error:
        "Engine is not configured. Set MAC_MINI_URL and MAC_API_SECRET in web/.env.local.",
    };
  }

  return { config: { url: url.replace(/\/+$/, ""), secret } };
}

/** CLAUDE.md 6B: shared-secret auth on every engine call. */
export function engineHeaders(secret: string): HeadersInit {
  return { "content-type": "application/json", "x-secret-key": secret };
}

/** FastAPI reports errors as {"detail": "..."} — surface that, not a generic 500. */
function engineErrorMessage(payload: unknown, status: number): string {
  if (typeof payload === "object" && payload !== null) {
    const detail = (payload as { detail?: unknown }).detail;
    if (typeof detail === "string" && detail.trim()) return detail;
  }
  return `Engine returned ${status}.`;
}

/**
 * Maps an engine failure onto a response for the browser. A 401 means *our*
 * secret is wrong, which is a server misconfiguration rather than something the
 * browser should retry with credentials — so it is reported as a 500.
 */
export function translateEngineFailure(
  payload: unknown,
  status: number,
): { message: string; status: number } {
  if (status === 401) {
    return {
      message:
        "Engine rejected the shared secret. MAC_API_SECRET must match on both sides.",
      status: 500,
    };
  }

  return { message: engineErrorMessage(payload, status), status };
}
