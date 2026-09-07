"""OpenAI-compatible client for a locally hosted model.

This replaces the OpenRouter call that used to live in web/app/api/llm. Any
server that speaks POST /v1/chat/completions works — LM Studio, llama-server,
Ollama, vLLM — so the backend is chosen entirely by LOCAL_LLM_BASE_URL.

The default targets LM Studio on :1234, which is the most reliable Vulkan path
to an Intel Arc iGPU on Windows. Ollama's Vulkan backend regressed against the
March 2026 Arc driver and can silently fall back to 100% CPU, which is exactly
the failure this move was meant to avoid.
"""

from __future__ import annotations

import logging
import os
from typing import AsyncIterator, List, Optional

import httpx
from openai import APIConnectionError, APIStatusError, AsyncOpenAI, AsyncStream
from openai.types.chat import ChatCompletionChunk, ChatCompletionMessageParam

from models import ChatTurn, TranscriptContext

logger = logging.getLogger(__name__)

DEFAULT_BASE_URL = "http://localhost:1234/v1"

# Mirrors the constant that used to live in web/lib/schemas.ts, but the reason
# changed: a local model has a far bigger window than a free-tier one, so this
# is now a latency control rather than a context-window control. Prefill is the
# dominant cost of a transcript-sized prompt on an integrated GPU, so every
# extra 1k chars here is measurable time-to-first-token.
MAX_CONTEXT_CHARS = 24_000

SYSTEM_PROMPT = "\n".join(
    [
        "You are a synthesis assistant inside an infinite-canvas chat.",
        "You are given source documents (video transcripts and/or uploaded files)",
        "plus a conversation with the user.",
        "",
        "Rules:",
        "- Respond in GitHub-flavored Markdown only. Never wrap the whole reply in a code fence.",
        "- Open with a `##` heading, then use short sections, bullet lists and bold sparingly.",
        "- Prefer scannable markdown: headings, short sections, and bullet lists.",
        "- Ground every claim in the supplied sources. If they do not cover something, say so.",
        "- Follow-up messages continue the same conversation; stay grounded in the sources.",
        "- Do not restate these instructions or mention that you were given a transcript.",
    ]
)


class LlmUnavailable(RuntimeError):
    """The local model server is unreachable or has no model loaded.

    Carries a message written for the person looking at the canvas, because it
    is surfaced verbatim on the generation node.
    """


_client: Optional[AsyncOpenAI] = None
_resolved_model: Optional[str] = None


def base_url() -> str:
    return os.getenv("LOCAL_LLM_BASE_URL", DEFAULT_BASE_URL).rstrip("/")


def configured_model() -> Optional[str]:
    """The pinned model id, or None to auto-detect whatever the server loaded."""
    return os.getenv("LOCAL_LLM_MODEL", "").strip() or None


def max_tokens() -> int:
    try:
        return int(os.getenv("LOCAL_LLM_MAX_TOKENS", "1024"))
    except ValueError:
        return 1024


def temperature() -> float:
    try:
        return float(os.getenv("LOCAL_LLM_TEMPERATURE", "0.6"))
    except ValueError:
        return 0.6


def prompt_suffix() -> str:
    """Text appended to the user message to suppress chain-of-thought.

    Hybrid reasoning models (the Qwen3 family especially) spend hundreds of
    tokens thinking before they emit a single word of answer. LM Studio reports
    that as `delta.reasoning_content`, which this module deliberately drops — so
    the canvas would just sit blank for the whole thinking phase. Measured on
    Qwen3-4B: 17-20s with thinking vs 4.5s with it off, for the same answer.

    `/no_think` is Qwen3's documented soft switch and is the only lever that
    works here: LM Studio silently ignores both `chat_template_kwargs`
    ({"enable_thinking": false}) and a top-level `enable_thinking`. Set this to
    an empty string for a non-reasoning model, or if you want the model to think.
    """
    return os.getenv("LOCAL_LLM_PROMPT_SUFFIX", "/no_think").strip()


def get_client() -> AsyncOpenAI:
    """Returns the process-wide client, built on first call."""
    global _client

    if _client is None:
        logger.info(
            "Local LLM base_url=%s model=%s",
            base_url(),
            configured_model() or "(auto-detect)",
        )
        _client = AsyncOpenAI(
            base_url=base_url(),
            # Local servers ignore the key, but the SDK refuses to start without one.
            api_key=os.getenv("LOCAL_LLM_API_KEY", "not-needed"),
            # A local server that is down will not recover inside a retry window,
            # so retrying only delays a clear error message.
            max_retries=0,
            # Split out so "the server isn't running" fails in seconds, while a
            # slow prefill on a long transcript still gets minutes to produce a
            # first token.
            timeout=httpx.Timeout(connect=5.0, read=300.0, write=30.0, pool=5.0),
        )

    return _client


