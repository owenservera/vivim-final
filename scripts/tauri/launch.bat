@echo off
setlocal enabledelayedexpansion

:: Vivim Desktop Launcher
:: Starts the backend server and opens the browser

set "INSTDIR=%~dp0"
set "BACKEND_EXE=%INSTDIR%vivim-server.exe"
set "FRONTEND_DIR=%INSTDIR%frontend"
set "PORT=9420"
set "BROWSER_URL=http://localhost:%PORT%"

echo [Vivim] Starting Vivim Desktop...

:: Check if backend exists
if not exist "%BACKEND_EXE%" (
    echo [Vivim] Error: Backend executable not found at %BACKEND_EXE%
    pause
    exit /b 1
)

:: Check if frontend exists
if not exist "%FRONTEND_DIR%" (
    echo [Vivim] Error: Frontend directory not found at %FRONTEND_DIR%
    pause
    exit /b 1
)

:: Start backend server
echo [Vivim] Starting backend server on port %PORT%...
set FRONTEND_DIR=%FRONTEND_DIR%
set PORT=%PORT%
set NODE_ENV=production

start "Vivim Backend" /B "%BACKEND_EXE%" serve --port %PORT%

:: Wait for server to start
echo [Vivim] Waiting for server to start...
set /a "attempts=0"
set /a "max_attempts=30"

:wait_loop
if %attempts% geq %max_attempts% (
    echo [Vivim] Error: Server failed to start within %max_attempts% seconds
    pause
    exit /b 1
)

timeout /t 1 /nobreak >nul
set /a "attempts+=1"

curl -s "http://localhost:%PORT%/readyz" >nul 2>&1
if %errorlevel% neq 0 (
    echo [Vivim] Waiting... (%attempts%/%max_attempts%)
    goto wait_loop
)

echo [Vivim] Server started successfully!

:: Open browser
echo [Vivim] Opening browser...
start "" "%BROWSER_URL%"

echo.
echo [Vivim] Vivim Desktop is running!
echo [Vivim] Press Ctrl+C to stop the server.
echo.

:: Keep window open
pause
