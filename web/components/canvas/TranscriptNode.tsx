"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Captions, Mic, Trash2 } from "lucide-react";

import type { TranscriptNode as TranscriptNodeType } from "@/lib/canvas";
import { useCanvasStore } from "@/hooks/useCanvasStore";
import { Badge } from "@/components/ui/Badge";
import { Textarea } from "@/components/ui/Textarea";

export function TranscriptNode({ id, data }: NodeProps<TranscriptNodeType>) {
  const removeNode = useCanvasStore((state) => state.removeNode);
  const updateTranscriptNode = useCanvasStore((state) => state.updateTranscriptNode);

  const wordCount = data.text.trim() ? data.text.trim().split(/\s+/).length : 0;
  const SourceIcon = data.source === "captions" ? Captions : Mic;

  return (
    <div className="w-[320px] rounded-xl border border-border bg-surface p-3 shadow-lg">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted">
          <SourceIcon className="size-3.5" />
          {data.source === "captions" ? "Native captions" : "Whisper"}
        </div>
        <div className="flex items-center gap-1">
          {data.language ? <Badge>{data.language}</Badge> : null}
          <Badge>{wordCount} words</Badge>
          <button
            onClick={() => removeNode(id)}
            className="nodrag rounded p-1 text-muted transition-colors hover:bg-surface-raised hover:text-red-300"
            aria-label="Delete node"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      <p className="mb-2 line-clamp-1 text-sm font-medium">{data.title}</p>

      <Textarea
        value={data.text}
        onChange={(event) =>
          updateTranscriptNode(id, { text: event.target.value })
        }
        rows={10}
        placeholder="Transcript text…"
        className="font-mono text-xs"
      />

      <p className="mt-1.5 text-[11px] text-muted">
        Edits here are what gets sent to the model.
      </p>

      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
