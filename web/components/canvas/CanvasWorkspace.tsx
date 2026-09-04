"use client";

import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  type NodeTypes,
} from "@xyflow/react";
import Link from "next/link";

import { useCanvasStore } from "@/hooks/useCanvasStore";
import { GenerationNode } from "@/components/canvas/GenerationNode";
import { MediaSourceNode } from "@/components/canvas/MediaSourceNode";
import { TranscriptNode } from "@/components/canvas/TranscriptNode";
import { Toolbar } from "@/components/canvas/Toolbar";

// Declared at module scope: a fresh object each render would remount every node.
const nodeTypes: NodeTypes = {
  mediaSource: MediaSourceNode,
  transcript: TranscriptNode,
  generation: GenerationNode,
};

function Flow() {
  const nodes = useCanvasStore((state) => state.nodes);
  const edges = useCanvasStore((state) => state.edges);
  const onNodesChange = useCanvasStore((state) => state.onNodesChange);
  const onEdgesChange = useCanvasStore((state) => state.onEdgesChange);
  const onConnect = useCanvasStore((state) => state.onConnect);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      fitView
      minZoom={0.2}
      maxZoom={1.8}
      proOptions={{ hideAttribution: true }}
      colorMode="dark"
    >
      <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#2a2f3c" />
      <Controls position="bottom-right" showInteractive={false} />
      <MiniMap
        position="bottom-left"
        pannable
        zoomable
        maskColor="rgba(11, 13, 18, 0.7)"
        nodeColor="#2a2f3c"
      />

      <Panel position="top-center">
        <Toolbar />
      </Panel>

      <Panel position="top-left">
        <Link
          href="/"
          className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-muted transition-colors hover:text-foreground"
        >
          ← Home
        </Link>
      </Panel>

      {nodes.length === 0 ? (
        <Panel position="top-center" className="!top-24">
          <p className="max-w-sm text-center text-sm text-muted">
            Paste a video link above. You&apos;ll get a media card and a transcript,
            then hover the transcript&apos;s plus and click Chat to synthesise it.
          </p>
        </Panel>
      ) : null}
    </ReactFlow>
  );
}

export default function CanvasWorkspace() {
  return (
    <div className="h-dvh w-full">
      <ReactFlowProvider>
        <Flow />
      </ReactFlowProvider>
    </div>
  );
}
