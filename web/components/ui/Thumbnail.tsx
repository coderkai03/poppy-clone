"use client";

import { useState } from "react";
import { Film } from "lucide-react";

/**
 * Video thumbnails come from rotating, signed CDN hosts (TikTok and Instagram
 * especially), which cannot be enumerated in next.config images.remotePatterns.
 * A plain <img> is therefore the correct tool here, and it degrades to a
 * placeholder when the host refuses the request.
 */
export function Thumbnail({ src, alt }: { src: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-md border border-border bg-background">
        <Film className="size-6 text-muted" aria-hidden />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- arbitrary CDN hosts, see note above
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className="aspect-video w-full rounded-md border border-border object-cover"
    />
  );
}
