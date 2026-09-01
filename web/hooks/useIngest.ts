"use client";

import { useCallback } from "react";

import { parseSourceUrl } from "@/lib/platform";
import { isApiError, type IngestResult } from "@/lib/schemas";
import { useCanvasStore } from "@/hooks/useCanvasStore";

function errorMessage(payload: unknown, fallback: string): string {
  return isApiError(payload) ? payload.error : fallback;
}

export function useIngest() {
  const addMediaNode = useCanvasStore((state) => state.addMediaNode);
  const addTranscriptNode = useCanvasStore((state) => state.addTranscriptNode);
  const updateMediaNode = useCanvasStore((state) => state.updateMediaNode);

  /** Runs the request for an existing media node and spawns its transcript. */
  const run = useCallback(
    async (mediaNodeId: string, url: string) => {
      const parsed = parseSourceUrl(url);
      updateMediaNode(mediaNodeId, { status: "loading", error: null });

      try {
        const response = await fetch("/api/ingest", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ url }),
        });

        const payload: unknown = await response.json().catch(() => null);

        if (!response.ok) {
          updateMediaNode(mediaNodeId, {
            status: "error",
            error: errorMessage(payload, `Ingestion failed (${response.status}).`),
          });
          return;
        }

        const result = payload as IngestResult;

        updateMediaNode(mediaNodeId, {
          status: "ready",
          error: null,
          title: result.title,
          duration: result.duration,
          // Prefer our own derived thumbnail; fall back to whatever yt-dlp found.
          thumbnailUrl: parsed?.thumbnailUrl ?? result.thumbnail,
        });

        addTranscriptNode(mediaNodeId, result);
      } catch {
        updateMediaNode(mediaNodeId, {
          status: "error",
          error: "Network request to /api/ingest failed.",
        });
      }
    },
    [addTranscriptNode, updateMediaNode],
  );

  /** Creates the media node, then ingests into it. Returns false if the URL is unsupported. */
  const ingest = useCallback(
    (url: string): boolean => {
      const parsed = parseSourceUrl(url);
      if (!parsed) return false;

      const mediaNodeId = addMediaNode(url, parsed);
      void run(mediaNodeId, url);
      return true;
    },
    [addMediaNode, run],
  );

  const retry = useCallback(
    (mediaNodeId: string, url: string) => {
      void run(mediaNodeId, url);
    },
    [run],
  );

  return { ingest, retry };
}
