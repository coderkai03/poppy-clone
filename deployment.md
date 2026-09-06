# Deploying the engine to a Mac Mini

The canvas (`web/`) stays on the laptop or Vercel. The Mini runs the **engine**
(FastAPI) and the **model server**. Those two share a machine: the engine talks
to the model at `LOCAL_LLM_BASE_URL` (`http://localhost:1234/v1` by default).

```
laptop / Vercel                         Mac Mini  (~/poppy-clone)
┌─────────────────────┐                 ┌──────────────────────────────┐
│  Next.js  :3000     │  MAC_MINI_URL   │  LaunchDaemon  :8000         │
│  /api/ingest        │ ──────────────► │  /ingest  /llm  /health      │
│  /api/llm  (SSE)    │  x-secret-key   │         │                    │
└─────────────────────┘                 │         ▼ localhost:1234     │
                                        │  LM Studio (LaunchAgent)     │
                                        └──────────────────────────────┘
```

Do not copy `engine/venv` from Windows. Recreate it on the Mini with **Python 3.12**.

For everything on one box, skip this file and use the [README](README.md#running).

---

## What is actually running (this install)

| Piece | Where | Survives SSH close | Survives reboot |
| --- | --- | --- | --- |
| Engine | LaunchDaemon `system/com.poppy.engine` → uvicorn on `127.0.0.1:8000` | yes | yes (even before login) |
| Model | LaunchAgent `gui/…/com.poppy.lms` → LM Studio `:1234` | yes | yes, **after automatic login** |
| Public URL | Tailscale Funnel `https://<machine>.<tailnet>.ts.net` → `:8000` | yes | yes, if Funnel stays enabled |

The checkout the daemon executes is **`~/poppy-clone`**, not Desktop. macOS TCC
blocks LaunchDaemons from `Desktop` / `Documents` / `Downloads`
(`run-engine.sh: Operation not permitted`). `remote-load.sh` copies a Desktop
clone there on first load.

Logs: `~/Library/Logs/poppy-engine.log` (and `.err`), `poppy-lms.log`.

Do not leave `uvicorn` or `cloudflared tunnel --url` in a bare SSH prompt.

---

## 1. Enable SSH

On the Mini: **System Settings → General → Sharing → Remote Login**.

From the laptop (LAN `.local`, LAN IP, or Tailscale IP):

```powershell
ssh rianc@100.77.134.91
```

---

## 2. One-time tools on the Mini

```bash
brew install python@3.12 ffmpeg git
# Use 3.12, not `python3` — Homebrew's default 3.14 hangs faster-whisper.
brew install --cask lm-studio
```

`ffmpeg` is only for the Whisper fallback (TikTok / IG / YouTube with no captions).

Open LM Studio **once on the Mini desktop** so `~/.lmstudio/bin/lms` exists:

```bash
export PATH="$HOME/.lmstudio/bin:$PATH"
~/.lmstudio/bin/lms bootstrap
lms get -y --gguf qwen/qwen3-4b
```

The load id is `qwen/qwen3-4b`, not `qwen3-4b`. Leave JIT model loading on in
LM Studio Developer settings.

---

## 3. First checkout

Clone into **the home directory**, not Desktop:

```bash
cd ~
git clone <your-repo-url> poppy-clone
cd poppy-clone/engine
/opt/homebrew/bin/python3.12 -m venv venv
./venv/bin/pip install -r requirements.txt
cp .env.example .env
```

`engine/.env` (not `.env.local`). `MAC_API_SECRET` must match `web/.env.local`.

```env
MAC_API_SECRET=change-me-to-a-long-random-string
WHISPER_MODEL=base
WHISPER_DEVICE=cpu
WHISPER_COMPUTE_TYPE=int8
PORT=8000
LOCAL_LLM_BASE_URL=http://localhost:1234/v1
LOCAL_LLM_MODEL=
LOCAL_LLM_MAX_TOKENS=1024
LOCAL_LLM_TEMPERATURE=0.6
LOCAL_LLM_PROMPT_SUFFIX=/no_think
```

Leave `LOCAL_LLM_MODEL` blank to auto-detect whatever LM Studio has loaded.

If you already cloned under `~/Desktop/github/poppy-clone`, leave it. The loader
rsyncs that tree to `~/poppy-clone` and points launchd at the copy.

---

## 4. Stay awake and logged in

The engine daemon does not need a GUI. LM Studio (Metal) does.

1. **Users & Groups → Automatic login** → the Mini user.
2. **Energy** → prevent sleep when the display is off.
3. Once: `sudo pmset -a sleep 0 disksleep 0`
4. Do not log that user out.

---

## 5. Install launchd from the PC

Plists live in `engine/launchd/`. Do not paste XML into SSH (the paste gets
truncated and launchd loads a broken file).

From PowerShell in the repo:

```powershell
.\engine\launchd\push-and-load.ps1 rianc@100.77.134.91
```

That `scp`s `engine/launchd` onto the Mini checkout, then runs
`./remote-load.sh`. Type the Mini password for `scp`/`ssh`, then once for `sudo`.

By hand:

```powershell
scp -r G:\poppy-clone\engine\launchd rianc@100.77.134.91:~/Desktop/github/poppy-clone/engine/
ssh -t rianc@100.77.134.91 "cd ~/Desktop/github/poppy-clone/engine/launchd && chmod +x remote-load.sh && ./remote-load.sh"
```

After the first success, later copies can go straight to the safe tree:

```powershell
.\engine\launchd\push-and-load.ps1 rianc@100.77.134.91 -RemoteEngine "~/poppy-clone/engine"
```

Success looks like:

```text
{"status":"ok", ...}
Engine LaunchDaemon is up from /Users/rianc/poppy-clone/engine (survives reboot).
```

`/health` is unauthenticated. `/ingest` and `/llm` need `x-secret-key`.

Unload: on the Mini, `~/poppy-clone/engine/launchd/uninstall.sh`.

---

## 6. Public URL (Tailscale Funnel)

This install uses Funnel (free on Tailscale Personal; no Cloudflare domain).

On the Mini, once:

```bash
sudo tailscale funnel --bg 8000
tailscale funnel status
```

Put the printed `https://<machine>.<tailnet>.ts.net` in `web/.env.local`:

```env
MAC_MINI_URL=https://mac-mini.tailed6607.ts.net
MAC_API_SECRET=<identical to engine/.env on the Mini>
```

Restart `npm run dev` (or redeploy Vercel). Open `/canvas`. Then close SSH.

Funnel proxies to `http://127.0.0.1:8000`. A **502** from the `*.ts.net` host
means the engine is down, not that Funnel is misconfigured.

Same-tailnet only (no Vercel) can skip Funnel and use
`MAC_MINI_URL=http://100.x.x.x:8000` if you change the daemon `--host` to
`0.0.0.0` and `sudo launchctl kickstart -k system/com.poppy.engine`.

A Cloudflare **named** tunnel is optional if you later want a custom domain.
Quick `*.trycloudflare.com` tunnels change URL on every restart — do not use
them on the Mini. See the [Cloudflare tunnel docs](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/).

---

## 7. Day-to-day updates

After you push, from the laptop. The live tree is `~/poppy-clone`:

```powershell
ssh rianc@100.77.134.91 "cd ~/poppy-clone && git pull && engine/venv/bin/pip install -r engine/requirements.txt"
ssh rianc@100.77.134.91 "sudo launchctl kickstart -k system/com.poppy.engine"
```

Re-run `pip install` only when `engine/requirements.txt` changed.

If launchd files changed, re-run `push-and-load.ps1` (not only `git pull` on
Desktop — the daemon reads `~/poppy-clone`).

Reload LM Studio:

```powershell
ssh rianc@100.77.134.91 "launchctl kickstart -k gui/`id -u`/com.poppy.lms"
```

---

## 8. Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| Funnel **502** on `/health` | Nothing on `127.0.0.1:8000`. `curl` localhost on the Mini; read `~/Library/Logs/poppy-engine.err`. |
| `run-engine.sh: Operation not permitted` / `getcwd` | Daemon pointed at Desktop. `sudo launchctl bootout system/com.poppy.engine`, then `push-and-load.ps1` (copies to `~/poppy-clone`). |
| `env: bash\r` | Windows CRLF on a `.sh`. `remote-load.sh` strips CR; or `sed -i '' 's/\r$//' *.sh`. |
| `launchctl` **running**, empty logs, `:8000` dead | Hung Python 3.14 import, or a stuck PID. `python -V` must be 3.12. `sudo launchctl bootout system/com.poppy.engine`, recreate venv, reload. |
| Engine 401 | `MAC_API_SECRET` differs between `web/.env.local` and `~/poppy-clone/engine/.env`. |
| Engine 500 `MAC_API_SECRET is not set` | `.env` missing next to `app.py` (not `.env.local`, not the repo root). |
| Engine 502 on generate | LM Studio down or no model. `lms ps` / `curl localhost:1234/v1/models`. Auto-login required after reboot. |
| `/health` ok, Whisper ingest fails | `ffmpeg` not on the daemon `PATH`. Homebrew is `/opt/homebrew/bin`. |
| Jobs gone after reboot | Mini slept, or no automatic login (LMS). Engine daemon should still start. |
| `lms load` cannot find `qwen3-4b` | Use `qwen/qwen3-4b`. |
| Generation CPU-bound | `lms ps` shows CPU. Reload with `--gpu max`. |

Foreground test (dies when SSH closes — not the server):

```bash
cd ~/poppy-clone/engine
./venv/bin/python -u -m uvicorn app:app --host 127.0.0.1 --port 8000 --loop asyncio
```

`nohup` of that command survives SSH but **not** reboot. Prefer the LaunchDaemon.

Do not deploy Next.js to the Mini unless you want the canvas served from there.
The Mini needs Python 3.12, ffmpeg, and a model server. 3.11–3.13 work; **3.14
does not**.
