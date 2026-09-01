"use client";

import dynamic from "next/dynamic";

import { Spinner } from "@/components/ui/Spinner";

/**
 * xyflow measures its container on mount and the store reads localStorage, so
 * the workspace is client-only. Per the Next 16 docs, `ssr: false` is not
 * allowed in a Server Component — the dynamic() call has to live in a
 * 'use client' module like this one.
 */
const CanvasWorkspace = dynamic(
  () => import("@/components/canvas/CanvasWorkspace"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-dvh w-full items-center justify-center text-muted">
        <Spinner className="size-5" />
      </div>
    ),
  },
);

export function CanvasClient() {
  return <CanvasWorkspace />;
}
