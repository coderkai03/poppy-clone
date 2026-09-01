/**
 * Source-URL parsing shared by the canvas UI and the /api/ingest route.
 * This is the single place that knows how to recognise a supported platform,
 * so the toolbar, the media node and the ingest proxy can never disagree.
 */

export type Platform = "youtube" | "tiktok" | "instagram";

export const PLATFORM_LABELS: Record<Platform, string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  instagram: "Instagram",
};

export interface ParsedSource {
  platform: Platform;
  /** Only YouTube exposes a stable id we can derive client-side. */
  videoId: string | null;
  /** Best-effort thumbnail known without calling the engine. */
  thumbnailUrl: string | null;
}

const YOUTUBE_HOSTS = ["youtube.com", "youtu.be", "youtube-nocookie.com"];
const TIKTOK_HOSTS = ["tiktok.com", "vm.tiktok.com", "vt.tiktok.com"];
const INSTAGRAM_HOSTS = ["instagram.com", "instagr.am"];

function hostMatches(hostname: string, domains: string[]): boolean {
  const host = hostname.replace(/^www\./, "").toLowerCase();
  return domains.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

/** Pulls the 11-character video id out of any of YouTube's URL shapes. */
function youtubeVideoId(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, "").toLowerCase();

  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    return id ?? null;
  }

  const fromQuery = url.searchParams.get("v");
  if (fromQuery) return fromQuery;

  // /shorts/<id>, /embed/<id>, /live/<id>, /v/<id>
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length >= 2 && ["shorts", "embed", "live", "v"].includes(segments[0])) {
    return segments[1];
  }

  return null;
}

/**
 * Returns null rather than throwing so callers can treat "unsupported" as a
 * normal validation outcome instead of an exception path.
 */
export function parseSourceUrl(raw: string): ParsedSource | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  if (hostMatches(url.hostname, YOUTUBE_HOSTS)) {
    const videoId = youtubeVideoId(url);
    return {
      platform: "youtube",
      videoId,
      thumbnailUrl: videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null,
    };
  }

  if (hostMatches(url.hostname, TIKTOK_HOSTS)) {
    // TikTok thumbnails live on rotating signed CDN hosts, so we wait for the
    // engine to report one rather than guessing.
    return { platform: "tiktok", videoId: null, thumbnailUrl: null };
  }

  if (hostMatches(url.hostname, INSTAGRAM_HOSTS)) {
    return { platform: "instagram", videoId: null, thumbnailUrl: null };
  }

  return null;
}

export function isSupportedSourceUrl(raw: string): boolean {
  return parseSourceUrl(raw) !== null;
}
