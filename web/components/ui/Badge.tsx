import type { Platform } from "@/lib/platform";
import { PLATFORM_LABELS } from "@/lib/platform";

const PLATFORM_STYLES: Record<Platform, string> = {
  youtube: "bg-red-500/15 text-red-300 border-red-500/30",
  tiktok: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  instagram: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30",
};

export function PlatformBadge({ platform }: { platform: Platform }) {
  return (
    <span
      className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${PLATFORM_STYLES[platform]}`}
    >
      {PLATFORM_LABELS[platform]}
    </span>
  );
}

export function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">
      {children}
    </span>
  );
}