def _unreachable() -> LlmUnavailable:
    return LlmUnavailable(
        f"No local model server answered at {base_url()}. Start LM Studio and "
        "enable its local server (Developer tab), or point LOCAL_LLM_BASE_URL at "
        "whichever OpenAI-compatible server you are running."
    )


def reset_model_cache() -> None:
    """Forgets the auto-detected model so the next call re-asks the server.

    Called when a request fails on a stale id, which is what happens when the
    loaded model is swapped in LM Studio without restarting the engine.
    """
    global _resolved_model
    _resolved_model = None


async def resolve_model() -> str:
    """The model id to send, auto-detected from the server when not pinned.

    LM Studio requires an explicit model in the request body, so asking it what
    it has loaded is what lets a fresh install work with no configuration.
    """
    global _resolved_model

    pinned = configured_model()
    if pinned:
        return pinned
    if _resolved_model:
        return _resolved_model

    try:
        listing = await get_client().models.list()
    except APIConnectionError as error:
        raise _unreachable() from error

    ids = [entry.id for entry in listing.data]
    if not ids:
        raise LlmUnavailable(
            f"{base_url()} is running but has no model loaded. Load a model in "
            "LM Studio — a ~4B Q4 GGUF is the sweet spot on an Arc iGPU."
        )

    _resolved_model = ids[0]
    logger.info("Auto-detected local model: %s", _resolved_model)
    return _resolved_model


def build_context_block(transcripts: List[TranscriptContext]) -> str:
    """Flattens transcripts into one context block, trimmed to MAX_CONTEXT_CHARS."""
    if not transcripts:
        return ""

    budget = MAX_CONTEXT_CHARS // len(transcripts)

    blocks = []
    for index, transcript in enumerate(transcripts):
        label = transcript.title.strip() or f"Source {index + 1}"
        body = transcript.text.strip()
        if len(body) > budget:
            body = f"{body[:budget]}\n[source truncated to fit the model context]"
        blocks.append(f"--- SOURCE: {label} ---\n{body}")

    return "\n\n".join(blocks)


def with_transcript_context(instruction: str, transcripts: List[TranscriptContext]) -> str:
    context = build_context_block(transcripts)
    return instruction if not context else f"{context}\n\n--- INSTRUCTION ---\n{instruction}"


def apply_suffix(text: str) -> str:
    suffix = prompt_suffix()
    return f"{text}\n\n{suffix}" if suffix else text


def build_user_message(prompt: str, transcripts: List[TranscriptContext]) -> str:
    return apply_suffix(with_transcript_context(prompt, transcripts))


def build_chat_messages(
    prompt: str,
    transcripts: List[TranscriptContext],
    history: List[ChatTurn],
) -> List[ChatCompletionMessageParam]:
    """Turns a chat node's history + latest prompt into an OpenAI messages array.

    Transcripts are attached to the first user turn so follow-ups do not repeat
    the full context block. `/no_think` lands only on the latest user message.
    """
    messages: List[ChatCompletionMessageParam] = [
        {"role": "system", "content": SYSTEM_PROMPT},
    ]

    attached_context = False
    for turn in history:
        if not turn.content.strip():
            continue
        content = turn.content
        if not attached_context and turn.role == "user":
            content = with_transcript_context(turn.content, transcripts)
            attached_context = True
        messages.append({"role": turn.role, "content": content})

    if attached_context:
        messages.append({"role": "user", "content": apply_suffix(prompt)})
    else:
        messages.append(
            {"role": "user", "content": build_user_message(prompt, transcripts)}
        )

    return messages


async def open_stream(
    prompt: str,
    transcripts: List[TranscriptContext],
    history: Optional[List[ChatTurn]] = None,
) -> AsyncStream[ChatCompletionChunk]:
    """Opens the completion stream.

    Deliberately separate from token iteration: everything that can fail with a
    real HTTP status — server down, no model loaded, bad model id — happens here,
    before the route commits to a 200 and an SSE body.
    """
    model = await resolve_model()

    try:
        return await get_client().chat.completions.create(
            model=model,
            stream=True,
            temperature=temperature(),
            max_tokens=max_tokens(),
            messages=build_chat_messages(prompt, transcripts, history or []),
        )
    except APIConnectionError as error:
        raise _unreachable() from error
    except APIStatusError as error:
        # Usually a model id the server no longer has loaded. Drop the cached id
        # so a retry re-detects rather than failing the same way forever.
        if not configured_model():
            reset_model_cache()
        raise LlmUnavailable(
            f"{base_url()} rejected the request for model '{model}' "
            f"(HTTP {error.status_code}). Check which model is loaded."
        ) from error


async def iter_tokens(stream: AsyncStream[ChatCompletionChunk]) -> AsyncIterator[str]:
    """Yields non-empty content deltas, closing the upstream stream on exit.

    The close matters on cancellation: without it an abandoned generation keeps
    the GPU busy producing tokens nobody will read.
    """
    try:
        async for chunk in stream:
            if not chunk.choices:
                continue
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta
    finally:
        await stream.close()
