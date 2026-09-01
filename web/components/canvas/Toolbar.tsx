"use client";

import { useState } from "react";
import { Plus, Sparkles, Trash2 } from "lucide-react";

import { useCanvasStore } from "@/hooks/useCanvasStore";
import { useIngest } from "@/hooks/useIngest";
import { Button } from "@/components/ui/Button";

export function Toolbar() {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { ingest } = useIngest();
  const addGenerationNode = useCanvasStore((state) => state.addGenerationNode);
  const clearCanvas = useCanvasStore((state) => state.clearCanvas);
  const nodeCount = useCanvasStore((state) => state.nodes.length);

  function handleAdd() {
    if (!url.trim()) return;

    if (!ingest(url.trim())) {
      setError("Paste a YouTube, TikTok or Instagram link.");
      return;
    }

    setError(null);
    setUrl("");
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 rounded-xl border border-border bg-surface p-1.5 shadow-xl">
        <input
          value={url}
          onChange={(event) => {
            setUrl(event.target.value);
            setError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") handleAdd();
          }}
          placeholder="Paste a YouTube, TikTok or Instagram URL…"
          className="w-[340px] bg-transparent px-2.5 py-1.5 text-sm outline-none placeholder:text-muted"
        />
        <Button onClick={handleAdd} disabled={!url.trim()}>
          <Plus className="size-3.5" />
          Add
        </Button>
        <div className="mx-0.5 h-6 w-px bg-border" />
        <Button variant="secondary" onClick={() => addGenerationNode()}>
          <Sparkles className="size-3.5" />
          Generation
        </Button>
        <Button
          variant="ghost"
          onClick={clearCanvas}
          disabled={nodeCount === 0}
          aria-label="Clear canvas"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      {error ? (
        <p className="px-2 text-xs text-red-300" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
