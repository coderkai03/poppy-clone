"use client";

import { useEffect, useState } from "react";
import { Position, useUpdateNodeInternals, type NodeProps } from "@xyflow/react";
import { FileText, Pencil, Plus, Trash2 } from "lucide-react";

import type { FileNode as FileNodeType } from "@/lib/canvas";
import { FILE_KIND_LABEL, fileKind, fileNodeWidth, formatFileSize } from "@/lib/files";
import { useCanvasStore } from "@/hooks/useCanvasStore";
import { ConnectorHandle } from "@/components/canvas/ConnectorHandle";
import { FilePreview } from "@/components/canvas/FilePreview";
import { Badge } from "@/components/ui/Badge";
import { Textarea } from "@/components/ui/Textarea";

export function FileNode({ id, data }: NodeProps<FileNodeType>) {
  const removeNode = useCanvasStore((state) => state.removeNode);
  const updateFileNode = useCanvasStore((state) => state.updateFileNode);
  const addGenerationNode = useCanvasStore((state) => state.addGenerationNode);
  const updateNodeInternals = useUpdateNodeInternals();

  const kind = fileKind(data.name, data.mime);
  const [editing, setEditing] = useState(false);
  const wordCount = data.text.trim() ? data.text.trim().split(/\s+/).length : 0;
  const width = fileNodeWidth(kind);

  useEffect(() => {
    updateNodeInternals(id);
  }, [id, width, editing, updateNodeInternals]);

  return (
    <div
      className="rounded-xl border border-border bg-surface p-3 shadow-lg"
      style={{ width }}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted">
          <FileText className="size-3.5" />
          {FILE_KIND_LABEL[kind]}
        </div>
        <div className="flex items-center gap-1">
          <Badge>{formatFileSize(data.size)}</Badge>
          <Badge>{wordCount} words</Badge>
          <button
            type="button"
            onClick={() => setEditing((open) => !open)}
            className="nodrag rounded p-1 text-muted transition-colors hover:bg-surface-raised hover:text-foreground"
            aria-label={editing ? "Show formatted preview" : "Edit file text"}
            aria-pressed={editing}
          >
            <Pencil className={`size-3.5 ${editing ? "text-accent" : ""}`} />
          </button>
          <button
            type="button"
            onClick={() => removeNode(id)}
            className="nodrag rounded p-1 text-muted transition-colors hover:bg-surface-raised hover:text-red-300"
            aria-label="Delete node"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      <p className="mb-2 line-clamp-1 text-sm font-medium" title={data.name}>
        {data.name}
      </p>

      {editing ? (
        <Textarea
          value={data.text}
          onChange={(event) => updateFileNode(id, { text: event.target.value })}
          rows={kind === "csv" || kind === "tsv" ? 12 : 8}
          placeholder="File text…"
          className="font-mono text-xs"
        />
      ) : (
        <FilePreview name={data.name} mime={data.mime} text={data.text} />
      )}

      <p className="mt-1.5 text-[11px] text-muted">
        {data.truncated
          ? "File was truncated to fit the canvas. Pencil edits the text the model sees."
          : "Pencil edits the text the model sees."}
      </p>

      <ConnectorHandle
        nodeId={id}
        type="source"
        position={Position.Right}
        vacantIcon={<Plus className="size-2.5" strokeWidth={2.5} />}
        vacantActionLabel="Chat"
        onVacantAction={(event) => {
          event.stopPropagation();
          addGenerationNode(id);
        }}
      />
    </div>
  );
}
