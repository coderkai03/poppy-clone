"""Lazily-loaded faster-whisper singleton.

The model is several hundred MB and takes seconds to load, so it is created on
first use and then reused for the lifetime of the process. Loading is guarded by
a lock because FastAPI serves requests from a thread pool.
"""

from __future__ import annotations

import logging
import os
import threading
from pathlib import Path
from typing import Optional, Tuple

from faster_whisper import WhisperModel

logger = logging.getLogger(__name__)

_model: Optional[WhisperModel] = None
_lock = threading.Lock()


def model_name() -> str:
    return os.getenv("WHISPER_MODEL", "base")


def device() -> str:
    return os.getenv("WHISPER_DEVICE", "cpu")


def compute_type() -> str:
    return os.getenv("WHISPER_COMPUTE_TYPE", "int8")


def is_loaded() -> bool:
    return _model is not None


def get_model() -> WhisperModel:
    """Returns the process-wide model, loading it on first call."""
    global _model

    if _model is not None:
        return _model

    with _lock:
        # Re-check inside the lock: another thread may have loaded it while we waited.
        if _model is None:
            logger.info(
                "Loading faster-whisper model=%s device=%s compute_type=%s",
                model_name(),
                device(),
                compute_type(),
            )
            _model = WhisperModel(
                model_name(),
                device=device(),
                compute_type=compute_type(),
            )
            logger.info("Whisper model loaded")

    return _model


def transcribe(audio_path: Path) -> Tuple[str, Optional[str]]:
    """Transcribes a local audio file. Returns (text, detected language code).

    This call is CPU-bound and blocking; callers must keep it off the event loop.
    """
    model = get_model()

    segments, info = model.transcribe(
        str(audio_path),
        # beam_size=1 is greedy decoding: markedly faster on CPU, and the small
        # accuracy cost does not matter for text that feeds an LLM.
        beam_size=1,
        vad_filter=True,
        vad_parameters={"min_silence_duration_ms": 500},
    )

    # segments is a generator — consuming it is what actually runs the model.
    text = " ".join(segment.text.strip() for segment in segments if segment.text.strip())

    return text.strip(), getattr(info, "language", None)
