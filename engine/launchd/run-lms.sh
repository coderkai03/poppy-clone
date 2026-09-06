#!/usr/bin/env bash
# LaunchAgent wrapper: keep LM Studio's local OpenAI-compatible server up.
# lms server start may block or daemonize depending on version, so this script
# starts it, loads the model, and exits non-zero if the API disappears (KeepAlive).
set -euo pipefail

HOME_DIR="${POPPY_HOME:-${HOME}}"
export HOME="$HOME_DIR"
export PATH="${HOME_DIR}/.lmstudio/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"

LMS="${HOME_DIR}/.lmstudio/bin/lms"
PORT="${POPPY_LMS_PORT:-1234}"
MODEL="${POPPY_LMS_MODEL:-qwen/qwen3-4b}"
CTX="${POPPY_LMS_CONTEXT:-16384}"
started_server=0

if [[ ! -x "$LMS" ]]; then
  echo "lms not found at $LMS — open LM Studio once on the Mini, then: $LMS bootstrap" >&2
  exit 1
fi

cleanup() {
  if [[ "$started_server" -eq 1 ]]; then
    "$LMS" server stop >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT TERM INT

api_up() {
  curl -sf "http://127.0.0.1:${PORT}/v1/models" >/dev/null
}

"$LMS" daemon up || true

if ! api_up; then
  "$LMS" server start --port "$PORT" &
  server_pid=$!
  started_server=1
  for _ in $(seq 1 90); do
    if api_up; then
      break
    fi
    if ! kill -0 "$server_pid" 2>/dev/null; then
      wait "$server_pid" || true
      break
    fi
    sleep 1
  done
fi

if ! api_up; then
  echo "LM Studio API did not come up on :${PORT}" >&2
  exit 1
fi

"$LMS" load "$MODEL" --gpu max --context-length "$CTX" || \
  echo "warning: lms load ${MODEL} failed; JIT may still serve it on first request" >&2

if [[ -n "${server_pid:-}" ]] && kill -0 "$server_pid" 2>/dev/null; then
  wait "$server_pid"
  exit $?
fi

while api_up; do
  sleep 20
done

echo "LM Studio API on :${PORT} went away" >&2
exit 1
