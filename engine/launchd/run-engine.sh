#!/bin/bash
# LaunchDaemon entrypoint (system/com.poppy.engine). Must stay in the foreground (exec).
# --loop asyncio: uvloop has hung under launchd on some Macs; the
# interactive `python -m uvicorn` path uses the same app and is fine.
export PYTHONUNBUFFERED=1
cd "$(dirname "$0")/.."
exec ./venv/bin/python -u -m uvicorn app:app \
  --host 127.0.0.1 \
  --port 8000 \
  --loop asyncio
