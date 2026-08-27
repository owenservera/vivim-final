# Desktop Module

**Purpose:** Tauri V2 desktop application with sidecar architecture.

## Description
Tauri-based desktop app with Bun runtime sidecar (vivim-server.exe). Includes:
- Frontend: Next.js with static export
- Backend: Bun + Prisma + TypeScript sidecar
- Installer: NSIS with UPX compression

## Public Interface
- Desktop binary: vivim-desktop.exe
- Sidecar binary: vivim-server.exe
- Build scripts: `scripts/tauri/build.ps1`, `build-sidecar.ps1`
- DevOps toolkit: `devops/desktop/` (15-action CLI)

## Internal Gotchas
- Binary size: ~97 MB uncompressed (94 MB Bun runtime + 3 MB app code)
- UPX Level 3 compression recommended: 45.6 MB (47% ratio)
- Window shows on `backend-ready` event (starts hidden)
- Logs at `%LOCALAPPDATA%\vivim\`: vivim-server.log, vivim-supervisor.log

## Owner: VIVIM.inc
## Last Reviewed: 2026-08-15