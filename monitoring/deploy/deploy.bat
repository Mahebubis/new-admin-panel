@echo off
REM ============================================================================
REM  deploy.bat - push local changes to the monitoring server
REM
REM  Double-click this file, or run it from Command Prompt:
REM      F:\project_for_automation\monitoring\deploy\deploy.bat
REM
REM  What it does, in order:
REM    1. Packages the project (excluding node_modules, .env, artifacts, state)
REM    2. Uploads it to the server
REM    3. Unpacks it over the installed copy
REM    4. Reinstalls packages if package.json changed
REM    5. Restarts the service and confirms it came back up
REM
REM  Your .env on the server is NEVER touched - it is excluded from the
REM  package, and unpacking does not remove files that are not in it.
REM ============================================================================

setlocal enabledelayedexpansion

REM ---- Settings. Change these if the server or key ever moves. ---------------
set "KEY=C:\Users\dhana\Downloads\monitoring-key.pem"
set "SERVER=ubuntu@13.207.16.208"
set "PROJECT=F:\project_for_automation"
set "APPDIR=/opt/istudio-monitoring"
REM ---------------------------------------------------------------------------

echo.
echo ============================================================
echo   Deploying monitoring to %SERVER%
echo ============================================================
echo.

if not exist "%KEY%" (
    echo [ERROR] SSH key not found: %KEY%
    echo         Edit this file and correct the KEY line.
    goto :fail
)

if not exist "%PROJECT%\monitoring\package.json" (
    echo [ERROR] Project not found: %PROJECT%\monitoring
    echo         Edit this file and correct the PROJECT line.
    goto :fail
)

cd /d "%PROJECT%"

echo [1/5] Packaging...
tar --exclude=node_modules --exclude=.env --exclude=artifacts --exclude=state -czf monitoring.tar.gz monitoring
if errorlevel 1 goto :fail
for %%A in (monitoring.tar.gz) do echo       %%~zA bytes

echo [2/5] Uploading...
scp -i "%KEY%" monitoring.tar.gz %SERVER%:/tmp/
if errorlevel 1 goto :fail

echo [3/5] Unpacking on the server...
ssh -i "%KEY%" %SERVER% "sudo tar -xzf /tmp/monitoring.tar.gz -C %APPDIR% --strip-components=1 && sudo chown -R monitor:monitor %APPDIR%"
if errorlevel 1 goto :fail

echo [4/5] Installing packages...
ssh -i "%KEY%" %SERVER% "sudo -u monitor bash -lc 'cd %APPDIR% && npm ci --omit=dev --silent'"
if errorlevel 1 goto :fail

echo [5/5] Restarting the service...
REM `is-active` is the real check: systemctl restart returns 0 even for a
REM service that starts and immediately crashes on a bad config.
ssh -i "%KEY%" %SERVER% "sudo systemctl restart istudio-monitoring && sleep 4 && sudo systemctl is-active istudio-monitoring"
if errorlevel 1 (
    echo.
    echo [ERROR] The service did not come back up. Recent log:
    ssh -i "%KEY%" %SERVER% "sudo journalctl -u istudio-monitoring -n 30 --no-pager"
    goto :fail
)

del /q monitoring.tar.gz 2>nul

echo.
echo ============================================================
echo   DEPLOYED. Service is running.
echo.
echo   Status page : http://13.207.16.208:8080
echo   Live log    : ssh -i "%KEY%" %SERVER% "sudo journalctl -u istudio-monitoring -f"
echo ============================================================
echo.
pause
exit /b 0

:fail
echo.
echo ============================================================
echo   DEPLOY FAILED - see the error above.
echo   Nothing was restarted; the server is still running the
echo   previous version.
echo ============================================================
echo.
pause
exit /b 1
