# CLAUDE.md — Poppy AI Clone Monorepo

## 1. Project Overview & Architecture
Monorepo for an open-source, canvas-based multimodal content workspace.
- **Frontend / Cloud:** Next.js (App Router, Tailwind CSS, TypeScript, Canvas via `@xyflow/react` or `tldraw`) hosted on Vercel. Handles UI state and nodes. Both API routes are thin proxies to the engine; the web tier holds no model credentials.
- **Local Engine:** FastAPI (Python 3.11+) on local hardware (exposed to Vercel via Cloudflare Tunnel). Handles video scraping (`yt-dlp`), native YouTube caption extraction (`youtube-transcript-api`), local speech-to-text (`faster-whisper`), **and LLM generation against a locally hosted model.**
- **Cost Constraint:** 100% $0 stack. All inference — Whisper and the LLM — is local compute.

> **Generation moved off OpenRouter.** It was rate limited, queued and network-bound.
> `/api/llm` now proxies to the engine's `POST /llm`, which calls an OpenAI-compatible
> server on the same machine as the GPU (LM Studio by default). See §6D.

---

## 2. Directory Structure

```

├── web/                  # Next.js 15+ Frontend & Orchestration
│   ├── app/
│   │   ├── api/
│   │   │   ├── ingest/   # Proxy route -> engine /ingest
│   │   │   └── llm/      # Streaming proxy -> engine /llm (SSE pass-through)
│   │   ├── canvas/       # Infinite canvas workspace page
│   │   └── layout.tsx
│   ├── components/
│   │   ├── canvas/       # Custom nodes (MediaNode, LLMNode, TranscriptNode)
│   │   └── ui/           # Radix / Tailwind UI elements
│   ├── hooks/            # Canvas state & stream handlers
│   └── lib/              # engine.ts (shared proxy plumbing) & API schemas
├── engine/               # Python Media, Speech & LLM Server
│   ├── app.py            # FastAPI entry point (/ingest, /llm, /health)
│   ├── services/
│   │   ├── extractor.py  # yt-dlp & youtube-transcript-api logic
│   │   ├── llm.py        # Local OpenAI-compatible client + prompt building
│   │   └── whisper.py    # faster-whisper singleton loader
│   ├── requirements.txt
│   └── run_tunnel.sh     # Cloudflare quick tunnel launcher
└── package.json          # Root npm scripts for monorepo tasks

```

---

## 3. Tech Stack & Key Libraries
- **Web:** Next.js (App Router), `@xyflow/react` (or `tldraw`), `zustand`, `lucide-react`, `tailwindcss`. No `openai` SDK — the web tier never talks to a model.
- **Engine:** `fastapi`, `uvicorn`, `yt-dlp`, `youtube-transcript-api`, `faster-whisper`, `ffmpeg-python`, `pydantic`, `openai` (as the client for the *local* server).
- **AI / LLM:** any OpenAI-compatible server on localhost, addressed via
  `LOCAL_LLM_BASE_URL`; see §6D.

> **Installed versions differ from this doc's original assumptions.** The web app is on
> **Next.js 16.3.3** (not 15), which means Turbopack builds by default, `middleware.ts` is
> renamed `proxy.ts`, `params` is a Promise, and `runtime = 'edge'` is deprecated. Per
> `AGENTS.md`, read `web/node_modules/next/dist/docs/` before writing route or config code.

---

## 4. Environment Variables

### `web/.env.local`
```env
MAC_MINI_URL=https://<your-tunnel-url>.trycloudflare.com
MAC_API_SECRET=your-shared-secret-auth-key

```

### `engine/.env`

```env
MAC_API_SECRET=your-shared-secret-auth-key
WHISPER_MODEL=base
WHISPER_DEVICE=cpu
WHISPER_COMPUTE_TYPE=int8
PORT=8000

# Local LLM. LM Studio: 1234 | llama-server: 8080 | Ollama: 11434
LOCAL_LLM_BASE_URL=http://localhost:1234/v1
# Blank auto-detects whichever model the server has loaded
LOCAL_LLM_MODEL=
LOCAL_LLM_MAX_TOKENS=1024
LOCAL_LLM_TEMPERATURE=0.6
# Suppresses chain-of-thought on reasoning models; blank to allow thinking
LOCAL_LLM_PROMPT_SUFFIX=/no_think

```

> **No model credentials in `web/.env.local`.** The web tier only needs to reach the
> engine. Everything about the model lives on the engine, next to the GPU.

---

## 5. Development & Run Commands

### Web App (Next.js)

* Install: `cd web && npm install`
* Run Dev: `npm run dev` (starts on `http://localhost:3000`)
* Build: `npm run build`
* Typecheck / Lint: `npm run typecheck && npm run lint`

### Engine (FastAPI)

* Setup Venv: `cd engine && python3 -m venv venv && source venv/bin/activate` (Windows: `py -3.11 -m venv venv` then `venv\Scripts\Activate.ps1`)
* Install: `pip install -r requirements.txt` (Ensure system `ffmpeg` is installed: `brew install ffmpeg` / `winget install Gyan.FFmpeg`)
* Run Dev: from repo root, `npm run dev:engine` (uses `engine/venv` Python; do not activate)
* Launch Free Tunnel: `cloudflared tunnel --url http://localhost:8000`
* Deploy the engine to a Mac Mini over SSH: see [deployment.md](deployment.md)

