"use client";

import { useCallback, useRef } from "react";

import { newNodeId, type GenerationNode } from "@/lib/canvas";
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

function generationNode(nodeId: string): GenerationNode | null {
  const node = useCanvasStore.getState().nodes.find((entry) => entry.id === nodeId);
  return node?.type === "generation" ? node : null;
}

export function useGenerationStream() {
  const getInboundTranscripts = useCanvasStore((state) => state.getInboundTranscripts);
  const updateGenerationNode = useCanvasStore((state) => state.updateGenerationNode);
  const appendGenerationMarkdown = useCanvasStore(
    (state) => state.appendGenerationMarkdown,
  );

  const controllers = useRef(new Map<string, AbortController>());

  const generate = useCallback(
    async (nodeId: string) => {
      const node = generationNode(nodeId);
      if (!node || node.data.status === "streaming") return;

      const prompt = (node.data.prompt ?? "").trim();
      if (!prompt) {
        updateGenerationNode(nodeId, {
          status: "error",
          error: "Type a message first.",
        });
        return;
      }

      const transcripts = getInboundTranscripts(nodeId);
      if (transcripts.length === 0) {
        updateGenerationNode(nodeId, {
          status: "error",
          error: "Connect a transcript or file to this chat first.",
        });
        return;
      }

      const previousMessages = node.data.messages ?? [];
      const userMessage = {
        id: newNodeId("msg"),
        role: "user" as const,
        content: prompt,
      };
      const assistantMessage = {
        id: newNodeId("msg"),
        role: "assistant" as const,
        content: "",
      };

      updateGenerationNode(nodeId, {
        prompt: "",
        status: "streaming",
        error: null,
        messages: [...previousMessages, userMessage, assistantMessage],
      });

      const controller = new AbortController();
      controllers.current.set(nodeId, controller);

      const restoreDraft = () => {
        updateGenerationNode(nodeId, {
          prompt,
          status: "error",
          messages: previousMessages,
        });
      };

      try {
        const response = await fetch("/api/llm", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            prompt,
            transcripts,
            history: previousMessages
              .filter((message) => message.content.trim())
              .map(({ role, content }) => ({ role, content })),
          }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          const payload: unknown = await response.json().catch(() => null);
          restoreDraft();
          updateGenerationNode(nodeId, {
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
          const latest = generationNode(nodeId);
          const last = latest?.data.messages.at(-1);
          if (
            latest &&
            last?.role === "assistant" &&
            !last.content.trim()
          ) {
            updateGenerationNode(nodeId, {
              status: "idle",
              error: null,
              messages: latest.data.messages.slice(0, -2),
              prompt,
            });
            return;
          }
          updateGenerationNode(nodeId, { status: "done", error: null });
          return;
        }

        restoreDraft();
        updateGenerationNode(nodeId, {
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
