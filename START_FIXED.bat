@echo off
setlocal
cd /d "%~dp0"
title Iqbal Jutt Trader POS & ERP - Auto Setup Starter

echo ========================================================
echo   Iqbal Jutt Trader POS ^& ERP System
echo ========================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js is not installed or not added to PATH.
  echo Install Node.js LTS first, then run this file again.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm is not available. Reinstall Node.js LTS.
  pause
  exit /b 1
)

if not exist "backend" (
  echo [ERROR] backend folder not found. Keep this file in the main project folder.
  pause
  exit /b 1
)

if not exist "frontend" (
  echo [ERROR] frontend folder not found. Keep this file in the main project folder.
  pause
  exit /b 1
)

echo [1/6] Installing backend packages if needed...
cd /d "%~dp0backend"
if not exist "node_modules" (
  call npm install
  if errorlevel 1 (
    echo [ERROR] Backend npm install failed.
    pause
    exit /b 1
  )
) else (
  echo Backend node_modules already exists. Skipping install.
)

echo.
echo [2/6] Generating Prisma client...
call npx prisma generate
if errorlevel 1 (
  echo [ERROR] Prisma generate failed. Check backend/prisma/schema.prisma and .env.
  pause
  exit /b 1
)

echo.
echo [3/6] Installing frontend packages if needed...
cd /d "%~dp0frontend"
if not exist "node_modules" (
  call npm install
  if errorlevel 1 (
    echo [ERROR] Frontend npm install failed.
    pause
    exit /b 1
  )
) else (
  echo Frontend node_modules already exists. Skipping install.
)

cd /d "%~dp0"

echo.
echo [4/6] Starting backend server on port 5000...
start "Backend Server - Iqbal Jutt" cmd /k "cd /d "%~dp0backend" && npm run dev"

echo [5/6] Starting frontend server on port 5173...
start "Frontend Server - Iqbal Jutt" cmd /k "cd /d "%~dp0frontend" && npm run dev -- --host 0.0.0.0"

echo.
echo [6/6] Waiting for Vite frontend to start...
timeout /t 10 /nobreak >nul
start http://localhost:5173

echo.
echo ========================================================
echo System is starting.
echo Keep Backend and Frontend black windows open.
echo If browser still says refused, wait 10 seconds and reload.
echo ========================================================
pause
