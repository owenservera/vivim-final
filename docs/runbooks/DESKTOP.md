# Runbook — Desktop (Tauri) Build & Test

> Building the Windows desktop app, installing it, and running the verified
> desktop loop. Always use the `devops/desktop` toolkit — do not hand-run the
> raw scripts for verification.

## The toolkit (recommended)

Driven by `bun run devops desktop-loop <action>`.

| Action | What it does | Key flag |
|--------|--------------|----------|
| `run` | 5-gate pipeline: G1 Build → G2 Install → G3 Launch+Render → G4 Capture → G5 Report | `--version <x.y.z>` |
| `build` | Hash-gated rebuild (sidecar/tauri/frontend skip if unchanged) | `--version` (required) |
| `install` | Kill stale → uninstall prior → install NSIS silently (`/S`) | `--version` |
| `launch` | Start installed exe → poll `/readyz` with owner-PID verify → wait window | `--port`, `--timeout` |
| `test <battery>` | `smoke` (process→readyz→window→screenshot→probe), `boot`, `http`, `window`, `process`, `all` | battery positional |
| `status` / `kill` / `logs` / `screenshot` | State check / kill / tail `%LOCALAPPDATA%\vivim\` logs / capture | `--tail`, `--verify` |
| `report` | Generate markdown report from last cycle | `--version` |

**Quick start:** `bun run devops desktop-loop run --version 1.2.3` runs the whole
verified loop end-to-end. Artifacts land in `dist/debug/<version>/cycle-N/`.

## Raw build scripts (toolkit wraps these)

```bash
pwsh scripts/tauri/build.ps1          # sidecar + frontend static export + NSIS installer
pwsh scripts/tauri/build-sidecar.ps1  # sidecar only (bun compile + UPX level 3)
```

- **Version source of truth:** `scripts/tauri/version.ts` — reads/writes
  `tauri.conf.json` + `Cargo.toml`. Always pass `--version` to scope state.
- **Hash-gated rebuilds:** `devops/desktop/build.ts` fingerprints `src/`,
  `src-tauri/src/`, `frontend/src/` (sorted mtime+size SHA-256) at
  `dist/build-hashes.json`, version-scoped per stage. Unchanged stages skip.

## Binary size (critical)

- Bun runtime ~94MB + app ~3MB ≈ 97MB uncompressed. UPX level-3 `--no-lzma` →
  **45.6MB** (production default). WASM engines load at runtime via
  `process.dlopen()` — NOT embedded by `bun build --compile`.
- Manual: `upx -3 --no-lzma src-tauri/binaries/vivim-server-x86_64-pc-windows-msvc.exe`

## Tauri v2 config notes

- `"targets": ["nsis"]` only; no WIX/MSI; no updater artifacts.
- Window `"visible": false` — shows on `backend-ready` event.
- CSP includes `'unsafe-eval'` + `'unsafe-inline'` (static JS).

## Debugging app crashes

1. Run from CLI for stderr:
   `& "$env:LOCALAPPDATA\vivim\vivim-desktop.exe" 2>&1`
2. Logs at `%LOCALAPPDATA%\vivim\`:
   - `vivim-supervisor.log` — sidecar spawn/restart events
   - `vivim-server.log` — server boot/port/errors
3. Toolkit: `desktop-loop logs --tail 100`, `desktop-loop screenshot --verify`,
   `desktop-loop test smoke`.

## Gotchas

- PowerShell object pipeline drops JSON — read API data via a bun script, never
  `Select-Object -ExpandProperty | Out-File`.
- `Bun.spawn` `exitCode` is null until `await proc.exited`.
- Smoke tests need client-side fetch timeouts (CDP-blocking endpoints).