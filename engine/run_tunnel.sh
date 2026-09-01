#!/usr/bin/env bash
# Opens a free Cloudflare quick tunnel to the local engine.
# The printed *.trycloudflare.com URL is what goes in web/.env.local as
# MAC_MINI_URL. It changes every time this script restarts.
set -euo pipefail

PORT="${PORT:-8000}"

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "cloudflared is not installed. Install it with: brew install cloudflared" >&2
  exit 1
fi

exec cloudflared tunnel --url "http://localhost:${PORT}"
