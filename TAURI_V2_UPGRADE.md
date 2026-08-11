# Tauri V2 Upgrade — Changelog

## 2026-08-10: Full Tauri V2 Scaffolding Added

### What was done

1. **`src-tauri/` — Complete Rust shell**
   - `Cargo.toml` with Tauri 2, plugins (shell, dialog, fs, http, process, window-state)
   - `tauri.conf.json` with dual-mode build (dev server / static export), NSIS + DMG + DEB + AppImage targets
   - `src/lib.rs` — plugin init, `backend-ready` event handler, window show-on-ready
   - `src/main.rs` — Windows console suppression in release
   - `capabilities/default.json` — permission model
   - `icons/` — placeholder PNG icons (replace with branded assets)

2. **Frontend Tauri bridge**
   - `src/lib/tauri-bridge.ts` — `isTauri()`, `tauriInvoke()`, `apiCall()` (auto-switches IPC vs fetch)
   - `src/lib/tauri-boot.ts` — boot sequence that signals `backend-ready` to show window (no white flash)

3. **Build system**
   - `next.config.mjs` already had dual-mode (standalone / export) — verified correct
   - `frontend/package.json` — added `build:tauri` and `tauri` scripts, `@tauri-apps/api` + plugin deps
   - Root `package.json` — added `tauri:dev`, `tauri:build`, `frontend:build:tauri` scripts
   - `.taurignore` — excludes node_modules, .next, docs, tests from bundle
   - `.gitignore` — un-ignored `src-tauri/` and `scripts/tauri/` (was previously gitignored)

4. **Production cleanup**
   - Removed `docs/dev-code-impl/` (600+ files of stale dev snapshots)
   - Removed `frontend/tool-results/` and `frontend/playwright-report/`
   - Added gitignore rules for regenerable dev artifacts

### Wiring issues fixed

| Issue | Fix |
|-------|-----|
| `src-tauri/` entirely missing | Created full Tauri V2 scaffolding |
| `src-tauri/` was in `.gitignore` | Removed from gitignore, only `target/` and `gen/` ignored |
| No Tauri API adapter in frontend | Created `tauri-bridge.ts` + `tauri-boot.ts` |
| No `build:tauri` script | Added to both root and frontend `package.json` |
| `@tauri-apps/*` not in deps | Added `@tauri-apps/api` + 4 plugins to frontend deps |
| No `.taurignore` | Created with appropriate exclusions |
| `scripts/tauri/` missing | Created `prepare-frontend.ts` |

### How to build

```bash
# Prerequisites: Rust toolchain, Bun >= 1.3.14

# Development (hot reload)
bun run tauri:dev

# Production installers
bun run tauri:build
```

### Architecture

```
vivim-final/
├── src/                    # Backend (Bun server, engines, AI)
├── frontend/               # Next.js 16 frontend
│   ├── src/lib/tauri-bridge.ts   # IPC / fetch dual-mode
│   └── src/lib/tauri-boot.ts     # Boot signal
├── src-tauri/               # Tauri V2 Rust shell (NEW)
│   ├── src/lib.rs           # Plugins, window management
│   ├── tauri.conf.json      # Build & bundle config
│   └── capabilities/        # Permission model
├── scripts/tauri/           # Tauri build helpers (NEW)
└── .taurignore              # Bundle exclusions (NEW)
```

### Remaining TODOs (for full production)

- [ ] Replace placeholder icons with branded assets
- [ ] Add sidecar config for the Bun backend server
- [ ] Implement Tauri-specific API route handlers (replace HTTP API routes with IPC commands)
- [ ] Add auto-updater plugin configuration
- [ ] Sign binaries (Windows code signing, macOS notarization)
