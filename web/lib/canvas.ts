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
export type ChatRole = "user" | "assistant";

export const GENERATION_NODE_WIDTH = 520;
export const GENERATION_NODE_HEIGHT = 580;
export const GENERATION_NODE_MIN_WIDTH = 400;
export const GENERATION_NODE_MIN_HEIGHT = 420;

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
};

export const MEDIA_NODE_MAX_WIDTH = 300;
export const MEDIA_NODE_MIN_WIDTH = 180;
export const MEDIA_THUMB_MAX_HEIGHT = 420;
export const MEDIA_THUMB_FALLBACK = {
  width: 280,
  height: Math.round(280 * 9 / 16),
} as const;

export type MediaSourceNodeData = {
  url: string;
  platform: Platform;
  thumbnailUrl: string | null;
  thumbnailNaturalWidth: number | null;
  thumbnailNaturalHeight: number | null;
  title: string | null;
  duration: number | null;
  author: string | null;
  publishedAt: string | null;
  viewCount: number | null;
  status: IngestStatus;
  error: string | null;
};

/** Display size for a media thumbnail that preserves aspect ratio. */
export function mediaThumbFrame(
  naturalWidth: number,
  naturalHeight: number,
): { width: number; height: number } {
  if (naturalWidth <= 0 || naturalHeight <= 0) return MEDIA_THUMB_FALLBACK;

  const aspect = naturalWidth / naturalHeight;
  let width = MEDIA_NODE_MAX_WIDTH;
  let height = width / aspect;

  if (height > MEDIA_THUMB_MAX_HEIGHT) {
    height = MEDIA_THUMB_MAX_HEIGHT;
    width = height * aspect;
  }

  if (width < MEDIA_NODE_MIN_WIDTH) {
    width = MEDIA_NODE_MIN_WIDTH;
    height = width / aspect;
    if (height > MEDIA_THUMB_MAX_HEIGHT) {
      height = MEDIA_THUMB_MAX_HEIGHT;
      width = Math.max(160, height * aspect);
    }
  }

  return { width: Math.round(width), height: Math.round(height) };
}

export type TranscriptNodeData = {
  title: string;
  text: string;
  source: TranscriptSource;
  language: string | null;
};

export type GenerationNodeData = {
  /** Draft text sitting in the composer; not yet a chat turn. */
  prompt: string;
  messages: ChatMessage[];
  status: GenerationStatus;
  error: string | null;
};

export type FileNodeData = {
  name: string;
  mime: string;
  size: number;
  text: string;
  truncated: boolean;
};

export type MediaSourceNode = Node<MediaSourceNodeData, "mediaSource">;
export type TranscriptNode = Node<TranscriptNodeData, "transcript">;
export type FileNode = Node<FileNodeData, "file">;
export type GenerationNode = Node<GenerationNodeData, "generation">;

export type AppNode = MediaSourceNode | TranscriptNode | FileNode | GenerationNode;

export function newNodeId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function isChatRole(value: unknown): value is ChatRole {
  return value === "user" || value === "assistant";
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { id?: unknown; role?: unknown; content?: unknown };
  return (
    typeof candidate.id === "string" &&
    isChatRole(candidate.role) &&
    typeof candidate.content === "string"
  );
}

/**
 * Rehydrates generation-node data from localStorage. Older canvases stored a
 * single `prompt` + `markdown` pair; those become one user/assistant turn.
 */
export function normalizeGenerationData(
  data: GenerationNodeData & { markdown?: string },
): GenerationNodeData {
  const prompt = typeof data.prompt === "string" ? data.prompt : "";
  const status: GenerationStatus =
    data.status === "idle" ||
    data.status === "streaming" ||
    data.status === "done" ||
    data.status === "error"
      ? data.status
      : "idle";
  const error = typeof data.error === "string" ? data.error : null;

  if (Array.isArray(data.messages) && data.messages.every(isChatMessage)) {
    return { prompt, messages: data.messages, status, error };
  }

  const markdown = typeof data.markdown === "string" ? data.markdown : "";
  const messages: ChatMessage[] = [];

  if (markdown.trim()) {
    if (prompt.trim()) {
      messages.push({ id: newNodeId("msg"), role: "user", content: prompt });
    }
    messages.push({ id: newNodeId("msg"), role: "assistant", content: markdown });
    return { prompt: "", messages, status, error };
  }

  return { prompt, messages, status, error };
}

export function formatDuration(seconds: number | null | undefined): string | null {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

/** ISO date (`YYYY-MM-DD`) from the engine, shown in the viewer's locale. */
export function formatPublishedAt(isoDate: string | null | undefined): string | null {
  if (!isoDate) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!match) return isoDate;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function formatCount(value: number | null | undefined): string | null {
  if (value === null || value === undefined || !Number.isFinite(value) || value < 0) {
    return null;
  }
  const abs = Math.abs(value);
  if (abs < 1000) return Math.round(value).toLocaleString();

  const units: [number, string][] = [
    [1_000_000_000, "B"],
    [1_000_000, "M"],
    [1_000, "K"],
  ];
  for (const [divisor, suffix] of units) {
    if (abs >= divisor) {
      const scaled = value / divisor;
      const digits = scaled >= 10 ? 0 : 1;
      return `${scaled.toFixed(digits).replace(/\.0$/, "")}${suffix}`;
    }
  }
  return Math.round(value).toLocaleString();
}
