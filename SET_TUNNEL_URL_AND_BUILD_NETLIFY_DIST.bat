@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo ============================================================
echo  SET CLOUDFLARE TUNNEL URL + BUILD NETLIFY DIST
echo ============================================================
echo.
set /p TUNNEL_URL=Paste your Cloudflare Tunnel URL here: 

if "%TUNNEL_URL%"=="" (
  echo ERROR: URL is empty.
  pause
  exit /b 1
)

echo Updating frontend public config.js...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$u='%TUNNEL_URL%'; $p='frontend/public/config.js'; $c='// Runtime backend URL for deployed demo.'+[Environment]::NewLine+'window.__API_URL__ = "'+$u+'";'+[Environment]::NewLine; Set-Content -Path $p -Value $c -Encoding UTF8"

cd /d "%~dp0frontend"
if not exist "node_modules" (
  echo Installing frontend packages...
  call npm install
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
)

echo Building frontend dist...
call npm run build
if errorlevel 1 (
  echo Build failed.
  pause
  exit /b 1
)

cd /d "%~dp0"
if exist "NETLIFY_UPLOAD_WITH_TUNNEL.zip" del "NETLIFY_UPLOAD_WITH_TUNNEL.zip"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Compress-Archive -Path 'frontend/dist/*' -DestinationPath 'NETLIFY_UPLOAD_WITH_TUNNEL.zip' -Force"

echo.
echo ============================================================
echo DONE.
echo Upload this file to Netlify:
echo NETLIFY_UPLOAD_WITH_TUNNEL.zip
echo.
echo Important: Keep backend window and cloudflared window open.
echo ============================================================
pause
