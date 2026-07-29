@echo off
REM LESAVI - Local Development Startup Script
REM Run this script to start PostgreSQL, API, and Dashboard

echo [LESAVI] Starting services...

REM Start PostgreSQL if not running
"C:\pg17\pgsql\bin\pg_isready.exe" -h 127.0.0.1 -p 5432 >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [LESAVI] Starting PostgreSQL...
    "C:\pg17\pgsql\bin\pg_ctl.exe" start -D "C:\pg17\data" -l "C:\pg17\logs\postgres.log" -w
    echo [LESAVI] PostgreSQL started.
) else (
    echo [LESAVI] PostgreSQL already running.
)

REM Wait for PostgreSQL
timeout /t 3 /nobreak >nul

REM Start API server
echo [LESAVI] Starting API server on port 3001...
cd /d "%~dp0"
start "LESAVI-API" cmd /c "cd /d \"%~dp0\" ^&^& DATABASE_URL='postgresql://lesavi:lesavi123@127.0.0.1:5432/lesavi_db' SESSION_SECRET='lesavi-suramadu-secret-local-dev' PORT=3001 NODE_ENV=development node --env-file=.env artifacts/api-server/dist/index.mjs"

REM Wait for API
timeout /t 4 /nobreak >nul

REM Start Dashboard
echo [LESAVI] Starting Dashboard on http://localhost:5173/
start "LESAVI-Dashboard" cmd /c "cd /d \"%~dp0\" ^&^& PORT=5173 pnpm --filter @workspace/telkom-am-dashboard run dev"

echo.
echo [LESAVI] All services started!
echo   API:   http://localhost:3001
echo   Dashboard: http://localhost:5173
echo.
echo Press any key to close this window...
pause >nul