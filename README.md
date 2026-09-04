# Poppy Clone

A canvas-based multimodal content workspace. Paste a video link, get a transcript,
wire it into a generation node, and stream a markdown synthesis back — on a $0 stack.

- **`web/`** — Next.js 16 (App Router, Tailwind v4, `@xyflow/react`) canvas + API routes.
- **`engine/`** — FastAPI engine: native YouTube captions, `yt-dlp` audio
  extraction, local `faster-whisper` transcription, and local LLM generation.

Everything runs on your own hardware — transcription *and* synthesis. No API keys, no
rate limits, no per-token cost.

## How it works

```
paste URL → MediaSourceNode
              ↓  POST /api/ingest  (x-secret-key)
           engine: YouTube captions? → return immediately
                   otherwise → yt-dlp audio (128kbps mp3) → faster-whisper
              ↓
           TranscriptNode  (editable)
              ↓  drag an edge, or Chat on a vacant source handle
           GenerationNode  (Chat)
              ↓  POST /api/llm  (proxy, keeps the secret server-side)
           engine: POST /llm → local model server (:1234) → GPU
              ↓  SSE stream, piped straight through
           markdown renders token by token
```

Canvas state lives in `localStorage`, so a reload restores your nodes and edges.

### API surface

Both Next routes are proxies. Neither holds a model credential, and neither talks to a
model — that is the engine's job, because the engine is the half that sits next to the GPU.

| Endpoint | Auth | Returns | Notes |
| --- | --- | --- | --- |
| `POST /api/ingest` | none (browser) | JSON | Validates the URL, forwards to engine `/ingest`. 60s timeout. |
| `POST /api/llm` | none (browser) | `text/event-stream` | Validates the body, forwards to engine `/llm`, pipes the SSE body through unmodified. |
| `POST /ingest` | `x-secret-key` | JSON | Captions or Whisper transcription. |
| `POST /llm` | `x-secret-key` | `text/event-stream` | Builds the prompt, streams from the local model. |
| `GET /health` | none | JSON | Whisper + LLM config, incl. the resolved `llm_base_url` / `llm_model`. |

The proxies exist for exactly one reason: `MAC_API_SECRET` must not reach the browser. They
add no model logic — the system prompt, transcript trimming and context cap all live in
`engine/services/llm.py`.

**SSE frame format** (produced by the engine, parsed by `web/hooks/useGenerationStream.ts`):

```
: <2048 spaces>            ← comment-line padding; WebKit buffers the first 1024 bytes
data: {"t": "## Sum"}      ← one content delta per frame
data: {"t": "mary\n\n"}
event: done                ← success terminator
data: {}
```

An `event: error` frame with `{"error": "..."}` replaces `done` if the model fails
*mid-stream*. Failures that happen *before* the first byte — server down, no model loaded,
bad model id — are real HTTP statuses instead (`502`), so the node shows an actionable
message rather than an empty card.

## Prerequisites

- Node.js 20.9+ (Next 16 minimum)
- Python 3.11+
- **`ffmpeg` on PATH** — required only for the Whisper fallback. YouTube videos with
  captions work without it.
  - macOS: `brew install ffmpeg`
  - Windows: `winget install Gyan.FFmpeg`
