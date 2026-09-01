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
  newNodeId,
  type AppNode,
  type GenerationNodeData,
  type MediaSourceNodeData,
  type TranscriptNodeData,
} from "@/lib/canvas";
import type { ParsedSource } from "@/lib/platform";
import type { IngestResult, TranscriptContext } from "@/lib/schemas";

const NODE_WIDTH = 280;
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
  addGenerationNode: () => string;

  updateMediaNode: (id: string, patch: Partial<MediaSourceNodeData>) => void;
  updateTranscriptNode: (id: string, patch: Partial<TranscriptNodeData>) => void;
  updateGenerationNode: (id: string, patch: Partial<GenerationNodeData>) => void;
  appendGenerationMarkdown: (id: string, chunk: string) => void;

  removeNode: (id: string) => void;
  clearCanvas: () => void;
  getInboundTranscripts: (generationNodeId: string) => TranscriptContext[];
}

/** Stacks new root-column nodes downward so they never land on top of each other. */
function nextRootPosition(nodes: AppNode[]): { x: number; y: number } {
  const rootNodes = nodes.filter((node) => node.type === "mediaSource");
  return { x: 80, y: 80 + rootNodes.length * 260 };
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
       * CLAUDE.md 6C: only a transcript may feed a generation node, since that
       * edge is what passes transcript context into the prompt payload.
       */
      onConnect: (connection) => {
        const { nodes, edges } = get();
        const source = nodes.find((node) => node.id === connection.source);
        const target = nodes.find((node) => node.id === connection.target);

        if (source?.type !== "transcript" || target?.type !== "generation") return;

        set({ edges: addEdge({ ...connection, animated: true }, edges) });
      },

      addMediaNode: (url, parsed) => {
        const id = newNodeId("media");
        const data: MediaSourceNodeData = {
          url,
          platform: parsed.platform,
          thumbnailUrl: parsed.thumbnailUrl,
          title: null,
          duration: null,
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
        const position = media
          ? { x: media.position.x + NODE_WIDTH + COLUMN_GAP, y: media.position.y }
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

      addGenerationNode: () => {
        const id = newNodeId("generation");
        const { nodes } = get();
        const rightmost = nodes.reduce(
          (max, node) => Math.max(max, node.position.x),
          0,
        );
        const generationCount = nodes.filter(
          (node) => node.type === "generation",
        ).length;

        const data: GenerationNodeData = {
          prompt: "",
          markdown: "",
          status: "idle",
          error: null,
        };

        set((state) => ({
          nodes: [
            ...state.nodes,
            {
              id,
              type: "generation",
              position: {
                x: rightmost + NODE_WIDTH + COLUMN_GAP,
                y: 80 + generationCount * 320,
              },
              data,
            } satisfies AppNode,
          ],
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

      updateGenerationNode: (id, patch) => {
        set((state) => ({
          nodes: patchNodeData(state.nodes, id, "generation", patch),
        }));
      },

      appendGenerationMarkdown: (id, chunk) => {
        set((state) => ({
          nodes: state.nodes.map((node) => {
            if (node.id !== id || node.type !== "generation") return node;
            return {
              ...node,
              data: { ...node.data, markdown: node.data.markdown + chunk },
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

      clearCanvas: () => set({ nodes: [], edges: [] }),

      getInboundTranscripts: (generationNodeId) => {
        const { nodes, edges } = get();
        const sourceIds = edges
          .filter((edge) => edge.target === generationNodeId)
          .map((edge) => edge.source);

        return nodes
          .filter(
            (node): node is Extract<AppNode, { type: "transcript" }> =>
              node.type === "transcript" && sourceIds.includes(node.id),
          )
          .map((node) => ({ title: node.data.title, text: node.data.text }));
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

          if (node.type === "generation" && node.data.status === "streaming") {
            return {
              ...node,
              data: {
                ...node.data,
                status: node.data.markdown.trim() ? "done" : "idle",
                error: null,
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
