"use client";

import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import {
  Handle,
  Position,
  useNodeConnections,
  type HandleType,
} from "@xyflow/react";
import { X } from "lucide-react";

import { useCanvasStore } from "@/hooks/useCanvasStore";

/**
 * One handle with two modes: vacant (optional plus + action) and connected
 * (hover reveals an X that drops every edge on this port).
 */
export function ConnectorHandle({
  nodeId,
  type,
  position,
  vacantIcon,
  vacantActionLabel,
  onVacantAction,
}: {
  nodeId: string;
  type: HandleType;
  position: Position;
  vacantIcon?: ReactNode;
  vacantActionLabel?: string;
  onVacantAction?: (event: MouseEvent<HTMLElement>) => void;
}) {
  const connections = useNodeConnections({ id: nodeId, handleType: type });
  const removeEdge = useCanvasStore((state) => state.removeEdge);
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

  function disconnect(event: MouseEvent<HTMLElement>, edgeId: string) {
    event.stopPropagation();
    removeEdge(edgeId);
  }

  const side = position === Position.Left ? "left" : "right";
  const handleClass = vacant
    ? vacantIcon
      ? `connector-vacant${hot ? " connector-vacant-hot" : ""}`
      : undefined
    : `connector-live${hot ? " connector-live-hot" : ""}`;

  return (
    <>
      <Handle
        type={type}
        position={position}
        className={handleClass}
        aria-label={
          vacant
            ? vacantActionLabel
              ? `Add ${vacantActionLabel.toLowerCase()} from this node`
              : undefined
            : "Connected"
        }
        onMouseEnter={openMenu}
        onMouseLeave={scheduleClose}
        onClick={vacant && onVacantAction ? onVacantAction : undefined}
      >
        {vacant ? vacantIcon : null}
      </Handle>

      {!vacant
        ? connections.map((connection, index) => {
            const offset = (index - (connections.length - 1) / 2) * 22;
            return (
              <button
                key={connection.edgeId}
                type="button"
                onClick={(event) => disconnect(event, connection.edgeId)}
                onPointerDown={(event) => event.stopPropagation()}
                onMouseEnter={openMenu}
                onMouseLeave={scheduleClose}
                onFocus={openMenu}
                onBlur={scheduleClose}
                aria-label="Remove connection"
                style={{ top: `calc(50% + ${offset}px)` }}
                className={`nodrag nopan connector-x ${side} ${
                  hot
                    ? "opacity-100"
                    : "pointer-events-none opacity-0 focus-visible:pointer-events-auto focus-visible:opacity-100"
                }`}
              >
                <X className="size-2.5" strokeWidth={2.5} />
              </button>
            );
          })
        : null}

      {vacant && vacantActionLabel && onVacantAction ? (
        <button
          type="button"
          onClick={onVacantAction}
          onMouseEnter={openMenu}
          onMouseLeave={scheduleClose}
          onFocus={openMenu}
          onBlur={scheduleClose}
          aria-label={`Add ${vacantActionLabel.toLowerCase()} node connected to this source`}
          className={`nodrag nopan absolute top-1/2 z-20 inline-flex -translate-y-1/2 items-center rounded-md border border-border bg-surface px-2 py-1 text-xs font-medium shadow-lg transition-colors hover:border-accent hover:bg-accent hover:text-white ${
            side === "right" ? "left-full ml-5" : "right-full mr-5"
          } ${
            hot
              ? "opacity-100"
              : "pointer-events-none opacity-0 focus-visible:pointer-events-auto focus-visible:opacity-100"
          }`}
        >
          {vacantActionLabel}
        </button>
      ) : null}
    </>
  );
}
