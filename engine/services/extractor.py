"""Media extraction with the CLAUDE.md 6A fallback flow.

1. Detect the platform from the URL.
2. YouTube: try native captions first and return without touching a media stream.
3. TikTok / Instagram / captions missing: pull audio only with yt-dlp, then run
   faster-whisper over it. Temp files are removed in a finally: block.
4. Empty output is a 422, never an empty success.
"""

from __future__ import annotations

import logging
import shutil
import tempfile
from pathlib import Path
from typing import Any, Dict, Optional, Tuple
from urllib.parse import parse_qs, urlparse

from fastapi import HTTPException, status
from yt_dlp import YoutubeDL
from youtube_transcript_api import YouTubeTranscriptApi

from models import IngestResponse, Platform
from services import whisper

logger = logging.getLogger(__name__)

YOUTUBE_HOSTS = ("youtube.com", "youtu.be", "youtube-nocookie.com")
TIKTOK_HOSTS = ("tiktok.com",)
INSTAGRAM_HOSTS = ("instagram.com", "instagr.am")


def _host_matches(hostname: str, domains: Tuple[str, ...]) -> bool:
    host = hostname.lower().removeprefix("www.")
    return any(host == domain or host.endswith(f".{domain}") for domain in domains)


def detect_platform(url: str) -> Optional[Platform]:
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        return None

    if _host_matches(parsed.hostname, YOUTUBE_HOSTS):
        return "youtube"
    if _host_matches(parsed.hostname, TIKTOK_HOSTS):
        return "tiktok"
    if _host_matches(parsed.hostname, INSTAGRAM_HOSTS):
        return "instagram"
    return None


def youtube_video_id(url: str) -> Optional[str]:
    """Handles youtu.be, /watch?v=, /shorts/, /embed/, /live/ and /v/ shapes."""
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower().removeprefix("www.")

    if host == "youtu.be":
        segments = [segment for segment in parsed.path.split("/") if segment]
        return segments[0] if segments else None

    from_query = parse_qs(parsed.query).get("v")
    if from_query and from_query[0]:
        return from_query[0]

    segments = [segment for segment in parsed.path.split("/") if segment]
    if len(segments) >= 2 and segments[0] in ("shorts", "embed", "live", "v"):
        return segments[1]

    return None


def fetch_youtube_captions(video_id: str) -> Optional[Tuple[str, Optional[str]]]:
    """Returns (text, language_code), or None when captions are unavailable.

    youtube-transcript-api 1.x moved this off the class. CLAUDE.md documents the
    pre-1.0 YouTubeTranscriptApi.get_transcript(video_id) classmethod, which no
    longer exists.
    """
    try:
        api = YouTubeTranscriptApi()
        fetched = api.fetch(video_id)
    except Exception as error:
        # Deliberately broad: every caption failure (disabled, none in any
        # language, age-gated, IP-blocked) is a signal to fall back to Whisper,
        # not an error to surface. The reason is logged for debugging.
        logger.info("No usable captions for %s (%s)", video_id, type(error).__name__)
        return None

    text = " ".join(
        snippet.text.strip() for snippet in fetched.snippets if snippet.text.strip()
    ).strip()

    if not text:
        return None

    return text, getattr(fetched, "language_code", None)


def probe_metadata(url: str) -> Dict[str, Any]:
    """Reads title/duration/thumbnail without downloading any media stream."""
    try:
        with YoutubeDL({"quiet": True, "no_warnings": True, "noplaylist": True}) as ydl:
            info = ydl.extract_info(url, download=False)
            return info or {}
    except Exception as error:
        # Metadata is decoration; never fail an otherwise-good transcript over it.
        logger.info("Metadata probe failed for %s (%s)", url, type(error).__name__)
        return {}


def _require_ffmpeg() -> None:
    if shutil.which("ffmpeg") is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "ffmpeg is not on PATH, so audio cannot be extracted. Install it "
                "with: brew install ffmpeg (macOS) or "
                "winget install Gyan.FFmpeg (Windows), then restart the engine."
            ),
        )


def download_audio(url: str, target_dir: Path) -> Tuple[Path, Dict[str, Any]]:
    """Downloads audio only, transcoded to 128kbps mp3, into target_dir."""
    _require_ffmpeg()

    options = {
        "format": "bestaudio/best",
        "outtmpl": str(target_dir / "%(id)s.%(ext)s"),
        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": "128",
            }
        ],
        "quiet": True,
        "no_warnings": True,
        "noprogress": True,
        "noplaylist": True,
    }

    try:
        with YoutubeDL(options) as ydl:
            info = ydl.extract_info(url, download=True) or {}
    except HTTPException:
        raise
    except Exception as error:
        logger.warning("yt-dlp failed for %s: %s", url, error)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "Could not download audio for this URL. It may be private, "
                "region locked, or require sign-in."
            ),
        ) from error

    audio_files = sorted(target_dir.glob("*.mp3"))
    if not audio_files:
        # No mp3 means the postprocessor did not run; treat as unprocessable.
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Audio extraction produced no output for this URL.",
        )

    return audio_files[0], info


def transcribe_via_whisper(url: str) -> Tuple[str, Optional[str], Dict[str, Any]]:
    """Downloads audio to a temp dir, transcribes it, and always cleans up."""
    temp_dir = Path(tempfile.mkdtemp(prefix="poppy-ingest-"))
    try:
        audio_path, info = download_audio(url, temp_dir)
        logger.info("Transcribing %s via Whisper", audio_path.name)
        text, language = whisper.transcribe(audio_path)
        return text, language, info
    finally:
        # CLAUDE.md 6A: temp media is removed immediately, even on failure.
        shutil.rmtree(temp_dir, ignore_errors=True)


def ingest_url(url: str) -> IngestResponse:
    """Blocking end-to-end ingestion. Callers must run this off the event loop."""
    platform = detect_platform(url)
    if platform is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only YouTube, TikTok and Instagram URLs are supported.",
        )

    if platform == "youtube":
        video_id = youtube_video_id(url)
        if video_id:
            captions = fetch_youtube_captions(video_id)
            if captions is not None:
                text, language = captions
                logger.info("Served %s from native captions", video_id)
                metadata = probe_metadata(url)
                return IngestResponse(
                    text=text,
                    source="captions",
                    platform=platform,
                    title=metadata.get("title"),
                    duration=metadata.get("duration"),
                    language=language,
                    thumbnail=metadata.get("thumbnail"),
                )

    text, language, metadata = transcribe_via_whisper(url)

    if not text:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No speech or captions were found in this media.",
        )

    return IngestResponse(
        text=text,
        source="whisper",
        platform=platform,
        title=metadata.get("title"),
        duration=metadata.get("duration"),
        language=language,
        thumbnail=metadata.get("thumbnail"),
    )
