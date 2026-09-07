"use client";

import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
  GENERATION_NODE_HEIGHT,
  GENERATION_NODE_WIDTH,
  MEDIA_NODE_MAX_WIDTH,
  newNodeId,
  normalizeGenerationData,
  type AppNode,
  type FileNodeData,
  type GenerationNodeData,
  type MediaSourceNodeData,
  type TranscriptNodeData,
} from "@/lib/canvas";
import type { ParsedSource } from "@/lib/platform";
import type { IngestResult, TranscriptContext } from "@/lib/schemas";

const NODE_WIDTH = 280;
const TRANSCRIPT_NODE_WIDTH = 320;
const COLUMN_GAP = 80;

interface CanvasState {
  nodes: AppNode[];
  edges: Edge[];

  onNodesChange: (changes: NodeChange<AppNode>[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;

  addMediaNode: (url: string, parsed: ParsedSource) => string;
  /** Creates a transcript node already wired to the media node it came from. */
  addTranscriptNode: (mediaNodeId: string, result: IngestResult) => string;
  addFileNode: (file: FileNodeData) => string;
  /** Toolbar: unwired. Transcript/file Chat: already connected to that source. */
  addGenerationNode: (sourceId?: string) => string;

  updateMediaNode: (id: string, patch: Partial<MediaSourceNodeData>) => void;
  updateTranscriptNode: (id: string, patch: Partial<TranscriptNodeData>) => void;
  updateFileNode: (id: string, patch: Partial<FileNodeData>) => void;
  updateGenerationNode: (id: string, patch: Partial<GenerationNodeData>) => void;
  appendGenerationMarkdown: (id: string, chunk: string) => void;

  removeNode: (id: string) => void;
  removeEdge: (edgeId: string) => void;
  clearCanvas: () => void;
  getInboundTranscripts: (generationNodeId: string) => TranscriptContext[];
}

/** Stacks new root-column nodes downward so they never land on top of each other. */
function nextRootPosition(nodes: AppNode[]): { x: number; y: number } {
  const rootNodes = nodes.filter(
    (node) => node.type === "mediaSource" || node.type === "file",
  );
  if (rootNodes.length === 0) return { x: 80, y: 80 };
  const last = rootNodes[rootNodes.length - 1];
  const lastHeight = last.measured?.height ?? last.height ?? 220;
  return { x: 80, y: last.position.y + lastHeight + 40 };
}

function patchNodeData(
  nodes: AppNode[],
  id: string,
  type: AppNode["type"],
  patch: Record<string, unknown>,
): AppNode[] {
  return nodes.map((node) => {
    if (node.id !== id || node.type !== type) return node;
    return { ...node, data: { ...node.data, ...patch } } as AppNode;
  });
}

export const useCanvasStore = create<CanvasState>()(
  persist(
    (set, get) => ({
      nodes: [],
      edges: [],

      onNodesChange: (changes) => {
        set({ nodes: applyNodeChanges(changes, get().nodes) });
      },

      onEdgesChange: (changes) => {
        set({ edges: applyEdgeChanges(changes, get().edges) });
      },

      /**
       * Context sources: transcript or file → chat. Media cards still feed
       * transcripts, so that edge is allowed too (needed after a disconnect).
       */
      onConnect: (connection) => {
        const { nodes, edges } = get();
        const source = nodes.find((node) => node.id === connection.source);
        const target = nodes.find((node) => node.id === connection.target);
        if (!source || !target) return;

        const toChat =
          (source.type === "transcript" || source.type === "file") &&
          target.type === "generation";
        const mediaToTranscript =
          source.type === "mediaSource" && target.type === "transcript";
        if (!toChat && !mediaToTranscript) return;

        const duplicate = edges.some(
          (edge) =>
            edge.source === connection.source && edge.target === connection.target,
        );
        if (duplicate) return;

        set({
          edges: addEdge(
            { ...connection, animated: toChat },
            edges,
          ),
        });
      },

      addMediaNode: (url, parsed) => {
        const id = newNodeId("media");
        const data: MediaSourceNodeData = {
          url,
          platform: parsed.platform,
          thumbnailUrl: parsed.thumbnailUrl,
          thumbnailNaturalWidth: null,
          thumbnailNaturalHeight: null,
          title: null,
          duration: null,
          author: null,
          publishedAt: null,
          viewCount: null,
          status: "loading",
          error: null,
        };

        set((state) => ({
          nodes: [
            ...state.nodes,
            {
              id,
              type: "mediaSource",
              position: nextRootPosition(state.nodes),
              data,
            } satisfies AppNode,
          ],
        }));

        return id;
      },

      addTranscriptNode: (mediaNodeId, result) => {
        const id = newNodeId("transcript");
        const media = get().nodes.find((node) => node.id === mediaNodeId);
        const mediaWidth =
          media?.measured?.width ?? media?.width ?? MEDIA_NODE_MAX_WIDTH + 32;
        const position = media
          ? { x: media.position.x + mediaWidth + COLUMN_GAP, y: media.position.y }
          : nextRootPosition(get().nodes);

        const data: TranscriptNodeData = {
          title: result.title ?? "Untitled",
          text: result.text,
          source: result.source,
          language: result.language,
        };

        set((state) => ({
          nodes: [
            ...state.nodes,
            { id, type: "transcript", position, data } satisfies AppNode,
          ],
          edges: [
            ...state.edges,
            {
              id: mediaNodeId + "->" + id,
              source: mediaNodeId,
              target: id,
            },
          ],
        }));

        return id;
      },

      addFileNode: (file) => {
        const id = newNodeId("file");
        const position = nextRootPosition(get().nodes);

        set((state) => ({
          nodes: [
            ...state.nodes,
            {
              id,
              type: "file",
              position,
              data: file,
            } satisfies AppNode,
          ],
        }));

        return id;
      },

      addGenerationNode: (sourceId) => {
        const id = newNodeId("generation");
        const { nodes } = get();
        const source = sourceId
          ? nodes.find((node) => node.id === sourceId)
          : undefined;

        const data: GenerationNodeData = {
          prompt: "",
          messages: [],
          status: "idle",
          error: null,
        };

        let position: { x: number; y: number };
        if (source) {
          const sourceWidth =
            source.measured?.width ?? source.width ?? TRANSCRIPT_NODE_WIDTH;
          position = {
            x: source.position.x + sourceWidth + COLUMN_GAP,
            y: source.position.y,
          };
        } else {
          const rightmost = nodes.reduce(
            (max, node) => Math.max(max, node.position.x),
            0,
          );
          const generationCount = nodes.filter(
            (node) => node.type === "generation",
          ).length;
          position = {
            x: rightmost + NODE_WIDTH + COLUMN_GAP,
            y: 80 + generationCount * (GENERATION_NODE_HEIGHT + 40),
          };
        }

        const wired =
          source?.type === "transcript" || source?.type === "file"
            ? {
                id: source.id + "->" + id,
                source: source.id,
                target: id,
                animated: true,
              }
            : null;

        set((state) => ({
          nodes: [
            ...state.nodes,
            {
              id,
              type: "generation",
              position,
              data,
              width: GENERATION_NODE_WIDTH,
              height: GENERATION_NODE_HEIGHT,
              style: {
                width: GENERATION_NODE_WIDTH,
                height: GENERATION_NODE_HEIGHT,
              },
            } satisfies AppNode,
          ],
          edges: wired ? [...state.edges, wired] : state.edges,
        }));

        return id;
      },

      updateMediaNode: (id, patch) => {
        set((state) => ({
          nodes: patchNodeData(state.nodes, id, "mediaSource", patch),
        }));
      },

      updateTranscriptNode: (id, patch) => {
        set((state) => ({
          nodes: patchNodeData(state.nodes, id, "transcript", patch),
        }));
      },

      updateFileNode: (id, patch) => {
        set((state) => ({
          nodes: patchNodeData(state.nodes, id, "file", patch),
        }));
      },

      updateGenerationNode: (id, patch) => {
        set((state) => ({
          nodes: patchNodeData(state.nodes, id, "generation", patch),
        }));
      },

      appendGenerationMarkdown: (id, chunk) => {
        set((state) => ({
          nodes: state.nodes.map((node) => {
            if (node.id !== id || node.type !== "generation") return node;
            const messages = node.data.messages;
            const last = messages[messages.length - 1];
            if (!last || last.role !== "assistant") return node;
            return {
              ...node,
              data: {
                ...node.data,
                messages: [
                  ...messages.slice(0, -1),
                  { ...last, content: last.content + chunk },
                ],
              },
            };
          }),
        }));
      },

      removeNode: (id) => {
        set((state) => ({
          nodes: state.nodes.filter((node) => node.id !== id),
          edges: state.edges.filter(
            (edge) => edge.source !== id && edge.target !== id,
          ),
        }));
      },

      removeEdge: (edgeId) => {
        set((state) => ({
          edges: state.edges.filter((edge) => edge.id !== edgeId),
        }));
      },

      clearCanvas: () => set({ nodes: [], edges: [] }),

      getInboundTranscripts: (generationNodeId) => {
        const { nodes, edges } = get();
        const sourceIds = edges
          .filter((edge) => edge.target === generationNodeId)
          .map((edge) => edge.source);

        return nodes.flatMap((node): TranscriptContext[] => {
          if (!sourceIds.includes(node.id)) return [];
          if (node.type === "transcript") {
            return [{ title: node.data.title, text: node.data.text }];
          }
          if (node.type === "file") {
            return [{ title: node.data.name, text: node.data.text }];
          }
          return [];
        }).filter((entry) => entry.text.trim().length > 0);
      },
    }),
    {
      name: "poppy-canvas",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ nodes: state.nodes, edges: state.edges }),
      /**
       * A reload aborts any in-flight ingest or stream, so rehydrated nodes are
       * repaired here rather than restoring a spinner that will never resolve.
       */
      merge: (persisted, current) => {
        const saved = persisted as Partial<Pick<CanvasState, "nodes" | "edges">>;

        const nodes = (saved.nodes ?? []).map((node): AppNode => {
          if (node.type === "mediaSource" && node.data.status === "loading") {
            return {
              ...node,
              data: {
                ...node.data,
                status: "error",
                error: "Ingestion was interrupted by a page reload.",
              },
            };
          }

          if (node.type === "generation") {
            const data = normalizeGenerationData(
              node.data as GenerationNodeData & { markdown?: string },
            );
            const last = data.messages[data.messages.length - 1];
            const interrupted = data.status === "streaming";
            const hasReply =
              last?.role === "assistant" && last.content.trim().length > 0;

            return {
              ...node,
              width: node.width ?? GENERATION_NODE_WIDTH,
              height: node.height ?? GENERATION_NODE_HEIGHT,
              style: {
                ...node.style,
                width: node.width ?? node.style?.width ?? GENERATION_NODE_WIDTH,
                height:
                  node.height ?? node.style?.height ?? GENERATION_NODE_HEIGHT,
              },
              data: {
                ...data,
                status: interrupted ? (hasReply ? "done" : "idle") : data.status,
                error: interrupted ? null : data.error,
              },
            };
          }

          return node;
        });

        return { ...current, nodes, edges: saved.edges ?? [] };
      },
    },
  ),
);
