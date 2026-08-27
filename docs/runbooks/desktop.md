# Runbook — Desktop Build

> Tauri V2 build, NSIS installer, and desktop testing.

---

## Overview

The desktop app is a **Tauri V2** shell that wraps the Bun backend + Next.js frontend into a native Windows installer.

| Component | Technology |
|-----------|------------|
| Shell | Tauri V2 (Rust) |
| Backend | Bun compiled binary |
| Frontend | Next.js static export |
| Installer | NSIS (via Tauri) |
| Compression | UPX Level 3 |

---

## Build Commands

```bash
# Full desktop build (sidecar + frontend + NSIS installer)
pwsh scripts/tauri/build.ps1

# Sidecar-only build (bun compile + UPX)
pwsh scripts/tauri/build-sidecar.ps1

# Manual UPX compression
upx -3 --no-lzma src-tauri/binaries/vivim-server-x86_64-pc-windows-msvc.exe
```

### Using the DevOps Toolkit

```bash
# Full 5-gate pipeline (Build → Install → Launch+Render → Capture → Report)
bun run devops desktop-loop run --version <x.y.z>

# Individual gates
bun run devops desktop-loop build --version <x.y.z>
bun run devops desktop-loop install --version <x.y.z>
bun run devops desktop-loop launch --version <x.y.z>
bun run devops desktop-loop test smoke
```

---

## Binary Size

| Stage | Size | Notes |
|-------|------|-------|
| Bun runtime (Windows) | ~94 MB | Irreducible via bundling |
| App code | ~3 MB | Our code on top |
| Total uncompressed | ~97 MB | |
| After UPX Level 3 | ~46 MB | Production default |

---

## Version Management

Single source of truth: `scripts/tauri/version.ts`

```bash
# Read current version
bun run scripts/tauri/version.ts

# Bump version (updates tauri.conf.json + Cargo.toml)
bun run scripts/tauri/version.ts --bump patch
```

---

## Tauri V2 Config

Key settings in `src-tauri/tauri.conf.json`:

```json
{
  "targets": ["nsis"],
  "createUpdaterArtifacts": false,
  "plugins": { "shell": { "open": true } },
  "window": { "visible": false }
}
```

- **NSIS only** — No WIX/MSI targets
- **No updater** — `tauri-plugin-updater` removed
- **Hidden window** — Shows on `backend-ready` event

---

## Debugging

### Run from Command Line

```powershell
& "$env:LOCALAPPDATA\vivim\vivim-desktop.exe" 2>&1
```

### Check Logs

```
%LOCALAPPDATA%\vivim\
  vivim-supervisor.log    # Sidecar spawn/restart
  vivim-server.log        # Server boot/port/errors
```

### Desktop Loop Diagnostics

```bash
bun run devops desktop-loop status     # Installed state
bun run devops desktop-loop logs       # Tail logs
bun run devops desktop-loop screenshot # Capture window
bun run devops desktop-loop test smoke # Full smoke test
```

---

## Test Batteries

| Battery | What It Tests |
|---------|---------------|
| `smoke` | Process → readyz → window → screenshot → probe |
| `boot` | Kill + relaunch fresh |
| `http` | `/readyz`, `/health`, `/api/openapi.json` |
| `window` | Window info + screenshot |
| `process` | Port owner PID + window info |
| `all` | Everything |

---

## Key Files

| File | Purpose |
|------|---------|
| `scripts/tauri/build.ps1` | Full desktop build |
| `scripts/tauri/build-sidecar.ps1` | Sidecar build + UPX |
| `scripts/tauri/version.ts` | Version management |
| `scripts/tauri/compile-sidecar.ts` | Bun compile + UPX |
| `scripts/tauri/prepare-frontend.ts` | Next.js static export |
| `devops/desktop/` | Desktop DevOps toolkit |
| `src-tauri/` | Tauri V2 Rust shell |

---

See [DEV.md](DEV.md) for general development setup.
