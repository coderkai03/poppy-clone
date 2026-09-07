"use client";

import { useEffect } from "react";
import { Position, useUpdateNodeInternals, type NodeProps } from "@xyflow/react";
import { AlertCircle, ChevronDown, ExternalLink, RotateCcw, Trash2 } from "lucide-react";

import {
  formatCount,
  formatDuration,
  formatPublishedAt,
  mediaThumbFrame,
  MEDIA_THUMB_FALLBACK,
  type MediaSourceNode as MediaSourceNodeType,
  type MediaSourceNodeData,
} from "@/lib/canvas";
import { useCanvasStore } from "@/hooks/useCanvasStore";
import { useIngest } from "@/hooks/useIngest";
import { ConnectorHandle } from "@/components/canvas/ConnectorHandle";
import { Badge, PlatformBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { Thumbnail } from "@/components/ui/Thumbnail";

export function MediaSourceNode({ id, data }: NodeProps<MediaSourceNodeType>) {
  const removeNode = useCanvasStore((state) => state.removeNode);
  const updateMediaNode = useCanvasStore((state) => state.updateMediaNode);
  const updateNodeInternals = useUpdateNodeInternals();
  const { retry } = useIngest();

  const duration = formatDuration(data.duration);
  const naturalWidth = data.thumbnailNaturalWidth;
  const naturalHeight = data.thumbnailNaturalHeight;
  const frame =
    naturalWidth && naturalHeight
      ? mediaThumbFrame(naturalWidth, naturalHeight)
      : MEDIA_THUMB_FALLBACK;
  const hasDetails = mediaDetailRows(data).length > 0;

  useEffect(() => {
    updateNodeInternals(id);
  }, [id, frame.width, frame.height, hasDetails, updateNodeInternals]);

  return (
    <div className="w-max rounded-xl border border-border bg-surface p-3 shadow-lg">
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

      <Thumbnail
        src={data.thumbnailUrl}
        alt={data.title ?? "Video thumbnail"}
        width={frame.width}
        height={frame.height}
        onMeasured={(size) => {
          if (
            data.thumbnailNaturalWidth === size.width &&
            data.thumbnailNaturalHeight === size.height
          ) {
            return;
          }
          updateMediaNode(id, {
            thumbnailNaturalWidth: size.width,
            thumbnailNaturalHeight: size.height,
          });
        }}
      />

      <p className="mt-2 line-clamp-2 text-sm font-medium leading-snug" style={{ maxWidth: frame.width }}>
        {data.title ?? "Fetching details…"}
      </p>

      <a
        href={data.url}
        target="_blank"
        rel="noreferrer"
        className="nodrag mt-1 flex items-center gap-1 truncate text-xs text-muted hover:text-accent"
        style={{ maxWidth: frame.width }}
      >
        <ExternalLink className="size-3 shrink-0" />
        <span className="truncate">{data.url}</span>
      </a>

      {hasDetails ? (
        <MediaDetails
          data={data}
          width={frame.width}
          onToggle={() => updateNodeInternals(id)}
        />
      ) : null}

      {data.status === "loading" ? (
        <div className="mt-2.5 flex items-center gap-2 rounded-md bg-surface-raised px-2 py-1.5 text-xs text-muted" style={{ maxWidth: frame.width }}>
          <Spinner className="size-3.5" />
          Transcribing — captions first, Whisper if needed…
        </div>
      ) : null}

      {data.status === "error" ? (
        <div className="mt-2.5 rounded-md border border-red-500/30 bg-red-500/10 p-2" style={{ maxWidth: frame.width }}>
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

      <ConnectorHandle nodeId={id} type="source" position={Position.Right} />
    </div>
  );
}

type DetailRow = { label: string; value: string };

function mediaDetailRows(data: MediaSourceNodeData): DetailRow[] {
  const rows: DetailRow[] = [];
  if (data.author) rows.push({ label: "Author", value: data.author });
  const published = formatPublishedAt(data.publishedAt);
  if (published) rows.push({ label: "Date", value: published });
  const views = formatCount(data.viewCount);
  if (views) rows.push({ label: "Views", value: views });
  return rows;
}

function MediaDetails({
  data,
  width,
  onToggle,
}: {
  data: MediaSourceNodeData;
  width: number;
  onToggle: () => void;
}) {
  const rows = mediaDetailRows(data);

  return (
    <details
      className="media-details nodrag nowheel group mt-2 rounded-md border border-border bg-background"
      style={{ width }}
      onToggle={onToggle}
    >
      <summary className="flex cursor-pointer items-center gap-1 px-2 py-1.5 text-[11px] font-medium text-muted select-none hover:text-foreground">
        <ChevronDown className="size-3 shrink-0 transition-transform group-open:rotate-180" />
        Details
      </summary>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-t border-border px-2 py-1.5 text-[11px]">
        {rows.map((row) => (
          <div key={row.label} className="contents">
            <dt className="text-muted">{row.label}</dt>
            <dd className="min-w-0 truncate text-foreground" title={row.value}>
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
