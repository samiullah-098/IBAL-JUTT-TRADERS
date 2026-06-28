@echo off
setlocal EnableExtensions
cd /d "%~dp0"
echo This edits frontend/dist/config.js only. Use this if dist is already built.
set /p TUNNEL_URL=Paste Cloudflare Tunnel URL: 
if "%TUNNEL_URL%"=="" exit /b 1
if not exist "frontend/dist/config.js" (
  echo frontend/dist/config.js not found. Run SET_TUNNEL_URL_AND_BUILD_NETLIFY_DIST.bat first.
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -Command "$u='%TUNNEL_URL%'; $p='frontend/dist/config.js'; $c='// Runtime backend URL for deployed demo.'+[Environment]::NewLine+'window.__API_URL__ = "'+$u+'";'+[Environment]::NewLine; Set-Content -Path $p -Value $c -Encoding UTF8"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Compress-Archive -Path 'frontend/dist/*' -DestinationPath 'NETLIFY_UPLOAD_WITH_TUNNEL.zip' -Force"
echo Updated ZIP ready: NETLIFY_UPLOAD_WITH_TUNNEL.zip
pause
