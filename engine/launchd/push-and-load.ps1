# From the Windows repo: copy launchd files to the Mini and load them.
# Usage: .\engine\launchd\push-and-load.ps1 [user@host]
# Default host matches the current Tailscale Mini.
param(
    [string]$Target = "rianc@100.77.134.91",
    [string]$RemoteEngine = "~/Desktop/github/poppy-clone/engine"
    # remote-load.sh copies a Desktop checkout to ~/poppy-clone (LaunchDaemons
    # cannot execute from Desktop). After the first success, you can pass
    # -RemoteEngine "~/poppy-clone/engine" to scp straight there.
)

$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "Copying $here -> ${Target}:${RemoteEngine}/launchd"
# Parent is engine/ so we refresh engine/launchd, not launchd/launchd.
scp -r -- $here "${Target}:${RemoteEngine}/"

Write-Host "Loading LaunchDaemon on the Mini (sudo password is the Mini login)..."
ssh -t $Target "cd $RemoteEngine/launchd && chmod +x remote-load.sh run-engine.sh run-lms.sh && ./remote-load.sh"
