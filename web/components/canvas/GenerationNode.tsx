"use client";

import { Handle, Position, useNodeConnections, type NodeProps } from "@xyflow/react";
import { AlertCircle, Sparkles, StopCircle, Trash2 } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type { GenerationNode as GenerationNodeType } from "@/lib/canvas";
import { useCanvasStore } from "@/hooks/useCanvasStore";
import { useGenerationStream } from "@/hooks/useGenerationStream";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { Textarea } from "@/components/ui/Textarea";

export function GenerationNode({ id, data }: NodeProps<GenerationNodeType>) {
  const removeNode = useCanvasStore((state) => state.removeNode);
  const updateGenerationNode = useCanvasStore((state) => state.updateGenerationNode);
  const { generate, cancel } = useGenerationStream();

  // Live count of wired transcripts, so the button state matches the canvas.
  const connections = useNodeConnections({ id, handleType: "target" });
  const isStreaming = data.status === "streaming";

  return (
    <div className="flex w-[380px] flex-col rounded-xl border border-border bg-surface p-3 shadow-lg">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-accent">
          <Sparkles className="size-3.5" />
          Synthesis
        </div>
        <div className="flex items-center gap-1">
          <Badge>
            {connections.length} transcript{connections.length === 1 ? "" : "s"}
          </Badge>
          <button
            onClick={() => removeNode(id)}
            className="nodrag rounded p-1 text-muted transition-colors hover:bg-surface-raised hover:text-red-300"
            aria-label="Delete node"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      <Textarea
        value={data.prompt}
        onChange={(event) => updateGenerationNode(id, { prompt: event.target.value })}
        rows={2}
        placeholder="Summarise the key arguments as a bulleted brief…"
      />

      <div className="mt-2 flex gap-1.5">
        <Button
          onClick={() => void generate(id, data.prompt)}
          disabled={isStreaming || connections.length === 0}
          className="nodrag flex-1"
        >
          {isStreaming ? <Spinner className="size-3.5" /> : <Sparkles className="size-3.5" />}
          {isStreaming ? "Generating…" : data.markdown ? "Regenerate" : "Generate"}
        </Button>
        {isStreaming ? (
          <Button variant="secondary" onClick={() => cancel(id)} className="nodrag">
            <StopCircle className="size-3.5" />
            Stop
          </Button>
        ) : null}
      </div>

      {connections.length === 0 ? (
        <p className="mt-2 text-[11px] text-muted">
          Drag an edge from a transcript node into this one to give it context.
        </p>
      ) : null}

      {data.status === "error" ? (
        <div className="mt-2 flex gap-1.5 rounded-md border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-300">
          <AlertCircle className="mt-px size-3.5 shrink-0" />
          <span>{data.error}</span>
        </div>
      ) : null}

      {data.markdown ? (
        <div className="nowheel markdown-card mt-2.5 max-h-[340px] overflow-y-auto rounded-md border border-border bg-surface-raised px-2.5 py-2 text-sm leading-relaxed">
          <Markdown remarkPlugins={[remarkGfm]}>{data.markdown}</Markdown>
          {isStreaming ? (
            <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-accent align-middle" />
          ) : null}
        </div>
      ) : null}

      <Handle type="target" position={Position.Left} />
    </div>
  );
}
