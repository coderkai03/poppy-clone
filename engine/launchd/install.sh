#!/usr/bin/env bash
# Legacy extras (sleep / Cloudflare token). The Mini server install is
# remote-load.sh via push-and-load.ps1 — see deployment.md.
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: ./install.sh [options]

  --tunnel-token TOKEN   Install cloudflared as a launch daemon with a
                         remotely-managed Cloudflare tunnel token.
  --skip-sleep           Do not change pmset (Mini may still sleep).
  --lms-model NAME       Model id passed to `lms load` (default: qwen/qwen3-4b).
  --help                 Show this help.

Run this ON the Mac Mini, from the clone:

  cd ~/Desktop/github/poppy-clone/engine/launchd
  chmod +x install.sh run-lms.sh uninstall.sh
  ./install.sh
EOF
}

TUNNEL_TOKEN=""
SKIP_SLEEP=0
LMS_MODEL="${POPPY_LMS_MODEL:-qwen/qwen3-4b}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --tunnel-token)
      TUNNEL_TOKEN="${2:?--tunnel-token requires a value}"
      shift 2
      ;;
    --skip-sleep) SKIP_SLEEP=1; shift ;;
    --lms-model)
      LMS_MODEL="${2:?--lms-model requires a value}"
      shift 2
      ;;
    --help|-h) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 1 ;;
  esac
done

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This installer is for macOS. Run it on the Mini, not Windows." >&2
  exit 1
fi

LAUNCHD_DIR="$(cd "$(dirname "$0")" && pwd)"
ENGINE_DIR="$(cd "${LAUNCHD_DIR}/.." && pwd)"
PYTHON="${ENGINE_DIR}/venv/bin/python"
LMS="${HOME}/.lmstudio/bin/lms"
UID_NUM="$(id -u)"
GUI_DOMAIN="gui/${UID_NUM}"
AGENTS_DIR="${HOME}/Library/LaunchAgents"
LOG_DIR="${HOME}/Library/Logs"
ENGINE_PLIST="${AGENTS_DIR}/com.poppy.engine.plist"
LMS_PLIST="${AGENTS_DIR}/com.poppy.lms.plist"

if [[ ! -x "$PYTHON" ]]; then
  echo "Missing engine venv at ${PYTHON}" >&2
  echo "On the Mini: cd ${ENGINE_DIR} && /opt/homebrew/bin/python3.12 -m venv venv && ./venv/bin/pip install -r requirements.txt" >&2
  echo "Do not use Homebrew's default python3 if it is 3.14 — faster-whisper hangs and launchd looks 'running' with empty logs." >&2
  exit 1
fi

PY_VER="$("$PYTHON" -c 'import sys; print("%d.%d" % (sys.version_info[0], sys.version_info[1]))' 2>/dev/null || true)"
if [[ "$PY_VER" == "3.14" || "$PY_VER" == "3.15" ]]; then
  echo "engine/venv is Python ${PY_VER}. faster-whisper/ctranslate2 hang on 3.14+." >&2
  echo "Recreate with 3.12, then re-run this installer:" >&2
  echo "  ./fix-mini-engine.sh" >&2
  echo "  # or: cd ${ENGINE_DIR} && /opt/homebrew/bin/python3.12 -m venv --clear venv && ./venv/bin/pip install -r requirements.txt" >&2
  exit 1
fi

if [[ ! -f "${ENGINE_DIR}/.env" ]]; then
  echo "Missing ${ENGINE_DIR}/.env — copy .env.example to .env (not .env.local) and set MAC_API_SECRET." >&2
  if [[ -f "${ENGINE_DIR}/.env.local" ]]; then
    echo "Found .env.local instead. The engine only reads engine/.env. Rename it:" >&2
    echo "  mv ${ENGINE_DIR}/.env.local ${ENGINE_DIR}/.env" >&2
  fi
  exit 1
fi

if [[ ! -x "$LMS" ]]; then
  echo "Missing ${LMS}" >&2
  echo "Open LM Studio once from the Mini desktop, then: ${LMS} bootstrap" >&2
  exit 1
fi

chmod +x "${LAUNCHD_DIR}/run-engine.sh" "${LAUNCHD_DIR}/run-lms.sh" "${LAUNCHD_DIR}/uninstall.sh" 2>/dev/null || true
mkdir -p "$AGENTS_DIR" "$LOG_DIR"

# Homebrew ffmpeg must be on PATH for the Whisper fallback.
PATH_VALUE="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"

