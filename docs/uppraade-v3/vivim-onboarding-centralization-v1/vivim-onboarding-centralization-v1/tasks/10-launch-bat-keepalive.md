# Task 10 — Use `start /WAIT` in `launch.bat` for clean shutdown

**Phase**: C (Make install work)
**Depends on**: nothing (bundled with Task 04)
**Effort**: 5 min (combined with Task 04)
**Files touched**:
- `scripts/tauri/launch.bat`

## Context

`launch.bat`'s keep-alive loop uses `start /B` to spawn the sidecar detached, then polls `tasklist` every 5 seconds. Closing the cmd window kills `launch.bat` but leaves `vivim-server.exe` running as an orphan. The user has no obvious way to stop the backend short of Task Manager.

## Goal

Replace `start /B` + keep-alive loop with `start /WAIT` (or running the sidecar in the foreground). Closing the cmd window sends SIGINT to the child, killing it cleanly.

## Spec

This task is bundled with Task 04 — they touch the same file. See `tasks/04-launch-bat-frontend-dir.md` for the full `launch.bat` spec.

The key change for *this* task:

```bat
# Existing (broken):
start "Vivim Backend" /B "%BACKEND_EXE%" serve --port %PORT%"
timeout /t 3 /nobreak >nul
start "" "http://localhost:%PORT%"
:keep_alive
timeout /t 5 /nobreak >nul
tasklist /fi "IMAGENAME eq vivim-server.exe" | find /i "vivim-server" >nul
if %errorlevel% equ 0 goto keep_alive

# New:
# Run sidecar in foreground (not start /B). Closing this window kills it.
"%BACKEND_EXE%" serve --port %PORT%
```

The browser-open logic moves to a background `start /B cmd /c "timeout /t 3 && start http://localhost:%PORT%"` so it doesn't block the foreground sidecar.

## Acceptance criteria

- [ ] `launch.bat` runs `vivim-server.exe` in the foreground (no `start /B` for the sidecar itself).
- [ ] No `keep_alive` loop.
- [ ] Closing the cmd window kills `vivim-server.exe` (verify with Task Manager).
- [ ] Browser still opens to `http://localhost:9420` after ~3 seconds.

## Verification

See Task 04 verification — they're tested together.

## Notes

- The Tauri-CLI install path (Rust supervisor) already handles shutdown cleanly — it drops the child handle when the Tauri window closes. Don't touch the Rust supervisor.
- If you want graceful shutdown (let the sidecar finish in-flight requests), add a `Ctrl+C` handler in `sidecar-entry.ts` that calls `server.stop()` then `process.exit(0)`. Bun's `Bun.serve` returns a server object with `.stop()`. This is optional — out of scope for this task, but worth noting.
