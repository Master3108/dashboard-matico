#!/usr/bin/env pwsh
# Deploy script - run from PowerShell
Set-Location "C:\Users\josea\Desktop\proyectos\.gemini\antigravity\scratch\dashboard-matico"

Write-Host "=== Limpiando git lock ===" -ForegroundColor Yellow
Remove-Item -Force .git\index.lock -ErrorAction SilentlyContinue

Write-Host "=== Git add + commit ===" -ForegroundColor Yellow
git add -A
git commit -m "feat: avisos inteligentes + calendario proximos + gpt-5-mini agente" --allow-empty

Write-Host "=== Git push ===" -ForegroundColor Yellow
git push origin main

Write-Host "=== Deploy en VPS ===" -ForegroundColor Yellow
ssh root@72.60.245.87 "cd /var/www/dashboard-matico && git pull origin main && docker compose down && docker compose up --build -d && docker compose ps"

Write-Host "=== Deploy completo ===" -ForegroundColor Green
Read-Host "Presiona Enter para cerrar"
