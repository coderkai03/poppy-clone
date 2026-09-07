"use client";

import { useEffect, useState } from "react";
import { Film } from "lucide-react";

/**
 * Video thumbnails come from rotating, signed CDN hosts (TikTok and Instagram
 * especially), which cannot be enumerated in next.config images.remotePatterns.
 * A plain <img> is therefore the correct tool here, and it degrades to a
 * placeholder when the host refuses the request.
 */
export function Thumbnail({
  src,
  alt,
  width,
  height,
  onMeasured,
}: {
  src: string | null;
  alt: string;
  width: number;
  height: number;
  onMeasured?: (size: { width: number; height: number }) => void;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const frame = { width, height };

  if (!src || failed) {
    return (
      <div
        className="flex items-center justify-center rounded-md border border-border bg-background"
        style={frame}
      >
        <Film className="size-6 text-muted" aria-hidden />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- arbitrary CDN hosts, see note above
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      onLoad={(event) => {
        const image = event.currentTarget;
        onMeasured?.({
          width: image.naturalWidth,
          height: image.naturalHeight,
        });
      }}
      className="block rounded-md border border-border object-contain bg-background"
      style={frame}
    />
  );
}
