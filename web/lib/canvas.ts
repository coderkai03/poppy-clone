import type { Node } from "@xyflow/react";

import type { Platform } from "@/lib/platform";
import type { TranscriptSource } from "@/lib/schemas";

/**
 * Node data must be declared with `type` rather than `interface`: xyflow's
 * Node<Data> constrains Data to Record<string, unknown>, and TypeScript only
 * gives implicit index signatures to type aliases, not interfaces.
 */

export type IngestStatus = "idle" | "loading" | "ready" | "error";
export type GenerationStatus = "idle" | "streaming" | "done" | "error";

export type MediaSourceNodeData = {
  url: string;
  platform: Platform;
  thumbnailUrl: string | null;
  title: string | null;
  duration: number | null;
  status: IngestStatus;
  error: string | null;
};

export type TranscriptNodeData = {
  title: string;
  text: string;
  source: TranscriptSource;
  language: string | null;
};

export type GenerationNodeData = {
  prompt: string;
  markdown: string;
  status: GenerationStatus;
  error: string | null;
};

export type MediaSourceNode = Node<MediaSourceNodeData, "mediaSource">;
export type TranscriptNode = Node<TranscriptNodeData, "transcript">;
export type GenerationNode = Node<GenerationNodeData, "generation">;

export type AppNode = MediaSourceNode | TranscriptNode | GenerationNode;

export function newNodeId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

export function formatDuration(seconds: number | null): string | null {
  if (seconds === null || !Number.isFinite(seconds) || seconds <= 0) return null;
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}
