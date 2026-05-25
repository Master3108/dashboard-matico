@echo off
echo ============================================
echo   DEPLOY MATICO - Copiando archivos al VPS
echo ============================================
echo.

cd /d "C:\Users\josea\Desktop\proyectos\.gemini\antigravity\scratch\dashboard-matico"

echo [1/3] Copiando carpeta src al servidor...
scp -r src root@72.60.245.87:/var/www/dashboard-matico/
if %errorlevel% neq 0 (
    echo ERROR copiando src. Verifica tu conexion SSH.
    pause
    exit /b 1
)

echo [2/3] Copiando carpeta server al servidor...
scp -r server root@72.60.245.87:/var/www/dashboard-matico/
if %errorlevel% neq 0 (
    echo ERROR copiando server. Verifica tu conexion SSH.
    pause
    exit /b 1
)

echo [3/3] Reconstruyendo en el servidor...
ssh root@72.60.245.87 "cd /var/www/dashboard-matico && grep -q 'JWT_SECRET' server/.env 2>/dev/null || echo 'JWT_SECRET=Matico-Prod-2026-S3cur3-K3y-X9f2m' >> server/.env && docker compose down && docker compose up --build -d && sleep 10 && docker compose logs --tail 20"

echo.
echo ============================================
echo   DEPLOY COMPLETADO
echo ============================================
pause
