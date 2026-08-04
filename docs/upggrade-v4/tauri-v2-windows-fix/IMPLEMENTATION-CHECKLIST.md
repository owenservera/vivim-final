# Implementation Checklist

Use this checklist to verify every step of the upgrade is applied correctly.

## Pre-Implementation

- [ ] Confirm repo is at a clean git state (`git status` shows no uncommitted changes)
- [ ] Back up current state: `git stash` or create a branch `git checkout -b backup/before-tauri-fix`
- [ ] Verify Rust is installed: `rustc --version` (need 1.77.2+)
- [ ] Verify Tauri CLI is installed: `cargo tauri --version` (need v2+)
- [ ] Verify NSIS is installed: `makensis /VERSION` (need 3.10+)
- [ ] Verify Bun is installed: `bun --version`

## File Replacements (8 files)

- [ ] `src-tauri/tauri.conf.json` — replaced (verify: no `"msi"` in targets, no `updater` in plugins)
- [ ] `src-tauri/Cargo.toml` — replaced (verify: no `tauri-plugin-updater` in dependencies)
- [ ] `src-tauri/src/lib.rs` — replaced (verify: has `backend-ready` event listener, `window.show()`)
- [ ] `src-tauri/src/main.rs` — replaced (verify: unchanged from original)
- [ ] `src-tauri/capabilities/default.json` — replaced (verify: no `updater:default` in permissions)
- [ ] `frontend/next.config.mjs` — replaced (verify: `output: "export"`, no `turbopack` block)
- [ ] `scripts/tauri/prepare-frontend.ts` — replaced (verify: patches next.config, calls `bun run build`, restores config)
- [ ] `scripts/tauri/build.ps1` — replaced (verify: uses `--bundles nsis`, 3-step pipeline)

## File Deletions (3 files)

- [ ] `scripts/tauri/installer.nsi` — deleted
- [ ] `scripts/tauri/launch.bat` — deleted
- [ ] `scripts/tauri/build-installer.ps1` — deleted

## Post-Implementation

- [ ] Run `cd src-tauri && cargo generate-lockfile` to update Cargo.lock
- [ ] Run `pwsh scripts/tauri/build.ps1` — should complete without errors
- [ ] Verify NSIS installer exists: `src-tauri/target/release/bundle/nsis/vivim_0.1.0_x64-setup.exe`
- [ ] Install the NSIS installer on a clean Windows machine
- [ ] Launch from Start Menu — window should appear after 5-10s
- [ ] Verify frontend UI loads correctly in the Tauri window
- [ ] Verify backend sidecar is running (check task manager for vivim-server.exe)
- [ ] Test resizing, minimizing, and closing the window

## Known Limitations

- First launch takes 5-10 seconds (sidecar boot time)
- If sidecar crashes, window will show but backend calls will fail
- UPX compression is optional — without it the installer will be ~50MB larger
- The `prepare-frontend.ts` temporarily modifies `next.config.mjs` during build — do not run parallel builds