### Local Model Server (required for generation)

* Install: `winget install ElementLabs.LMStudio` (the `lms` CLI is bootstrapped on first
  GUI launch, at `~/.lmstudio/bin/lms`).
* Get a model: `lms get -y --gguf qwen/qwen3-4b` (~2.5 GB Q4; a ~4B model is the sweet spot
  on an Arc iGPU).
* Serve: `lms server start` — listens on `:1234`, which is `LOCAL_LLM_BASE_URL`'s default.
* Confirm GPU offload: `lms ps` should show the model on the GPU, not CPU. `lms runtime ls`
  lists the installed inference runtimes.

---

## 6. Implementation Protocols & Core Rules

### A. Media Extraction Fallback Flow (`engine/services/extractor.py`)

1. Detect URL domain: YouTube, TikTok, or Instagram.
2. **If YouTube:** First attempt native captions. If they exist, return immediately without downloading any media stream.
* youtube-transcript-api 1.x moved this off the class: use `YouTubeTranscriptApi().fetch(video_id)`, which returns a `FetchedTranscript` whose `.snippets` carry the text. The `get_transcript(video_id)` classmethod this doc originally named was removed before 1.0.
3. **If TikTok / IG / Captions Missing:**
* Use `yt-dlp` to extract audio stream only (128kbps MP3) to a temporary directory (`tempfile`).
* Run `faster-whisper` transcription on the temporary audio file.
* Clean up temp files immediately in a `finally:` block.


4. Always validate output non-empty; throw `HTTPException(422)` if no speech or captions found.

### B. Security & Connectivity

* All requests between Next.js and the FastAPI engine must include `x-secret-key: MAC_API_SECRET` in the headers. Reject missing/mismatched headers with `HTTP 401`.

### C. Canvas State Management

* Canvas nodes must support 3 core types:
1. `MediaSourceNode`: Displays video thumbnail, platform badge, and original URL.
2. `TranscriptNode`: Displays editable raw text extracted from the media.
3. `GenerationNode`: Displays markdown synthesis streamed from the local model.


* Connecting an edge from `TranscriptNode` to a `GenerationNode` passes the transcript context into the prompt payload.

### D. Local LLM Guidelines (`engine/services/llm.py`)

* Generation runs on the engine, not the web tier. `POST /api/llm` validates the body, then
proxies to the engine's `POST /llm` and pipes the SSE body straight through. The proxy
exists only to keep `MAC_API_SECRET` server-side.
* The engine talks to **any** OpenAI-compatible server via `LOCAL_LLM_BASE_URL`, so the
runtime is a config choice. Default is LM Studio on `:1234` — the most reliable Vulkan path
to an Intel Arc iGPU on Windows. Ollama's Vulkan backend regressed against the March 2026
Arc driver and can silently fall back to 100% CPU.
* `LOCAL_LLM_MODEL` may be left blank: the engine calls `GET /v1/models` and uses whatever
is loaded, so a fresh install needs no configuration. A stale cached id is dropped
automatically when a request fails on it.
* **Open the stream before returning a response.** Everything that can fail with a real
status — server down, no model loaded, bad model id — must happen in the route body, so a
dead server yields a `502` instead of a `200` whose body is one error frame. Only
mid-stream failures become `event: error` frames.
* SSE wire format is fixed by `web/hooks/useGenerationStream.ts`: a comment-line padding
preamble (WebKit buffers the first 1024 bytes), then `data: {"t": "..."}` token frames,
terminated by `event: done` or `event: error`.
* **Suppress chain-of-thought.** Hybrid reasoning models (the whole Qwen3 family) spend
hundreds of tokens thinking before the first word of the answer. LM Studio reports that as
`delta.reasoning_content`, which `iter_tokens` drops — so the canvas sits blank for the
entire thinking phase. `LOCAL_LLM_PROMPT_SUFFIX` (default `/no_think`) is appended to the
end of the user turn to switch it off. Measured on Qwen3-4B, same prompt:
**TTFT 30s → 0.8s, total 39s → 7.2s.** Note LM Studio silently ignores both
`chat_template_kwargs: {enable_thinking: false}` and a top-level `enable_thinking`; the
prompt-level soft switch is the only lever that works. Blank it for a non-reasoning model.
* System prompts must strictly request markdown formatting for canvas card rendering.
* Transcript context is capped at `MAX_CONTEXT_CHARS` in `engine/services/llm.py`. On an
integrated GPU this is a **latency** control, not a context-window one: prefill dominates
time-to-first-token on a transcript-sized prompt.

---

## 7. Code Conventions & Error Handling

* **TypeScript:** Strict mode enabled. No explicit `any` without inline justification.
* **Python:** Use type hints throughout (`pydantic` models for all endpoints).
* **Graceful Timeouts:** Set Next.js `fetch` timeout to 60s for Whisper processing calls; provide visual loading indicators on canvas nodes during ingestion.
* **Never put a whole-request timeout on a streaming proxy.** `AbortSignal.timeout` aborts
the response body too, so it kills a legitimately slow generation mid-stream. `/api/llm`
instead forwards `request.signal`, which is also what makes cancelling a node stop the GPU
work rather than leaving the model generating into a dead socket.


@AGENTS.md
