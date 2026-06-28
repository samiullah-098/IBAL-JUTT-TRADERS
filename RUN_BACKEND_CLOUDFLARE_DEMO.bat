@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
set "ROOT_DIR=%~dp0"
set "BACKEND_DIR=%~dp0backend"

echo ============================================================
echo  IQBAL JUTT TRADER - BACKEND + CLOUDFLARE TUNNEL DEMO
echo ============================================================
echo.
echo This will run your backend on localhost:5000 and expose it
echo with a temporary public Cloudflare Tunnel URL.
echo.

if not exist "backend" (
  echo ERROR: backend folder not found. Put this file in project root.
  pause
  exit /b 1
)

cd /d "%BACKEND_DIR%"

if not exist "node_modules" (
  echo Installing backend packages...
  call npm install
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
)

echo Generating Prisma client...
call npx prisma generate

start "IQBAL JUTT BACKEND - DO NOT CLOSE" /D "%BACKEND_DIR%" cmd /k npm run dev

echo.
echo Waiting 8 seconds for backend to start...
timeout /t 8 /nobreak >nul

echo Checking Cloudflare Tunnel command...
where cloudflared >nul 2>nul
if errorlevel 1 (
  echo.
  echo cloudflared is not installed.
  echo.
  echo Option 1: Install manually from:
  echo https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
  echo.
  echo Option 2: Try automatic install with winget.
  choice /M "Install cloudflared using winget now"
  if errorlevel 2 goto END_HELP
  winget install --id Cloudflare.cloudflared --accept-package-agreements --accept-source-agreements
)

echo.
echo ============================================================
echo COPY THE URL THAT LOOKS LIKE:
echo https://something.trycloudflare.com
echo.
echo Then run: SET_TUNNEL_URL_AND_BUILD_NETLIFY_DIST.bat
echo ============================================================
echo.
cloudflared tunnel --url http://localhost:5000

goto END

:END_HELP
echo.
echo Install cloudflared manually, then run this file again.

:END
pause
