"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import {
  Handle,
  Position,
  useNodeConnections,
  type NodeProps,
} from "@xyflow/react";
import { Captions, Mic, Plus, Trash2 } from "lucide-react";

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
      <TranscriptSourceHandle nodeId={id} />
    </div>
  );
}

/**
 * Vacant source handle renders as a plus. Hovering it (or the revealed label)
 * opens Chat, which creates a generation node already wired to this transcript.
 * Drag-to-connect still works from the handle itself.
 */
function TranscriptSourceHandle({ nodeId }: { nodeId: string }) {
  const addGenerationNode = useCanvasStore((state) => state.addGenerationNode);
  const connections = useNodeConnections({ id: nodeId, handleType: "source" });
  const vacant = connections.length === 0;

  const [hot, setHot] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function openMenu() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setHot(true);
  }

  function scheduleClose() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setHot(false), 140);
  }

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  function addConnectedChat(event: MouseEvent<HTMLElement>) {
    event.stopPropagation();
    addGenerationNode(nodeId);
  }

  return (
    <>
      <Handle
        type="source"
        position={Position.Right}
        className={
          vacant
            ? `transcript-source-vacant${hot ? " transcript-source-vacant-hot" : ""}`
            : undefined
        }
        aria-label={vacant ? "Add chat from this transcript" : undefined}
        onMouseEnter={vacant ? openMenu : undefined}
        onMouseLeave={vacant ? scheduleClose : undefined}
        onClick={vacant ? addConnectedChat : undefined}
      >
        {vacant ? <Plus className="size-2.5" strokeWidth={2.5} /> : null}
      </Handle>

      {vacant ? (
        <button
          type="button"
          onClick={addConnectedChat}
          onMouseEnter={openMenu}
          onMouseLeave={scheduleClose}
          onFocus={openMenu}
          onBlur={scheduleClose}
          aria-label="Add chat node connected to this transcript"
          className={`nodrag nopan absolute top-1/2 left-full z-20 ml-5 inline-flex -translate-y-1/2 items-center rounded-md border border-border bg-surface px-2 py-1 text-xs font-medium shadow-lg transition-colors hover:border-accent hover:bg-accent hover:text-white ${
            hot
              ? "opacity-100"
              : "pointer-events-none opacity-0 focus-visible:pointer-events-auto focus-visible:opacity-100"
          }`}
        >
          Chat
        </button>
      ) : null}
    </>
  );
}
