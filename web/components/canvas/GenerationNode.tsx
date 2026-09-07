"use client";

import {
  useEffect,
  useRef,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import {
  NodeResizer,
  Position,
  useNodeConnections,
  type NodeProps,
} from "@xyflow/react";
import { AlertCircle, Send, Sparkles, Square, Trash2 } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import {
  GENERATION_NODE_HEIGHT,
  GENERATION_NODE_MIN_HEIGHT,
  GENERATION_NODE_MIN_WIDTH,
  GENERATION_NODE_WIDTH,
  type ChatMessage,
  type GenerationNode as GenerationNodeType,
} from "@/lib/canvas";
import { useCanvasStore } from "@/hooks/useCanvasStore";
import { useGenerationStream } from "@/hooks/useGenerationStream";
import { ConnectorHandle } from "@/components/canvas/ConnectorHandle";
import { Badge } from "@/components/ui/Badge";
import { Textarea } from "@/components/ui/Textarea";

export function GenerationNode({
  id,
  data,
  width,
  height,
}: NodeProps<GenerationNodeType>) {
  const removeNode = useCanvasStore((state) => state.removeNode);
  const updateGenerationNode = useCanvasStore((state) => state.updateGenerationNode);
  const { generate, cancel } = useGenerationStream();

  const connections = useNodeConnections({ id, handleType: "target" });
  const isStreaming = data.status === "streaming";
  const messages = data.messages ?? [];
  const canSend =
    !isStreaming && connections.length > 0 && (data.prompt ?? "").trim().length > 0;

  const scrollerRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    scroller.scrollTop = scroller.scrollHeight;
  }, [data.messages, data.status]);

  function resizeComposer() {
    const field = composerRef.current;
    if (!field) return;
    field.style.height = "auto";
    field.style.height = `${Math.min(field.scrollHeight, 128)}px`;
  }

  function send() {
    if (!canSend) return;
    void generate(id);
    requestAnimationFrame(() => {
      const field = composerRef.current;
      if (!field) return;
      field.style.height = "auto";
      field.focus();
    });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    send();
  }

  function onComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) {
      return;
    }
    event.preventDefault();
    send();
  }

  const lastMessage = messages[messages.length - 1];

  return (
    <div
      className="relative h-full w-full"
      style={{
        width: width ?? GENERATION_NODE_WIDTH,
        height: height ?? GENERATION_NODE_HEIGHT,
      }}
    >
      <NodeResizer
        minWidth={GENERATION_NODE_MIN_WIDTH}
        minHeight={GENERATION_NODE_MIN_HEIGHT}
        color="var(--accent)"
        lineClassName="chat-resize-line"
        handleClassName="chat-resize-handle"
      />

      <div className="flex h-full w-full flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-lg">
        <div className="flex shrink-0 cursor-grab items-center justify-between gap-2 border-b border-border px-3 py-2 active:cursor-grabbing">
          <div className="flex items-center gap-1.5 text-xs font-medium text-accent">
            <Sparkles className="size-3.5" />
            Chat
          </div>
          <div className="flex items-center gap-1">
            <Badge>
              {connections.length} source{connections.length === 1 ? "" : "s"}
            </Badge>
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

        <div
          ref={scrollerRef}
          className="nodrag nowheel min-h-0 flex-1 overflow-y-auto px-3 py-3"
        >
          {messages.length === 0 ? (
            <p className="px-1 text-sm leading-relaxed text-muted">
              {connections.length === 0
                ? "Connect a transcript or file, then send a message."
                : "Ask anything about the connected sources."}
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {messages.map((message) => (
                <ChatTurnView
                  key={message.id}
                  message={message}
                  isStreaming={
                    isStreaming &&
                    message.id === lastMessage?.id &&
                    message.role === "assistant"
                  }
                />
              ))}
            </div>
          )}
        </div>

        {data.status === "error" && data.error ? (
          <div className="nodrag mx-3 mb-2 flex gap-1.5 rounded-md border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-300">
            <AlertCircle className="mt-px size-3.5 shrink-0" />
            <span>{data.error}</span>
          </div>
        ) : null}

        <form
          onSubmit={onSubmit}
          className="nodrag shrink-0 border-t border-border bg-surface-raised/50 p-2"
        >
          <div className="flex items-end gap-1.5">
            <Textarea
              ref={composerRef}
              value={data.prompt ?? ""}
              rows={1}
              onChange={(event) => {
                updateGenerationNode(id, { prompt: event.target.value });
                resizeComposer();
              }}
              onKeyDown={onComposerKeyDown}
              placeholder={
                connections.length === 0
                  ? "Connect a source first…"
                  : "Message…"
              }
              className="max-h-32 min-h-10 resize-none bg-background py-2.5"
            />
            {isStreaming ? (
              <button
                type="button"
                onClick={() => cancel(id)}
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-foreground transition-colors hover:bg-border"
                aria-label="Stop generating"
              >
                <Square className="size-3.5 fill-current" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!canSend}
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-md bg-accent text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Send message"
              >
                <Send className="size-3.5" />
              </button>
            )}
          </div>
          <p className="mt-1 px-0.5 text-[10px] text-muted">
            Enter to send · Shift+Enter for a new line · drag a corner to resize
          </p>
        </form>
      </div>

      <ConnectorHandle nodeId={id} type="target" position={Position.Left} />
    </div>
  );
}

function ChatTurnView({
  message,
  isStreaming,
}: {
  message: ChatMessage;
  isStreaming: boolean;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-accent/20 px-3 py-2 text-sm leading-relaxed text-foreground">
          {message.content}
        </p>
      </div>
    );
  }

  return (
    <div className="markdown-card text-sm leading-relaxed">
      {message.content ? (
        <Markdown remarkPlugins={[remarkGfm]}>{message.content}</Markdown>
      ) : (
        <span className="text-xs text-muted">Thinking…</span>
      )}
      {isStreaming ? (
        <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-accent align-middle" />
      ) : null}
    </div>
  );
}
