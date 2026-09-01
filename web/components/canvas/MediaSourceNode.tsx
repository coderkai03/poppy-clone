"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { AlertCircle, ExternalLink, RotateCcw, Trash2 } from "lucide-react";

import { formatDuration, type MediaSourceNode as MediaSourceNodeType } from "@/lib/canvas";
import { useCanvasStore } from "@/hooks/useCanvasStore";
import { useIngest } from "@/hooks/useIngest";
import { Badge, PlatformBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { Thumbnail } from "@/components/ui/Thumbnail";

export function MediaSourceNode({ id, data }: NodeProps<MediaSourceNodeType>) {
  const removeNode = useCanvasStore((state) => state.removeNode);
  const { retry } = useIngest();

  const duration = formatDuration(data.duration);

  return (
    <div className="w-[280px] rounded-xl border border-border bg-surface p-3 shadow-lg">
      <div className="mb-2 flex items-center justify-between gap-2">
        <PlatformBadge platform={data.platform} />
        <div className="flex items-center gap-1">
          {duration ? <Badge>{duration}</Badge> : null}
          <button
            onClick={() => removeNode(id)}
            className="nodrag rounded p-1 text-muted transition-colors hover:bg-surface-raised hover:text-red-300"
            aria-label="Delete node"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      <Thumbnail src={data.thumbnailUrl} alt={data.title ?? "Video thumbnail"} />

      <p className="mt-2 line-clamp-2 text-sm font-medium leading-snug">
        {data.title ?? "Fetching details…"}
      </p>

      <a
        href={data.url}
        target="_blank"
        rel="noreferrer"
        className="nodrag mt-1 flex items-center gap-1 truncate text-xs text-muted hover:text-accent"
      >
        <ExternalLink className="size-3 shrink-0" />
        <span className="truncate">{data.url}</span>
      </a>

      {data.status === "loading" ? (
        <div className="mt-2.5 flex items-center gap-2 rounded-md bg-surface-raised px-2 py-1.5 text-xs text-muted">
          <Spinner className="size-3.5" />
          Transcribing — captions first, Whisper if needed…
        </div>
      ) : null}

      {data.status === "error" ? (
        <div className="mt-2.5 rounded-md border border-red-500/30 bg-red-500/10 p-2">
          <div className="flex gap-1.5 text-xs text-red-300">
            <AlertCircle className="mt-px size-3.5 shrink-0" />
            <span>{data.error}</span>
          </div>
          <Button
            variant="secondary"
            onClick={() => retry(id, data.url)}
            className="nodrag mt-2 w-full"
          >
            <RotateCcw className="size-3.5" />
            Retry
          </Button>
        </div>
      ) : null}

      <Handle type="source" position={Position.Right} />
    </div>
  );
}
