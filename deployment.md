# Deploying the engine to a Mac Mini over SSH

The canvas (`web/`) can stay on your laptop or Vercel. The Mac Mini runs the
**engine** (FastAPI) and the **model server**. Those two have to share a machine:
the engine reaches the model at `LOCAL_LLM_BASE_URL`, which defaults to
`http://localhost:1234/v1`.

```
laptop / Vercel                         Mac Mini
┌─────────────────────┐                 ┌──────────────────────────────┐
│  Next.js  :3000     │  MAC_MINI_URL   │  FastAPI engine  :8000       │
│  /api/ingest        │ ──────────────► │  /ingest  /llm  /health      │
│  /api/llm  (SSE)    │  x-secret-key   │         │                    │
└─────────────────────┘                 │         ▼ localhost:1234     │
                                        │  LM Studio / llama-server    │
                                        └──────────────────────────────┘
```

Do not copy `engine/venv` from another OS. Recreate it on the Mini.

For a single-machine setup (everything on one box), skip this file and use the
[README](README.md#running).

---

## 1. Enable SSH on the Mini

On the Mini: **System Settings → General → Sharing → Remote Login** (on).

From the laptop:

```bash
ssh youruser@mac-mini.local
```

If `.local` does not resolve, use the Mini's LAN IP. On Windows PowerShell the
same command works if OpenSSH is installed (it is, on current Windows 10/11).

---

## 2. One-time tools on the Mini

```bash
# Homebrew, if missing
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

brew install python@3.12 ffmpeg git tmux
brew install --cask lm-studio          # or: brew install ollama / llama.cpp
```

`ffmpeg` is only required for the Whisper fallback (TikTok / Instagram / YouTube
with no captions). Native YouTube captions work without it.

Open LM Studio **once from the Mini's desktop** so `~/.lmstudio/bin/lms` exists.
Then, in SSH:

```bash
export PATH="$HOME/.lmstudio/bin:$PATH"
lms get -y --gguf qwen/qwen3-4b
lms server start --port 1234
lms load qwen3-4b --gpu max --context-length 16384
lms ps                                 # confirm Metal / GPU, not CPU
```

Apple Silicon uses Metal. That is the reason generation lives on the Mini.

`lms` is not on `PATH` until a new shell (or `lms bootstrap`). Until then call
`~/.lmstudio/bin/lms` by full path.

---

## 3. First deploy

### Preferred: clone on the Mini

```bash
cd ~
git clone <your-repo-url> poppy-clone
cd poppy-clone/engine

python3 -m venv venv
./venv/bin/pip install -r requirements.txt
cp .env.example .env
```

Edit `engine/.env`. The only required change is `MAC_API_SECRET` — it must
match `web/.env.local` on the machine that runs Next.js.

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

### Alternative: copy from the laptop

If the repo is not on a remote yet, from PowerShell:

```powershell
scp -r G:\poppy-clone youruser@mac-mini.local:~/poppy-clone
```

Then SSH in and still create a **new** `venv` on the Mini. A Windows venv will
not run.

---

## 4. Start the engine (and keep it up after disconnect)

A process started in a bare SSH session dies when you close the laptop. Use
`tmux`, or a LaunchAgent (§7).

```bash
cd ~/poppy-clone/engine
tmux new -s poppy
./venv/bin/python -m uvicorn app:app --host 127.0.0.1 --port 8000
```

Detach with `Ctrl-B` then `D`. Reattach later with `tmux attach -t poppy`.

| Bind | When |
| --- | --- |
| `--host 127.0.0.1` | Cloudflare tunnel, or anything that proxies from localhost. Safer default. |
| `--host 0.0.0.0` | Same-LAN access from the laptop with no tunnel. |

`--reload` is a laptop-dev flag. Leave it off on the Mini.

Health check on the Mini:

```bash
curl http://127.0.0.1:8000/health
```

You want `"status":"ok"` and a resolved `llm_model` (not a blank / error).
`/health` is unauthenticated; `/ingest` and `/llm` require `x-secret-key`.

---

## 5. Point the web app at the Mini

On the machine that runs Next.js, set `web/.env.local`:

### Same LAN

```env
MAC_MINI_URL=http://<mini-lan-ip>:8000
MAC_API_SECRET=<identical to engine/.env>
```

The engine must have been started with `--host 0.0.0.0` for this to work.

### Different network, or Vercel

On the Mini, in a second tmux pane (or a second session):

```bash
brew install cloudflared          # once
cloudflared tunnel --url http://localhost:8000
```

From the repo you can also run `./engine/run_tunnel.sh`. Copy the printed
`https://<something>.trycloudflare.com` URL into `MAC_MINI_URL`.

Quick-tunnel URLs change every time `cloudflared` restarts. A [named Cloudflare
tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)
is the fix if that gets tedious.

Restart `npm run dev` (or redeploy Vercel) so Next picks up the env change.
Open `/canvas` — ingest and generate now hit the Mini.

The Next proxies exist so `MAC_API_SECRET` never reaches the browser. Do not
point the canvas at the Mini's `/ingest` or `/llm` directly.

---

## 6. Day-to-day updates

From the laptop, after you push:

```powershell
ssh youruser@mac-mini.local "cd ~/poppy-clone && git pull && engine/venv/bin/pip install -r engine/requirements.txt"
```

Then restart uvicorn in the tmux session:

```powershell
ssh -t youruser@mac-mini.local "tmux send-keys -t poppy C-c './venv/bin/python -m uvicorn app:app --host 127.0.0.1 --port 8000' Enter"
```

Or SSH in, `git pull`, and restart by hand. Re-run `pip install` only when
`engine/requirements.txt` changed.

---

## 7. Optional: stay up across reboots (launchd)

A LaunchAgent survives logout and reboot. Save this as
`~/Library/LaunchAgents/com.poppy.engine.plist` on the Mini, substituting your
home directory:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.poppy.engine</string>
  <key>WorkingDirectory</key>
  <string>/Users/YOURUSER/poppy-clone/engine</string>
  <key>ProgramArguments</key>
  <array>
    <string>/Users/YOURUSER/poppy-clone/engine/venv/bin/python</string>
    <string>-m</string>
    <string>uvicorn</string>
    <string>app:app</string>
    <string>--host</string>
    <string>127.0.0.1</string>
    <string>--port</string>
    <string>8000</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/Users/YOURUSER/Library/Logs/poppy-engine.log</string>
  <key>StandardErrorPath</key>
  <string>/Users/YOURUSER/Library/Logs/poppy-engine.err</string>
</dict>
</plist>
```

```bash
launchctl load ~/Library/LaunchAgents/com.poppy.engine.plist
launchctl start com.poppy.engine
```

After a `git pull`, bounce it:

```bash
launchctl kickstart -k gui/$(id -u)/com.poppy.engine
```

LM Studio is a second process (`lms server start` + `lms load`). Leave it in
tmux, or add a second LaunchAgent that execs `~/.lmstudio/bin/lms server start`.

---

## 8. Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| `ssh: Could not resolve hostname` | Use the LAN IP; confirm Remote Login is on. |
| Engine 401 | `MAC_API_SECRET` differs between `web/.env.local` and `engine/.env`. |
| Engine 502 on generate | Model server down, or no model loaded. `lms ps` / `curl localhost:1234/v1/models`. |
| Laptop cannot reach `:8000` on LAN | Engine bound to `127.0.0.1`. Restart with `--host 0.0.0.0`. |
| `/health` ok but Whisper ingest fails | `ffmpeg` missing from `PATH` for the LaunchAgent. Use a full path or set `EnvironmentVariables` in the plist. |
| Canvas works, then dies after you close SSH | Process was not in tmux / launchd. |
| Quick tunnel 502 after a Mini reboot | `cloudflared` printed a new URL — update `MAC_MINI_URL` and restart Next. |
| Generation is slow / CPU-bound | `lms ps` shows CPU. Reload with `--gpu max`. Prefer LM Studio over Ollama on Apple Silicon if you hit a CPU fallback. |

Do not deploy Next.js to the Mini unless you also want the canvas served from
there. The Mini only needs Python 3.11+, ffmpeg, and a model server.
