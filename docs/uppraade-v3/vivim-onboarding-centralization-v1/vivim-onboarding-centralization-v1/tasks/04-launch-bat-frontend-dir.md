# Task 04 — Set `FRONTEND_DIR` in `launch.bat`

**Phase**: C (Make install work)
**Depends on**: nothing
**Effort**: 5 min
**Files touched**:
- `scripts/tauri/launch.bat`

## Context

The NSIS-installed `launch.bat` starts the sidecar (`vivim-server.exe`) but **does not set `FRONTEND_DIR`**. The backend's static-file-serving code (`src/server/index.ts:430-448` and `:1890-1908`) only serves frontend files if `process.env.FRONTEND_DIR` is set. So when the browser opens `http://localhost:9420`, the backend falls through to `conversationRouter` which 404s on `/`. **The user sees nothing useful after install.**

## Goal

Add `set FRONTEND_DIR=%INSTDIR%frontend` to `launch.bat` before the `start` command.

## Spec

### Current `scripts/tauri/launch.bat`

```bat
set "INSTDIR=%~dp0"
set "BACKEND_EXE=%INSTDIR%vivim-server.exe"
set "PORT=9420"
set NODE_ENV=production
start "Vivim Backend" /B "%BACKEND_EXE%" serve --port %PORT%
timeout /t 3 /nobreak >nul
start "" "http://localhost:%PORT%"
:keep_alive
timeout /t 5 /nobreak >nul
tasklist /fi "IMAGENAME eq vivim-server.exe" | find /i "vivim-server" >nul
if %errorlevel% equ 0 goto keep_alive
```

### New `scripts/tauri/launch.bat`

Use `templates/launch.bat.template` (also includes the Task 10 fix for `start /WAIT`):

```bat
@echo off
set "INSTDIR=%~dp0"
set "BACKEND_EXE=%INSTDIR%vivim-server.exe"
set "PORT=9420"
set NODE_ENV=production
set "FRONTEND_DIR=%INSTDIR%frontend"

echo Starting Vivim Backend on port %PORT%...
echo Frontend dir: %FRONTEND_DIR%

start "Vivim Backend" /WAIT "%BACKEND_EXE%" serve --port %PORT%
```

**Changes**:
1. Add `set "FRONTEND_DIR=%INSTDIR%frontend"` — tells the backend where to find `index.html`, `_next/static/`, etc.
2. Switch `start /B` to `start /WAIT` — blocks until the sidecar exits, so closing the cmd window kills the sidecar (Task 10 fix).
3. Remove the keep-alive loop — `start /WAIT` replaces it.
4. Remove the `start "" "http://localhost:%PORT%"` line — let the sidecar itself open the browser (add a `--open-browser` flag to `sidecar-entry.ts`, OR keep the `start ""` line but place it after a `timeout /t 3`).

**Decision**: keep the browser-open in `launch.bat` for simplicity. Final shape:

```bat
@echo off
set "INSTDIR=%~dp0"
set "BACKEND_EXE=%INSTDIR%vivim-server.exe"
set "PORT=9420"
set NODE_ENV=production
set "FRONTEND_DIR=%INSTDIR%frontend"

echo Starting Vivim Backend on port %PORT%...

start "" "http://localhost:%PORT%" || ( timeout /t 3 /nobreak >nul && start "" "http://localhost:%PORT%" )

"%BACKEND_EXE%" serve --port %PORT%
```

Hmm — actually, the cleanest is: launch sidecar in foreground (so closing the window kills it), and after 3 seconds open the browser. Use a helper `start /B` for the browser-open with a delay:

```bat
@echo off
set "INSTDIR=%~dp0"
set "BACKEND_EXE=%INSTDIR%vivim-server.exe"
set "PORT=9420"
set NODE_ENV=production
set "FRONTEND_DIR=%INSTDIR%frontend"

echo Starting Vivim Backend on port %PORT%...

REM Open browser after 3-second delay (in background, non-blocking)
start /B cmd /c "timeout /t 3 /nobreak >nul && start """" http://localhost:%PORT%"

REM Run sidecar in foreground — closing this window kills the sidecar
"%BACKEND_EXE%" serve --port %PORT%
```

Use whichever variant is cleanest. The key requirements:
1. `FRONTEND_DIR` is set.
2. Sidecar runs in foreground (not `start /B`).
3. Browser opens after a short delay.

## Acceptance criteria

- [ ] `launch.bat` sets `FRONTEND_DIR=%INSTDIR%frontend`.
- [ ] `launch.bat` runs `vivim-server.exe` in the foreground (no `start /B` for the sidecar itself).
- [ ] Browser opens to `http://localhost:9420` after ~3 seconds.
- [ ] Closing the cmd window kills `vivim-server.exe` (verify with Task Manager).

## Verification

This requires a Windows machine with the NSIS-installed app. If you don't have one, verify by reading the file:

```bash
cd /home/z/my-project/vivim-final
# Verify the file matches the template (after applying)
diff scripts/tauri/launch.bat templates/launch.bat.template  # should match (or be close)
```

On Windows, end-to-end:
```powershell
# Build installer
pwsh scripts/tauri/build-installer.ps1
# Run installer (vivim-desktop-setup.exe)
# Double-click "Vivim Desktop" desktop shortcut
# Verify:
#   - cmd window opens
#   - After ~3s, browser opens to http://localhost:9420
#   - Browser shows the Vivim app (not a 404)
#   - Close the cmd window
#   - Verify vivim-server.exe is gone from Task Manager
```

## Notes

- This task is bundled with Task 10 (keep-alive fix) because they touch the same file. Do them together.
- The Tauri-CLI install path (port 9421, Rust supervisor, webview) doesn't use `launch.bat` — it's unaffected. Don't try to "fix" the Tauri path here.
- If you want to be extra-safe, also set `FRONTEND_DIR` as a default in `sidecar-entry.ts` (e.g. `process.env.FRONTEND_DIR ??= path.join(path.dirname(process.execPath), 'frontend')`). That way, even if `launch.bat` fails to set it, the sidecar still finds the frontend. But this couples the sidecar to the install layout — only do it if `launch.bat` proves unreliable.
