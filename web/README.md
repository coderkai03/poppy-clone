# web

Next.js frontend and API routes for Poppy Clone.

Both API routes (`app/api/ingest`, `app/api/llm`) are **thin proxies to the engine** — they
hold no model credentials and call no model. `/api/llm` streams SSE straight through from
the engine, which runs the LLM locally on the GPU. Prompt building and the context cap live
in `engine/services/llm.py`, not here.

See the [root README](../README.md) for setup, environment variables, the API surface and
how this half talks to the `engine/` half.

```bash
npm install
npm run dev        # http://localhost:3000
npm run typecheck
npm run lint
```
