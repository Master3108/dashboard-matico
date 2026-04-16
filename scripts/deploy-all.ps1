Param(
    [string]$Branch = "main",
    [string]$CommitMessage = "chore: update before VPS deploy",
    [string]$VpsHost = "root@72.60.245.87",
    [string]$VpsPath = "/var/www/dashboard-matico"
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir

Write-Host "==> STEP 1/2: Local update (commit + push)" -ForegroundColor Cyan
Set-Location $repoRoot
& "$scriptDir\deploy-local.ps1" -Branch $Branch -CommitMessage $CommitMessage

Write-Host "==> STEP 2/2: Hostinger VPS Docker update" -ForegroundColor Cyan
$remoteCommand = @"
set -euo pipefail
cd "$VpsPath"
git pull origin "$Branch"
docker compose down
docker compose up --build -d
docker compose ps
docker compose logs --tail=100
"@

ssh $VpsHost "bash -lc '$remoteCommand'"

Write-Host "==> Deploy ALL completed." -ForegroundColor Green
