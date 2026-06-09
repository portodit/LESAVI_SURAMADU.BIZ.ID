@echo off
REM LESAVI - Stop all local services

echo [LESAVI] Stopping services...

REM Kill node processes for lesavi
taskkill /F /FI "WINDOWTITLE eq LESAVI-API*" >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq LESAVI-Dashboard*" >nul 2>&1

REM Kill all node processes running the API server
for /f "tokens=2" %%a in ('tasklist /FI "IMAGENAME eq node.exe*" /FO LIST 2^>nul ^| findstr /I "PID"') do (
    wmic process where ProcessId=%%a get Commandline 2>nul | findstr -i "lesavi" >nul
    if !ERRORLEVEL! equ 0 (
        echo Stopping node PID %%a
        taskkill /F /PID %%a >nul 2>&1
    )
)

REM Stop PostgreSQL
REM Uncomment next line if you want to also stop PostgreSQL:
REM "C:\pg17\pgsql\bin\pg_ctl.exe" stop -D "C:\pg17\data" -m fast

echo [LESAVI] Services stopped!
pause