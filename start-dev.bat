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

REM Start API Server (serves both API + Dashboard frontend on port 8080)
echo [2/2] Starting API Server (serving API + Dashboard on port 8080)...
start "LESAVI-API" cmd /k "cd /d "%ROOT%\apps\api" && set PORT=8080 && set NODE_ENV=development && node --env-file="%ROOT%\.env" --max-old-space-size=1024 dist\index.mjs"

echo.
echo ====================================
echo   LESAVI Dashboard: http://localhost:8080
echo   (API + Frontend served together)
echo ====================================
echo.
pause
