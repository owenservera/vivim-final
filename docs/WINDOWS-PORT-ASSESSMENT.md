# Windows Port Assessment — Linux Code in vivim-final

## P0 — WILL CRASH ON WINDOWS

### 1. `process.kill(pid, 'SIGKILL')` in Windows code path — FIXED ✅
**`src/executor/fleet-supervisor.ts:269`**
Inside `killExistingChromeForProfile()`, the Windows code path called `process.kill(pid, 'SIGTERM')` / `process.kill(pid, 'SIGKILL')` which Windows doesn't support. **Fix:** replaced with `taskkill /F /T /PID`.

### 2. `process.kill(pid, 'SIGTERM')` without win32 guard — FIXED ✅
**`src/engines/chrome-setup-wizard.ts:137`**
`process.kill(launchResult.pid, 'SIGTERM')` had no platform guard. **Fix:** added `process.platform === 'win32'` → `taskkill /F /T /PID`.

### 3. `Bun.spawn(['bunx', ...])` — bunx.exe not found — FIXED ✅
**`src/engines/provider-protocol-generator.ts:227`** + **`devops/baseline.ts:76,99`**, **`devops/gate.ts:67`**, **`devops/fmt.ts:15`**, **`devops/production-build.ts:256`**, **`devops/runtime-test/migrate.ts:27`**
All changed to `spawn('bun', ['x', ...])`.

### 4. `Bun.spawn(['tar', ...])` — tar is unreliable on Windows — FIXED ✅
**`src/server/plugin-router.ts:58,76`**
Wrapped `tar` spawn in a tryNativeTar() fallback pattern. On failure, throws with instructions to install Git for Windows / WSL.

## P1 — WILL SILENTLY FAIL / SKIP BEHAVIOR ON WINDOWS

### 5. `process.kill(pid, 0)` — signal 0 (exists check) not portable — NOT FIXED
**`src/executor/launcher.ts:239`**, **`src/executor/port-reaper.ts:222`**
Both calls are in the Unix-only branch (guarded by `IS_WIN` / `process.platform === 'win32'` early-return), so this is safe. Not acting on it.

### 6. Hardcoded `C:\\.config\\vivim` root path — FIXED ✅
**`src/storage/impl/slave-setup-store-impl.ts:10`** — Changed to `%APPDATA%\vivim` (Windows) / `~/.config/vivim` (Unix).
**`src/engines/chrome-governor.ts:922`** — Changed to `chrome-profiles` (consistent with ProfileAllocator.DEFAULT_PROFILE_BASE).

## P2 — SUBOPTIMAL / FRAGILE ON WINDOWS

### 7. `cmd /c netstat | findstr` for port lookup — NOT FIXED
**`src/executor/port-reaper.ts:151`**
`findstr LISTENING` is locale-dependent. Low priority — works on English Windows. The `setup-router.ts:484` version uses `netstat -ano -p TCP` which has the same issue.

### 8. `wmic` — deprecated — NOT FIXED
**`src/executor/port-reaper.ts:190`**
WMIC deprecated since Win10 21H1. Track for future migration to PowerShell `Get-CimInstance`.

### 9. `Get-Process chrome` in wide scan — NOT FIXED
**`src/executor/fleet-supervisor.ts:240`**
Works correctly. Low priority.

## P3 — COSMETIC / WILL PRODUCE WRONG OUTPUT

### 10. Shebang `#!/usr/bin/env bun` in CLI files — NOT FIXED
**`src/cli/commands/automate.ts:1`**, **`src/cli/commands/moments.ts:1`**
Harmless on Windows. No action needed.

### 11. Example path `/tmp/export.json` in help text — NOT FIXED
**`src/engines/capability-bootstrap.ts:237`**
User-facing example shows `/tmp/`. Low priority cosmetic fix.

## ALREADY HANDLED (good platform guards)

- `src/executor/launcher.ts` — `IS_WIN` guards on all kill + path logic  ✅
- `src/executor/port-reaper.ts` — `process.platform === 'win32'` guards on all three OS-specific blocks  ✅
- `src/executor/chrome-instance-profile.ts` — `where` vs `which`, path separators  ✅
- `src/executor/fleet-supervisor.ts` — `pgrep` in Unix-only branch  ✅
- `src/config.ts` — `isWin` for path defaults  ✅
- `src/desktop/sidecar-entry.ts` — platform check  ✅
- All scripts are `.ps1` (PowerShell) — no bash scripts in `scripts/`  ✅
- No `.sh`, no Dockerfiles, no Unix sockets, no `/dev/*` references  ✅

## Summary

| Severity | Total | Fixed | Remaining |
|----------|-------|-------|-----------|
| **P0** — crash | 4 | 4 | 0 |
| **P1** — silent fail | 2 | 1 | 1 (safe, guarded) |
| **P2** — fragile | 3 | 0 | 3 (low priority) |
| **P3** — cosmetic | 2 | 0 | 2 (harmless) |
