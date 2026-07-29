@echo off
chcp 65001 >nul
title LESAVI - Dev Mode

REM Remove trailing backslash from %~dp0
set "ROOT=%~dp0"
set "ROOT=%ROOT:~0,-1%"

echo ====================================
echo  Starting LESAVI (Development)
echo ====================================
echo.

REM Build API Server
echo [1/2] Building API Server...
cd /d "%ROOT%\apps\api"
call node build.mjs
if errorlevel 1 (
    echo [ERROR] API build failed!
    pause
    exit /b 1
)

REM Start API Server
echo [2/2] Starting API Server (port 8080)...
start "LESAVI-API" cmd /k "cd /d "%ROOT%\apps\api" && set PORT=8080 && set NODE_ENV=development && node --env-file="%ROOT%\.env" --max-old-space-size=1024 dist\index.mjs"

REM Start Dashboard
start "LESAVI-Dashboard" cmd /k "cd /d "%ROOT%\apps\dashboard" && set PORT=5173 && node "%ROOT%\node_modules\vite\bin\vite.js" preview --port 5173 --host 0.0.0.0"

echo.
echo ====================================
echo   API:       http://localhost:8080
echo   Dashboard: http://localhost:5173
echo ====================================
echo.
pause
