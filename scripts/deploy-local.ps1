Param(
    [string]$Branch = "main",
    [string]$CommitMessage = "chore: update before VPS deploy"
)

$ErrorActionPreference = "Stop"

Write-Host "==> Deploy local: commit + push ($Branch)" -ForegroundColor Cyan

git add .
git commit -m $CommitMessage
if ($LASTEXITCODE -ne 0) {
    Write-Host "No hay cambios nuevos para commit."
}
git push origin $Branch

Write-Host "==> Deploy local completado." -ForegroundColor Green
