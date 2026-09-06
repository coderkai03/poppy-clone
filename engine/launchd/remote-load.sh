#!/usr/bin/env bash
# Run ON the Mini after scp. Fills plist templates and installs:
#   com.poppy.engine  -> LaunchDaemon (survives reboot, no GUI session)
#   com.poppy.lms     -> LaunchAgent  (Metal / logged-in user)
#
# LaunchDaemons cannot read Desktop/Documents/Downloads (macOS TCC).
# If this clone lives there, it is copied to ~/poppy-clone first.
set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Run this on the Mac Mini, not Windows." >&2
  exit 1
fi

LAUNCHD_DIR="$(cd "$(dirname "$0")" && pwd)"
ENGINE_DIR="$(cd "${LAUNCHD_DIR}/.." && pwd)"
USER_NAME="$(id -un)"
HOME_DIR="$HOME"
UID_NUM="$(id -u)"
LOG_DIR="${HOME_DIR}/Library/Logs"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

tcc_unsafe() {
  case "$1" in
    */Desktop/*|*/Documents/*|*/Downloads/*) return 0 ;;
    *) return 1 ;;
  esac
}

# Strip a Windows CR if scp brought one along.
for f in "${LAUNCHD_DIR}/"*.sh "${LAUNCHD_DIR}/"*.tmpl; do
  [[ -f "$f" ]] || continue
  sed -i '' 's/\r$//' "$f" 2>/dev/null || true
done
chmod +x "${LAUNCHD_DIR}/run-engine.sh" "${LAUNCHD_DIR}/run-lms.sh" "${LAUNCHD_DIR}/remote-load.sh"
xattr -cr "$LAUNCHD_DIR" 2>/dev/null || true

if tcc_unsafe "$ENGINE_DIR"; then
  SAFE_ROOT="${HOME_DIR}/poppy-clone"
  REPO_DIR="$(cd "${ENGINE_DIR}/.." && pwd)"
  echo "LaunchDaemons cannot execute from Desktop/Documents/Downloads."
  echo "Copying ${REPO_DIR} -> ${SAFE_ROOT}"
  mkdir -p "$SAFE_ROOT"
  rsync -a "$REPO_DIR/" "$SAFE_ROOT/"
  ENGINE_DIR="${SAFE_ROOT}/engine"
  LAUNCHD_DIR="${ENGINE_DIR}/launchd"
  chmod +x "${LAUNCHD_DIR}/run-engine.sh" "${LAUNCHD_DIR}/run-lms.sh"
  xattr -cr "$LAUNCHD_DIR" 2>/dev/null || true
fi

if [[ ! -x "${ENGINE_DIR}/venv/bin/python" ]]; then
  echo "Missing ${ENGINE_DIR}/venv/bin/python" >&2
  exit 1
fi

PY_VER="$("${ENGINE_DIR}/venv/bin/python" -c 'import sys; print("%d.%d" % (sys.version_info[0], sys.version_info[1]))')"
if [[ "$PY_VER" == "3.14" || "$PY_VER" == "3.15" ]]; then
  echo "venv is Python ${PY_VER}. Recreate with 3.12 first." >&2
  exit 1
fi

mkdir -p "$LOG_DIR" "${HOME_DIR}/Library/LaunchAgents"

fill() {
  local src="$1" dest="$2"
  sed \
    -e "s|__USER__|${USER_NAME}|g" \
    -e "s|__HOME__|${HOME_DIR}|g" \
    -e "s|__ENGINE_DIR__|${ENGINE_DIR}|g" \
    -e "s|__LAUNCHD_DIR__|${LAUNCHD_DIR}|g" \
    "$src" > "$dest"
}

fill "${LAUNCHD_DIR}/com.poppy.engine.plist.tmpl" "${TMP_DIR}/com.poppy.engine.plist"
fill "${LAUNCHD_DIR}/com.poppy.lms.plist.tmpl" "${TMP_DIR}/com.poppy.lms.plist"

# Drop the broken/user LaunchAgent so it does not fight the daemon.
launchctl bootout "gui/${UID_NUM}/com.poppy.engine" 2>/dev/null || true
rm -f "${HOME_DIR}/Library/LaunchAgents/com.poppy.engine.plist"

echo "Installing engine LaunchDaemon (needs your Mini sudo password)..."
sudo cp "${TMP_DIR}/com.poppy.engine.plist" /Library/LaunchDaemons/com.poppy.engine.plist
sudo chown root:wheel /Library/LaunchDaemons/com.poppy.engine.plist
sudo chmod 644 /Library/LaunchDaemons/com.poppy.engine.plist
sudo launchctl bootout system/com.poppy.engine 2>/dev/null || true
pkill -f 'uvicorn app:app' 2>/dev/null || true
sudo launchctl bootstrap system /Library/LaunchDaemons/com.poppy.engine.plist
sudo launchctl enable system/com.poppy.engine 2>/dev/null || true
sudo launchctl kickstart -k system/com.poppy.engine

cp "${TMP_DIR}/com.poppy.lms.plist" "${HOME_DIR}/Library/LaunchAgents/com.poppy.lms.plist"
launchctl bootout "gui/${UID_NUM}/com.poppy.lms" 2>/dev/null || true
launchctl bootstrap "gui/${UID_NUM}" "${HOME_DIR}/Library/LaunchAgents/com.poppy.lms.plist"
launchctl kickstart -k "gui/${UID_NUM}/com.poppy.lms" 2>/dev/null || true

ok=0
for _ in $(seq 1 15); do
  if curl -sf --max-time 2 http://127.0.0.1:8000/health >/dev/null; then
    ok=1
    break
  fi
  sleep 1
done

echo
if [[ "$ok" -eq 1 ]]; then
  curl -sS http://127.0.0.1:8000/health
  echo
  echo "Engine LaunchDaemon is up from ${ENGINE_DIR} (survives reboot)."
else
  echo "Engine did not bind :8000. Stopping the crash loop. Logs:" >&2
  sudo launchctl bootout system/com.poppy.engine 2>/dev/null || true
  cat "${LOG_DIR}/poppy-engine.err" >&2 || true
  exit 1
fi
