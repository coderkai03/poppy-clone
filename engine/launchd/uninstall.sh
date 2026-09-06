#!/usr/bin/env bash
# Remove Poppy launchd jobs. Does not uninstall cloudflared or the venv.
set -euo pipefail

UID_NUM="$(id -u)"
GUI_DOMAIN="gui/${UID_NUM}"
AGENTS_DIR="${HOME}/Library/LaunchAgents"

sudo launchctl bootout system/com.poppy.engine 2>/dev/null || true
sudo rm -f /Library/LaunchDaemons/com.poppy.engine.plist
echo "removed system/com.poppy.engine"

for label in com.poppy.engine com.poppy.lms; do
  launchctl bootout "${GUI_DOMAIN}/${label}" 2>/dev/null || true
  rm -f "${AGENTS_DIR}/${label}.plist"
  echo "removed gui/${label}"
done

echo "cloudflared is separate. To drop it: sudo cloudflared service uninstall"
