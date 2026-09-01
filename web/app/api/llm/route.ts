import { NextResponse } from "next/server";

import {
  engineHeaders,
  readEngineConfig,
  translateEngineFailure,
} from "@/lib/engine";
import { parseLlmRequestBody } from "@/lib/schemas";

/**
 * Generation now runs on a locally hosted model behind the FastAPI engine, so
 * this route is a streaming proxy rather than an LLM client. It exists purely so
 * MAC_API_SECRET stays server-side: the browser cannot be trusted with the
 * header that authenticates against the engine.
 */

/**
 * A local ~4B model on an integrated GPU generates at roughly 15-25 tok/s, so a
 * 1024-token answer can run past a minute — well past the 60s the ingest route
 * needs. Hobby-tier Vercel caps this at 60; the app already requires a reachable
 * local engine, so it is expected to run somewhere that honours the larger value.
 */
export const maxDuration = 300;

export async function POST(request: Request) {
  // Everything that can produce a non-200 must happen before the stream opens:
  // once the first chunk is enqueued the status and headers are already sent.
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const body = parseLlmRequestBody(raw);
  if (!body) {
    return NextResponse.json(
      {
        error:
          "Expected { prompt: string, transcripts: { title: string, text: string }[] }.",
      },
      { status: 400 },
    );
  }

  if (body.transcripts.length === 0) {
    return NextResponse.json(
      { error: "Connect at least one transcript node before generating." },
      { status: 400 },
    );
  }

  const engine = readEngineConfig();
  if ("error" in engine) {
    return NextResponse.json({ error: engine.error }, { status: 500 });
  }

  let response: Response;
  try {
    response = await fetch(`${engine.config.url}/llm`, {
      method: "POST",
      headers: engineHeaders(engine.config.secret),
      body: JSON.stringify(body),
      cache: "no-store",
      // Forwarding the client's signal is what makes cancelling a node stop the
      // GPU work, instead of leaving the model generating into a dead socket.
      // Note there is deliberately no overall timeout here: AbortSignal.timeout
      // would also abort the response body, killing a legitimately slow stream.
      signal: request.signal,
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "Could not reach the ingestion engine. Is it running, and is MAC_MINI_URL current?",
      },
      { status: 502 },
    );
  }

  if (!response.ok || !response.body) {
    const payload: unknown = await response.json().catch(() => null);
    const { message, status } = translateEngineFailure(payload, response.status);
    return NextResponse.json({ error: message }, { status });
  }

  // Pass the engine's SSE body through untouched — it already emits the WebKit
  // padding preamble and the token/done/error frames the client parses.
  return new Response(response.body, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
