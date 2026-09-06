#!/usr/bin/env bash
# Diagnose and repair com.poppy.engine when launchd says "running"
# but nothing listens on :8000 (Funnel /health returns 502).
set -u

ENGINE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LAUNCHD_DIR="$(cd "$(dirname "$0")" && pwd)"
VENV_PY="${ENGINE_DIR}/venv/bin/python"
UID_NUM="$(id -u)"
LABEL="gui/${UID_NUM}/com.poppy.engine"
LOG_DIR="${HOME}/Library/Logs"

echo "==== diagnose ===="
echo "host=$(hostname) user=$(whoami) date=$(date)"
if [[ -x "$VENV_PY" ]]; then
  ls -la "${ENGINE_DIR}/venv/bin/python" "${ENGINE_DIR}/venv/bin/python3" 2>/dev/null || true
  echo -n "venv python: "
  "$VENV_PY" -V 2>&1 || echo "venv python failed to start"
else
  echo "no venv python at $VENV_PY"
fi

echo "---- processes ----"
ps aux | grep -E '[u]vicorn|[P]oppy|[f]aster.whisper' || true
echo "---- :8000 ----"
lsof -nP -iTCP:8000 -sTCP:LISTEN || echo "nothing listening on :8000"
echo "---- launchd pid ----"
launchctl print "$LABEL" 2>/dev/null | grep -E 'pid|state|runs|last exit' || true
echo "---- engine logs ----"
echo "(err)"
cat "${LOG_DIR}/poppy-engine.err" 2>/dev/null || echo "(no err file)"
echo "(log)"
cat "${LOG_DIR}/poppy-engine.log" 2>/dev/null || echo "(no log file)"

if curl -sf --max-time 2 http://127.0.0.1:8000/health; then
  echo
  echo "localhost /health is already ok. Funnel 502 is stale or a Funnel problem."
  exit 0
fi

echo
echo "==== import probe (20s) ===="
if [[ -x "$VENV_PY" ]]; then
  cd "$ENGINE_DIR"
  "$VENV_PY" -u -c "print('python-ok', flush=True); import app; print('import-ok', flush=True)" &
  probe_pid=$!
  for i in $(seq 1 20); do
    if ! kill -0 "$probe_pid" 2>/dev/null; then
      wait "$probe_pid"
      probe_rc=$?
      echo "import probe exited rc=${probe_rc}"
      break
    fi
    sleep 1
  done
  if kill -0 "$probe_pid" 2>/dev/null; then
    echo "import probe HUNG — likely Python 3.14 + faster-whisper/ctranslate2"
    kill "$probe_pid" 2>/dev/null || true
    wait "$probe_pid" 2>/dev/null || true
  fi
fi

echo
echo "==== repair: Python 3.12 venv ===="
PY312=""
for c in /opt/homebrew/bin/python3.12 /usr/local/bin/python3.12; do
  if [[ -x "$c" ]]; then
    PY312="$c"
    break
  fi
done
if [[ -z "$PY312" ]]; then
  if command -v brew >/dev/null 2>&1; then
    echo "installing python@3.12 via Homebrew"
    brew install python@3.12
    PY312="/opt/homebrew/bin/python3.12"
  fi
fi
if [[ ! -x "${PY312:-}" ]]; then
  echo "python3.12 is required. Install: brew install python@3.12" >&2
  exit 1
fi
echo "using $PY312 ($("$PY312" -V))"

launchctl bootout "$LABEL" 2>/dev/null || true
cd "$ENGINE_DIR"
"$PY312" -m venv --clear venv
./venv/bin/pip install --upgrade pip
./venv/bin/pip install -r requirements.txt
./venv/bin/python -c "import app; print('import-ok')"

chmod +x "${LAUNCHD_DIR}/install.sh" "${LAUNCHD_DIR}/run-lms.sh"
# Re-write plists (PYTHONUNBUFFERED) and start both jobs.
"${LAUNCHD_DIR}/install.sh" --skip-sleep

echo
echo "==== wait for :8000 ===="
ok=0
for i in $(seq 1 20); do
  if curl -sf --max-time 2 http://127.0.0.1:8000/health; then
    echo
    ok=1
    break
  fi
  sleep 1
done
if [[ "$ok" -ne 1 ]]; then
  echo "still down. last err:" >&2
  cat "${LOG_DIR}/poppy-engine.err" >&2 || true
  exit 1
fi

echo
echo "engine is up on localhost. Funnel should stop 502 without a restart:"
echo "  curl -sS https://mac-mini.tailed6607.ts.net/health"