- **A local OpenAI-compatible model server** for generation. [LM Studio](https://lmstudio.ai)
  is the default (`winget install ElementLabs.LMStudio`); `llama-server`, Ollama and vLLM
  all work too — see [Local model](#local-model).

## Setup

```bash
# 1. Web
cd web
npm install
cp .env.local.example .env.local   # set MAC_API_SECRET

# 2. Engine
cd ../engine
python -m venv venv
source venv/bin/activate           # Windows: venv\Scripts\Activate.ps1
pip install -r requirements.txt
cp .env.example .env               # set MAC_API_SECRET to match web/.env.local
```

`MAC_API_SECRET` must be identical in `web/.env.local` and `engine/.env`. Every
request from Next to the engine carries it as an `x-secret-key` header; a mismatch
is a 401.

## Running

Three processes. From the repo root:

```bash
npm run dev          # Next.js on http://localhost:3000
npm run dev:engine   # FastAPI on http://localhost:8000
lms server start     # model server on :1234 — see Local model below
```

`npm run dev:engine` invokes `engine/venv`'s Python directly (Windows:
`venv\Scripts\python.exe`, Unix: `venv/bin/python`). Activating the venv first
is unnecessary and breaks under npm, which runs scripts through `cmd.exe` on
Windows.

Then open <http://localhost:3000/canvas>.

Ingestion works without the model server; only generation needs it. If it is down, the
generation node shows a `502` telling you so.

On one machine, leave `MAC_MINI_URL=http://localhost:8000` — no tunnel needed.

### Running the engine on a separate machine

Step-by-step SSH deploy to a Mac Mini (venv, tmux, LAN vs tunnel, launchd) is in
[deployment.md](deployment.md).

**The model server belongs on the engine's machine, not the web machine** — the engine
reaches it over `localhost`, so it has to sit next to the GPU doing the work.

Expose the engine with a free Cloudflare quick tunnel:

```bash
npm run tunnel       # or: engine/run_tunnel.sh  /  engine/run_tunnel.ps1
```

Copy the printed `https://<something>.trycloudflare.com` URL into `MAC_MINI_URL`.

> **Quick tunnel URLs are ephemeral.** They change every time `cloudflared`
> restarts, so `MAC_MINI_URL` needs updating each time. Use a named tunnel if that
> gets tedious.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Next dev server |
| `npm run dev:engine` | uvicorn with reload via `engine/venv` (serves `/ingest`, `/llm`, `/health`). Calls the venv interpreter directly — do not `activate` first. |
| `npm run build` | Production build (Turbopack) |
| `npm run typecheck` | `next typegen && tsc --noEmit` |
| `npm run lint` | ESLint flat config |
| `npm run tunnel` | Cloudflare quick tunnel to port 8000 |

## Configuration

### `web/.env.local`

| Key | Notes |
| --- | --- |
| `MAC_MINI_URL` | Engine base URL. |
| `MAC_API_SECRET` | Shared secret; must match the engine. |

That is the whole web config — model settings live on the engine, because the web tier
never talks to a model.

### `engine/.env`

| Key | Notes |
| --- | --- |
| `MAC_API_SECRET` | Shared secret; must match the web app. |
| `WHISPER_MODEL` | `tiny` … `large-v3`. `base` is a good CPU default. |
| `WHISPER_DEVICE` | `cpu`, or `cuda` on an NVIDIA box. |
| `WHISPER_COMPUTE_TYPE` | `int8` on CPU, `float16` on cuda. |
| `PORT` | Defaults to 8000. |
| `LOCAL_LLM_BASE_URL` | OpenAI-compatible endpoint. LM Studio `:1234/v1`, `llama-server` `:8080/v1`, Ollama `:11434/v1`. |
| `LOCAL_LLM_MODEL` | Leave blank to auto-detect whatever the server has loaded. |
| `LOCAL_LLM_MAX_TOKENS` | Caps one generation. Default 1024. |
| `LOCAL_LLM_TEMPERATURE` | Default 0.6. |
| `LOCAL_LLM_PROMPT_SUFFIX` | Default `/no_think`. Suppresses chain-of-thought — see [reasoning models](#reasoning-models). Blank it for a non-reasoning model. |
| `LOCAL_LLM_API_KEY` | Only needed if your server enforces one (e.g. vLLM `--api-key`). LM Studio and `llama-server` ignore it. |

The Whisper model downloads from Hugging Face on first use and is then cached, so
the first Whisper request is slower than later ones.

## Local model

Generation needs a model server running on the same machine as the engine. Any server
speaking `POST /v1/chat/completions` works; point `LOCAL_LLM_BASE_URL` at it.

With LM Studio (the default):

```bash
winget install ElementLabs.LMStudio    # macOS: brew install --cask lm-studio
# Launch the app once — that bootstraps the `lms` CLI into ~/.lmstudio/bin
lms get -y --gguf qwen/qwen3-4b                    # ~2.5 GB Q4
lms server start --port 1234
lms load qwen3-4b --gpu max --context-length 16384
lms ps                                             # confirm it is loaded
```

> `lms` is not added to `PATH` until you open a new shell (or run `lms bootstrap`). Until
> then, call it by full path: `~/.lmstudio/bin/lms` (Windows:
> `%USERPROFILE%\.lmstudio\bin\lms.exe`). There is deliberately no `npm run` script for
> this — the binary lives outside the repo and the path differs per OS.

`GET /health` on the engine echoes the resolved `llm_base_url` and `llm_model`, which is
the quickest way to confirm the engine and the model server agree.

<details>
<summary>If <code>lms get</code> stalls or the model never appears in <code>lms ls</code></summary>

Two failure modes worth knowing, both hit during setup:

**The download stalls at a few percent.** LM Studio's CDN can crawl (38 KB/s observed)
while Hugging Face serves the same file at 15 MB/s. Fetch the GGUF directly into the models
tree instead — the layout is `<models>/<publisher>/<repo>/<file>.gguf`:

```bash
curl -L -C - --retry 5 \
  -o ~/.lmstudio/models/lmstudio-community/Qwen3-4B-GGUF/Qwen3-4B-Q4_K_M.gguf \
  https://huggingface.co/lmstudio-community/Qwen3-4B-GGUF/resolve/main/Qwen3-4B-Q4_K_M.gguf
```

**A hand-placed GGUF is ignored by `lms ls`.** A leftover *pending download* record makes
LM Studio treat the folder as incomplete and skip it — restarting the app is not enough.
Quit LM Studio, delete these from `~/.lmstudio/.internal/`, then restart:
`single-downloads-info.json`, `download-jobs-info.json`, `model-index-cache.json`. They are
caches and LM Studio rebuilds them on launch.

</details>

### Picking a model

Size is a latency decision. On an integrated GPU (e.g. Intel Arc on a Core Ultra), VRAM is
shared with system RAM so capacity is rarely the limit — memory bandwidth is:

| Class | Q4 size | Rough decode | Use when |
| --- | --- | --- | --- |
| ~4B | ~2.5 GB | 15–25 tok/s | Default. Summarising and synthesising transcripts. |
| ~8B | ~4.7 GB | 8–12 tok/s | You want better structure and will wait for it. |

A discrete GPU with dedicated VRAM will comfortably run larger models than this.

Measured on a Core Ultra 7 155H (Arc iGPU, Vulkan) with Qwen3-4B Q4_K_M, ~3.5k-char
transcript, warm model: **0.8s to first token, ~7s total, ~17 tok/s decode.**

> **On Intel Arc, prefer LM Studio or a SYCL `llama.cpp` build over Ollama.** Ollama's
> Vulkan backend regressed against the March 2026 Arc driver and can fall back to 100% CPU
> without saying so. If you do use Ollama, check `ollama ps` reports GPU.

### Reasoning models

Qwen3 and other hybrid reasoning models emit a long chain-of-thought before the answer.
LM Studio streams that separately as `reasoning_content`, which the engine drops — so
without intervention the canvas card sits blank for the whole thinking phase. The engine
appends `LOCAL_LLM_PROMPT_SUFFIX` (default `/no_think`) to the end of the prompt to turn it
off. On Qwen3-4B that is the difference between **30s and 0.8s** to first token.

LM Studio ignores the API-level switches for this (`chat_template_kwargs`
`{"enable_thinking": false}` and a top-level `enable_thinking` both had no effect), so the
prompt-level soft switch is what the engine uses. If you switch to a model that does not
understand `/no_think`, set `LOCAL_LLM_PROMPT_SUFFIX=` to empty so the token is not
appended to your prompts.

## Notes on the spec

Two details in `CLAUDE.md` could not be followed literally, and the code
deliberately differs:

1. **Generation no longer uses OpenRouter at all.** The original spec put an OpenRouter
   client in `web/app/api/llm`, but free-tier models are rate limited and queued, which
   made generation the slowest part of the app. `/api/llm` is now a streaming proxy to the
   engine's `POST /llm`, which runs a local model on the GPU. (`openrouter/free`, the slug
   the spec named, was never a real model id either — it is absent from
   `/api/v1/models`.)
2. **`YouTubeTranscriptApi.get_transcript()` is the pre-1.0 API.** On
   youtube-transcript-api 1.x it is an instance method,
   `YouTubeTranscriptApi().fetch(video_id)`.

## Limitations

- Single user, no server-side persistence — the canvas lives in `localStorage`.
- URL ingestion only; no file uploads.
- Generation requires a local model server to be running; the canvas shows an actionable
  502 on the node if it is not.
- Transcripts are truncated to 24k characters before being sent. On an integrated GPU this
  is a latency guard rather than a context limit — prefill dominates time-to-first-token on
  a long prompt.
