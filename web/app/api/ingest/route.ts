import { NextResponse } from "next/server";

import {
  engineHeaders,
  readEngineConfig,
  translateEngineFailure,
} from "@/lib/engine";
import { isSupportedSourceUrl } from "@/lib/platform";
import { parseIngestRequestBody } from "@/lib/schemas";

/**
 * Whisper transcription of a several-minute video takes well over the default
 * serverless budget, so this route asks the host for the full 60s that
 * CLAUDE.md 7 specifies. Next does not enforce this itself.
 */
export const maxDuration = 60;

const ENGINE_TIMEOUT_MS = 60_000;

export async function POST(request: Request) {
  const engine = readEngineConfig();
  if ("error" in engine) {
    return NextResponse.json({ error: engine.error }, { status: 500 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const body = parseIngestRequestBody(raw);
  if (!body) {
    return NextResponse.json(
      { error: "Expected a body of the shape { url: string }." },
      { status: 400 },
    );
  }

  if (!isSupportedSourceUrl(body.url)) {
    return NextResponse.json(
      { error: "Only YouTube, TikTok and Instagram URLs are supported." },
      { status: 400 },
    );
  }

  try {
    const response = await fetch(`${engine.config.url}/ingest`, {
      method: "POST",
      headers: engineHeaders(engine.config.secret),
      body: JSON.stringify({ url: body.url }),
      cache: "no-store",
      signal: AbortSignal.timeout(ENGINE_TIMEOUT_MS),
    });

    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      const { message, status } = translateEngineFailure(payload, response.status);
      return NextResponse.json({ error: message }, { status });
    }

    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return NextResponse.json(
        { error: "Ingestion timed out after 60s. Try a shorter video." },
        { status: 504 },
      );
    }

    return NextResponse.json(
      {
        error:
          "Could not reach the ingestion engine. Is it running, and is MAC_MINI_URL current?",
      },
      { status: 502 },
    );
  }
}
