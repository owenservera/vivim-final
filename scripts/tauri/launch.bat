@echo off
setlocal enabledelayedexpansion

:: Vivim Desktop Launcher
:: Starts the backend server and opens the browser

set "INSTDIR=%~dp0"
set "BACKEND_EXE=%INSTDIR%vivim-server.exe"
set "PORT=9420"
set "BROWSER_URL=http://localhost:%PORT%"

echo [Vivim] Starting Vivim Desktop...

:: Check if backend exists
if not exist "%BACKEND_EXE%" (
    echo [Vivim] Error: Backend executable not found at %BACKEND_EXE%
    pause
    exit /b 1
)

:: Start backend server (detached)
echo [Vivim] Starting backend server on port %PORT%...
set NODE_ENV=production
start "Vivim Backend" /B "%BACKEND_EXE%" serve --port %PORT%

:: Open browser after brief delay
timeout /t 3 /nobreak >nul
echo [Vivim] Opening browser...
start "" "%BROWSER_URL%"

echo.
echo [Vivim] Vivim Desktop is running on %BROWSER_URL%
echo [Vivim] Close this window to stop the server.
echo.

:: Keep alive — monitor backend process
:keep_alive
timeout /t 5 /nobreak >nul
tasklist /fi "IMAGENAME eq vivim-server.exe" 2>nul | find /i "vivim-server" >nul
if %errorlevel% equ 0 goto keep_alive

echo [Vivim] Server stopped.
pause
