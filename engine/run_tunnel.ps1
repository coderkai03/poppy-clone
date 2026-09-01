# Opens a free Cloudflare quick tunnel to the local engine (Windows).
# The printed *.trycloudflare.com URL is what goes in web/.env.local as
# MAC_MINI_URL. It changes every time this script restarts.

$ErrorActionPreference = "Stop"

$port = if ($env:PORT) { $env:PORT } else { "8000" }

if (-not (Get-Command cloudflared -ErrorAction SilentlyContinue)) {
    Write-Error "cloudflared is not installed. Install it with: winget install Cloudflare.cloudflared"
    exit 1
}

cloudflared tunnel --url "http://localhost:$port"
