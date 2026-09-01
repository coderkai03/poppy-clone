"use client";

import { useCallback, useRef } from "react";

import { isApiError } from "@/lib/schemas";
import { useCanvasStore } from "@/hooks/useCanvasStore";

interface SseFrame {
  event: string;
  data: string;
}

/**
 * Parses one SSE frame. Comment lines (the WebKit padding preamble) are
 * skipped, and multi-line data fields are concatenated per the SSE spec.
 */
function parseFrame(frame: string): SseFrame | null {
  let event = "message";
  let data = "";

  for (const line of frame.split("\n")) {
    if (line === "" || line.startsWith(":")) continue;
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) data += line.slice(5).trim();
  }

  return data ? { event, data } : null;
}

export function useGenerationStream() {
  const getInboundTranscripts = useCanvasStore((state) => state.getInboundTranscripts);
  const updateGenerationNode = useCanvasStore((state) => state.updateGenerationNode);
  const appendGenerationMarkdown = useCanvasStore(
    (state) => state.appendGenerationMarkdown,
  );

  const controllers = useRef(new Map<string, AbortController>());

  const generate = useCallback(
    async (nodeId: string, prompt: string) => {
      if (!prompt.trim()) {
        updateGenerationNode(nodeId, {
          status: "error",
          error: "Enter a prompt first.",
        });
        return;
      }

      const transcripts = getInboundTranscripts(nodeId);
      if (transcripts.length === 0) {
        updateGenerationNode(nodeId, {
          status: "error",
          error: "Connect a transcript node to this node first.",
        });
        return;
      }

      // Replacing an existing generation starts from a clean slate.
      updateGenerationNode(nodeId, {
        status: "streaming",
        markdown: "",
        error: null,
      });

      const controller = new AbortController();
      controllers.current.set(nodeId, controller);

      try {
        const response = await fetch("/api/llm", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ prompt, transcripts }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          const payload: unknown = await response.json().catch(() => null);
          updateGenerationNode(nodeId, {
            status: "error",
            error: isApiError(payload)
              ? payload.error
              : `Generation failed (${response.status}).`,
          });
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let streamError: string | null = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Frames are separated by a blank line and may straddle chunk
          // boundaries, so only complete frames are consumed here.
          let boundary = buffer.indexOf("\n\n");
          while (boundary !== -1) {
            const frame = parseFrame(buffer.slice(0, boundary));
            buffer = buffer.slice(boundary + 2);

            if (frame) {
              if (frame.event === "error") {
                try {
                  const parsed: unknown = JSON.parse(frame.data);
                  streamError = isApiError(parsed)
                    ? parsed.error
                    : "The model reported an error.";
                } catch {
                  streamError = "The model reported an error.";
                }
              } else if (frame.event === "message") {
                try {
                  const parsed = JSON.parse(frame.data) as { t?: unknown };
                  if (typeof parsed.t === "string") {
                    appendGenerationMarkdown(nodeId, parsed.t);
                  }
                } catch {
                  // A malformed token frame is not worth failing the whole stream.
                }
              }
            }

            boundary = buffer.indexOf("\n\n");
          }
        }

        if (streamError) {
          updateGenerationNode(nodeId, { status: "error", error: streamError });
        } else {
          updateGenerationNode(nodeId, { status: "done", error: null });
        }
      } catch (error) {
        // An abort is a user action, so keep whatever tokens already landed.
        if (error instanceof Error && error.name === "AbortError") {
          updateGenerationNode(nodeId, { status: "done", error: null });
          return;
        }

        updateGenerationNode(nodeId, {
          status: "error",
          error: "Network request to /api/llm failed.",
        });
      } finally {
        controllers.current.delete(nodeId);
      }
    },
    [appendGenerationMarkdown, getInboundTranscripts, updateGenerationNode],
  );

  const cancel = useCallback((nodeId: string) => {
    controllers.current.get(nodeId)?.abort();
  }, []);

  return { generate, cancel };
}