write_engine_plist() {
  cat > "$ENGINE_PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.poppy.engine</string>
  <key>WorkingDirectory</key>
  <string>${ENGINE_DIR}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>${LAUNCHD_DIR}/run-engine.sh</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>HOME</key>
    <string>${HOME}</string>
    <key>PATH</key>
    <string>${PATH_VALUE}</string>
    <key>PYTHONUNBUFFERED</key>
    <string>1</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ThrottleInterval</key>
  <integer>10</integer>
  <key>StandardOutPath</key>
  <string>${LOG_DIR}/poppy-engine.log</string>
  <key>StandardErrorPath</key>
  <string>${LOG_DIR}/poppy-engine.err</string>
</dict>
</plist>
EOF
}

write_lms_plist() {
  cat > "$LMS_PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.poppy.lms</string>
  <key>WorkingDirectory</key>
  <string>${HOME}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>${LAUNCHD_DIR}/run-lms.sh</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>HOME</key>
    <string>${HOME}</string>
    <key>PATH</key>
    <string>${HOME}/.lmstudio/bin:${PATH_VALUE}</string>
    <key>POPPY_HOME</key>
    <string>${HOME}</string>
    <key>POPPY_LMS_MODEL</key>
    <string>${LMS_MODEL}</string>
    <key>POPPY_LMS_PORT</key>
    <string>1234</string>
    <key>POPPY_LMS_CONTEXT</key>
    <string>16384</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ThrottleInterval</key>
  <integer>15</integer>
  <key>StandardOutPath</key>
  <string>${LOG_DIR}/poppy-lms.log</string>
  <key>StandardErrorPath</key>
  <string>${LOG_DIR}/poppy-lms.err</string>
</dict>
</plist>
EOF
}

# A prior hung Python (3.14 import, or a launchd pid that never bound
# :8000) will keep the job "running" and block a healthy uvicorn.
pkill -f 'uvicorn app:app' 2>/dev/null || true

load_agent() {
  local label="$1"
  local plist="$2"
  launchctl bootout "${GUI_DOMAIN}/${label}" 2>/dev/null || true
  launchctl bootstrap "$GUI_DOMAIN" "$plist"
  launchctl enable "${GUI_DOMAIN}/${label}" 2>/dev/null || true
  launchctl kickstart -k "${GUI_DOMAIN}/${label}"
}

write_engine_plist
write_lms_plist
load_agent com.poppy.engine "$ENGINE_PLIST"
load_agent com.poppy.lms "$LMS_PLIST"

if command -v lsof >/dev/null 2>&1; then
  slept=0
  while [[ "$slept" -lt 8 ]]; do
    if lsof -nP -iTCP:8000 -sTCP:LISTEN >/dev/null 2>&1; then
      break
    fi
    sleep 1
    slept=$((slept + 1))
  done
  if ! lsof -nP -iTCP:8000 -sTCP:LISTEN >/dev/null 2>&1; then
    echo "warning: nothing is listening on :8000 — launchd can report 'running' while Python is hung on import." >&2
    echo "  cat ${LOG_DIR}/poppy-engine.err" >&2
    echo "  ${LAUNCHD_DIR}/fix-mini-engine.sh" >&2
  fi
fi

echo "LaunchAgents installed:"
echo "  ${ENGINE_PLIST}"
echo "  ${LMS_PLIST}"

if [[ "$SKIP_SLEEP" -eq 0 ]]; then
  if sudo -n true 2>/dev/null; then
    sudo pmset -a sleep 0 disksleep 0
    echo "Sleep disabled (pmset sleep 0)."
  else
    echo "Sleep is still on. Run once (needs your password):"
    echo "  sudo pmset -a sleep 0 disksleep 0"
  fi
fi

if [[ -n "$TUNNEL_TOKEN" ]]; then
  CF="$(command -v cloudflared || true)"
  if [[ -z "$CF" ]]; then
    echo "cloudflared not on PATH. Install with: brew install cloudflared" >&2
    exit 1
  fi
  sudo "$CF" service install "$TUNNEL_TOKEN"
  echo "cloudflared installed as a system service (starts at boot)."
else
  echo
  echo "Cloudflare tunnel is not installed yet. Create a remotely-managed"
  echo "tunnel in the Zero Trust dashboard, then either re-run:"
  echo "  ./install.sh --tunnel-token '<paste-token>'"
  echo "or:"
  echo "  sudo cloudflared service install '<paste-token>'"
fi

echo
echo "Checks (give LM Studio ~30s to load the model):"
echo "  curl -s http://127.0.0.1:8000/health"
echo "  curl -s http://127.0.0.1:1234/v1/models"
echo "  tail -f ${LOG_DIR}/poppy-engine.err ${LOG_DIR}/poppy-lms.err"
echo
echo "You can close SSH. These jobs belong to launchd, not your session."
