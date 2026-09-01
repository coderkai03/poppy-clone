"""Pydantic wire models. These mirror web/lib/schemas.ts — change both together."""

from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator

TranscriptSource = Literal["captions", "whisper"]
Platform = Literal["youtube", "tiktok", "instagram"]


class IngestRequest(BaseModel):
    url: str = Field(min_length=1, description="Public YouTube, TikTok or Instagram URL.")


class IngestResponse(BaseModel):
    text: str
    source: TranscriptSource
    platform: Platform
    title: Optional[str] = None
    duration: Optional[float] = None
    language: Optional[str] = None
    thumbnail: Optional[str] = None


class TranscriptContext(BaseModel):
    """One transcript node's contribution to a generation prompt."""

    title: str = ""
    text: str


class LlmRequest(BaseModel):
    prompt: str = Field(min_length=1, description="The user's instruction.")
    transcripts: List[TranscriptContext] = Field(min_length=1)

    @field_validator("prompt")
    @classmethod
    def prompt_not_blank(cls, value: str) -> str:
        # min_length=1 still admits "   ", which would give the model nothing to do.
        if not value.strip():
            raise ValueError("prompt must not be blank")
        return value


class HealthResponse(BaseModel):
    status: Literal["ok"]
    whisper_model: str
    whisper_device: str
    whisper_loaded: bool
    ffmpeg_available: bool
    llm_base_url: str
    llm_model: str
