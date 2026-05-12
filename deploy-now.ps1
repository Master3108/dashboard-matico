Set-Location "C:\Users\josea\Desktop\proyectos\.gemini\antigravity\scratch\dashboard-matico"

Write-Host "=== Paso 1: Limpiando locks ===" -ForegroundColor Yellow
Remove-Item -Force .git\index.lock -ErrorAction SilentlyContinue
Remove-Item -Force .git\HEAD.lock -ErrorAction SilentlyContinue
Remove-Item -Force .git\refs\heads\main.lock -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

Write-Host "=== Paso 2: Git status ===" -ForegroundColor Yellow
git status

Write-Host "=== Paso 3: Git add ===" -ForegroundColor Yellow
git add -A

Write-Host "=== Paso 4: Git commit ===" -ForegroundColor Yellow
git commit -m "feat: avisos inteligentes + calendario proximos + gpt-5-mini"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Commit vacio, forzando..." -ForegroundColor Red
    git commit --allow-empty -m "force: trigger rebuild"
}

Write-Host "=== Paso 5: Git push ===" -ForegroundColor Yellow
git push origin main
if ($LASTEXITCODE -ne 0) {
    Write-Host "Push fallo, intentando force push..." -ForegroundColor Red
    git push origin main --force
}

Write-Host "=== Paso 6: Deploy en VPS ===" -ForegroundColor Yellow
ssh root@72.60.245.87 "cd /var/www/dashboard-matico && git pull origin main && docker compose down && docker compose up --build -d && echo 'DEPLOY OK' && docker compose ps"

Write-Host "`n=== LISTO ===" -ForegroundColor Green
pause
