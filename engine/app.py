"""FastAPI entry point for the local media & speech processing engine.

Run with:  uvicorn app:app --reload --port 8000
Expose with: cloudflared tunnel --url http://localhost:8000
"""

from __future__ import annotations

import json
import logging
import os
import secrets
import shutil
from contextlib import asynccontextmanager
from typing import AsyncIterator, Optional

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException, status
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import StreamingResponse

from models import HealthResponse, IngestRequest, IngestResponse, LlmRequest
from services import llm, whisper
from services.extractor import ingest_url

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(name)s: %(message)s",
)
logger = logging.getLogger("engine")

@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    if shutil.which("ffmpeg") is None:
        logger.warning(
            "ffmpeg was not found on PATH. Native YouTube captions will still "
            "work, but the Whisper fallback cannot extract audio until you "
            "install it (brew install ffmpeg / winget install Gyan.FFmpeg)."
        )
    yield


app = FastAPI(
    title="Poppy Clone Ingestion Engine",
    description="Caption extraction and local Whisper transcription.",
    version="0.1.0",
    lifespan=lifespan,
)


def require_secret(
    x_secret_key: Optional[str] = Header(default=None, alias="x-secret-key"),
) -> None:
    """CLAUDE.md 6B: reject missing or mismatched shared secrets with a 401."""
    expected = os.getenv("MAC_API_SECRET")

    if not expected:
        # A misconfigured engine must not silently accept every request.
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="MAC_API_SECRET is not configured on the engine.",
        )

    # compare_digest keeps the check constant-time.
    if not x_secret_key or not secrets.compare_digest(x_secret_key, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid x-secret-key header.",
        )


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    """Unauthenticated liveness probe — reports config without touching secrets."""
    return HealthResponse(
        status="ok",
        whisper_model=whisper.model_name(),
        whisper_device=whisper.device(),
        whisper_loaded=whisper.is_loaded(),
        ffmpeg_available=shutil.which("ffmpeg") is not None,
        llm_base_url=llm.base_url(),
        llm_model=llm.configured_model() or "(auto-detect)",
    )


@app.post(
    "/ingest",
    response_model=IngestResponse,
    dependencies=[Depends(require_secret)],
)
async def ingest(request: IngestRequest) -> IngestResponse:
    """Turns a media URL into a transcript.

    yt-dlp and faster-whisper are both blocking and CPU-bound, so the whole
    pipeline runs in a worker thread to keep the event loop responsive.
    """
    logger.info("Ingest requested: %s", request.url)
    return await run_in_threadpool(ingest_url, request.url)


# WebKit buffers a streamed response until 1024 bytes have arrived, so without a
# preamble the first tokens never paint and the stream looks stalled. An SSE
# comment line is ignored by the client parser, which makes it the right filler.
SSE_PADDING = f":{' ' * 2048}\n\n"


def _token_frame(text: str) -> str:
    # JSON-encoding the token keeps newlines from breaking SSE's line framing.
    return f"data: {json.dumps({'t': text})}\n\n"


def _event_frame(event: str, payload: object) -> str:
    return f"event: {event}\ndata: {json.dumps(payload)}\n\n"


@app.post("/llm", dependencies=[Depends(require_secret)])
async def generate(request: LlmRequest) -> StreamingResponse:
    """Streams a markdown synthesis from the locally hosted model as SSE.

    The frame format is consumed by web/hooks/useGenerationStream.ts: token
    frames carry {"t": "..."}, and the stream ends with either an `error` or a
    `done` event.
    """
    logger.info(
        "Generation requested: %d transcript(s), prompt %d chars",
        len(request.transcripts),
        len(request.prompt),
    )

    # Opening the stream here rather than inside the generator is what lets a
    # dead model server return a real 502 instead of a 200 whose body is a
    # single error frame.
    try:
        stream = await llm.open_stream(request.prompt, request.transcripts)
    except llm.LlmUnavailable as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(error),
        ) from error

    async def frames() -> AsyncIterator[str]:
        yield SSE_PADDING

        produced = False
        try:
            async for token in llm.iter_tokens(stream):
                produced = True
                yield _token_frame(token)
        except Exception as error:  # noqa: BLE001 - the stream is already 200
            # Past this point the status line is sent, so a mid-stream failure
            # can only be reported inside the body.
            logger.exception("Generation failed mid-stream")
            yield _event_frame("error", {"error": f"Generation failed: {error}"})
            return

        if produced:
            yield _event_frame("done", {})
        else:
            yield _event_frame(
                "error",
                {
                    "error": "The local model returned no content. Check that a "
                    "model is loaded and that its context window fits the transcript."
                },
            )

    return StreamingResponse(
        frames(),
        media_type="text/event-stream; charset=utf-8",
        headers={
            "Cache-Control": "no-cache, no-transform",
            # Stops nginx, cloudflared and similar from buffering the whole body.
            "X-Accel-Buffering": "no",
        },
    )
