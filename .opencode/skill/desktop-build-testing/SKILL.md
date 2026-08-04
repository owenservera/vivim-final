# Desktop Build Testing (Tauri V2 + NSIS)

## When to Use

- Building, installing, or testing the Tauri V2 desktop app on Windows
- Running the full build → install → launch → render → report gate pipeline
- Debugging desktop app crashes, blank windows, or sidecar startup failures
- Verifying the embedded Next.js frontend renders correctly inside the Tauri WebView2
- Investigating whether `vivim-server.exe` (Bun sidecar) starts and listens on port 9421
- Running from a clean state (no prior build) through full local install + app launch

## Quick Reference

```bash
# 1. Check current desktop version (from src-tauri/tauri.conf.json)
bun run devops desktop-loop status

# 2. Full gate pipeline: build → install → launch → verify → report
bun run devops desktop-loop run --version 1.3.16

# 3. Build only (hash-gated; skips if unchanged)
bun run devops desktop-loop build --version 1.3.16

# 4. Install only (kill stale → uninstall → NSIS silent install)
bun run devops desktop-loop install --version 1.3.16

# 5. Launch the installed app
bun run devops desktop-loop launch --port 9421 --timeout 60000

# 6. Diagnostics
bun run devops desktop-loop logs           # tail vivim-server.log + vivim-supervisor.log
bun run devops desktop-loop screenshot     # capture full-screen, verify non-blank
bun run devops desktop-loop window         # window title/handle/responding
bun run devops desktop-loop process        # port owner + process info
bun run devops desktop-loop probe /readyz  # HTTP probe any path

# 7. Test batteries
bun run devops desktop-loop test smoke     # process + readyz + window + screenshot + probes
bun run devops desktop-loop test boot      # kill → launch → poll /readyz
bun run devops desktop-loop test http      # probe /readyz + /health + /api/openapi.json

# 8. Cleanup
bun run devops desktop-loop kill           # kill all vivim processes
bun run devops desktop-loop reset          # clear ledger + runtime state
```

## Architecture

### Tooling Layout

```
devops/desktop/
  index.ts    → CLI entry + gate orchestrator (G1-G5)
  cli.ts      → arg parsing, action dispatch, per-invocation log tee
  actions.ts  → 15 action handlers (status, build, install, ..., reset)
  spawn.ts    → streaming output capture, process management, NSIS install/uninstall
  verify.ts   → port owner (via PowerShell), readyz polling, screenshot, window info
  build.ts    → hash-gated rebuilds (version-scoped fingerprint cache)
  state.ts    → ledger (dist/loop-state.json) + runtime (dist/desktop-runtime.json)

scripts/tauri/
  build.ps1            → canonical 3-step build pipeline (PowerShell)
    ├── build-sidecar.ps1 → calls compile-sidecar.ts + UPX
    ├── prepare-frontend.ts → bun run build (static export)
    └── cargo tauri build --bundles nsis
  compile-sidecar.ts   → bundle → bun --compile → UPX compress (level 3, --no-lzma)
  prepare-frontend.ts  → runs `bun run build` in frontend/ (output:"export" already set)
  version.ts           → single source of truth (reads tauri.conf.json)
```

### Version Flow

- **Canonical:** `src-tauri/tauri.conf.json` → `"version": "1.3.14"`
- **Synced to:** `src-tauri/Cargo.toml` → `[package] version = "1.3.14"` via `ensureDesktopVersion()`
- **NSIS installer path:** `src-tauri/target/release/bundle/nsis/vivim_<version>_x64-setup.exe`
- **Installed exe path:** `%LOCALAPPDATA%\vivim\vivim-desktop.exe`
- **Sidecar binary path:** `src-tauri/binaries/vivim-server-<triple>.exe`

### Port Flow

- `src-tauri/src/lib.rs` spawns the sidecar with `--port 9421`
- The sidecar may shift to 9422+ if 9421 is occupied (`findAvailablePort` in `sidecar-entry.ts`)
- `lib.rs` listens for the `listening on http://127.0.0.1:<PORT>` stdout line
- On detection: emits `backend-ready` event with the actual port
- `frontend/src/lib/ws-url.ts` listens for `backend-ready` and updates `activePort` dynamically
- `devops/desktop/state.ts` `DEFAULT_PORT = 9421` — the initial bootstrap port

## Build Pipeline (Canonical)

```
pwsh scripts/tauri/build.ps1
```

This 3-step pipeline:

1. **`pwsh scripts/tauri/build-sidecar.ps1`** → `bun run scripts/tauri/compile-sidecar.ts`
   - Bundles `src/desktop/sidecar-entry.ts` via `Bun.build`
   - Compiles to standalone exe: `bun build --compile --windows-hide-console --outfile ...`
   - **UPX compress** (level 3, `--no-lzma`) → ~45 MB from ~97 MB
   - Copies DB + seeds into `src-tauri/data/`

2. **`prepare-frontend.ts`** → `bun run build` in `frontend/`
   - `frontend/next.config.mjs` already has `output: "export"` (no patching needed)
   - Produces static site at `frontend/out/`
   - Tauri loads via `tauri://localhost` protocol → `frontend/out/index.html`

3. **`cargo tauri build --bundles nsis`** (from `src-tauri/` dir)
   - Bundles the sidecar binary as `binaries/vivim-server` (via `externalBin` in tauri.conf.json)
   - Wraps frontend `out/` as Tauri assets
   - Produces NSIS installer: `src-tauri/target/release/bundle/nsis/vivim_<ver>_x64-setup.exe`

### Prerequisites (one-time)

```powershell
winget install NSIS.NSIS
winget install UPX.UPX
rustup target add x86_64-pc-windows-msvc
cargo install tauri-cli --version "^2"
```

## Gate Pipeline (`desktop-loop run`)

```
G1 Build → G2 Install → G3 Launch+Render → G4 Capture (fail only) → G5 Report
```

| Gate | What | Artifacts |
|------|------|-----------|
| G1 Build | Hash-gated check of sidecar + tauri-rust + tauri-frontend sources. If any changed → `pwsh scripts/tauri/build.ps1`. If unchanged + installer exists → skip | `dist/debug/<ver>/cycle-N/build-tauri.log`, NSIS installer |
| G2 Install | Kill stale → uninstall via NSIS QuietUninstallString → install new NSIS silently (`/S`) | install log |
| G3 Launch+Render | Launch `vivim-desktop.exe` → poll `/readyz` on port 9421 (with owner PID verification) → screenshot → assert non-blank | `screenshot.png` |
| G4 Capture | On failure only: copy `vivim-server.log` + `vivim-supervisor.log` from `%LOCALAPPDATA%\vivim\` | server.log, supervisor.log |
| G5 Report | Write `report.json` + `report.md` to cycle dir | report.md, report.json |

Artifacts: `dist/debug/<version>/cycle-N/`

### G1 Build Hash-Gating

`devops/desktop/build.ts` fingerprints three source tiers per version:
- **`sidecar`**: `src/` + `scripts/tauri/compile-sidecar.ts` + `src-tauri/Cargo.toml` (fingerprint `src/*.{ts,tsx,js,jsx}`)
- **`tauri-rust`**: `src-tauri/src/` + `src-tauri/Cargo.toml` (fingerprint `*.rs, *.toml`)
- **`tauri-frontend`**: `frontend/src/` (fingerprint `*.ts, *.tsx, *.js, *.jsx`)

Any change → full `build.ps1` (not partial). All three must be unchanged AND installer exists to skip.

## From Zero to Installed + Running

### Step 1: Verify prerequisites

```powershell
rustc --version       # need 1.77.2+
cargo tauri --version # need v2+
makensis /VERSION     # need NSIS 3.10+
upx --version         # need UPX 5.2+
bun --version         # need Bun 1.x
```

### Step 2: Build

```powershell
pwsh scripts/tauri/build.ps1
```

Output: `src-tauri/target/release/bundle/nsis/vivim_1.3.14_x64-setup.exe`

### Step 3: Install

```powershell
# Silent install (the desktop-loop install action does this)
& "src-tauri/target/release/bundle/nsis/vivim_1.3.14_x64-setup.exe" /S
```

Installer registers in Windows registry at:
`HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\vivim` (per-machine NSIS)

Installed files go to: `%LOCALAPPDATA%\vivim\`
- `vivim-desktop.exe` — Tauri shell
- `vivim-server.exe` — Bun sidecar (symlink or copy from binaries/)

### Step 4: Launch

Double-click the Start Menu shortcut or run:
```powershell
& "$env:LOCALAPPDATA\vivim\vivim-desktop.exe"
```

**Window behavior:** The Tauri window starts **hidden** (`visible: false` in tauri.conf.json). The Rust sidecar spawns `vivim-server.exe` with `--port 9421`. Once the sidecar logs `listening on http://127.0.0.1:9421`, `lib.rs` emits `backend-ready` → `window.show()` + `set_focus()`. If 30s timeout elapses, window shows anyway (with connection errors in UI).

### Step 5: Verify

```powershell
# Quick checks
bun run devops desktop-loop status
bun run devops desktop-loop readyz --port 9421
bun run devops desktop-loop test smoke
```

## Debugging App Crashes

### Symptom: App launches then dies instantly, no window

1. **Run from command line to capture stderr:**
   ```powershell
   & "$env:LOCALAPPDATA\vivim\vivim-desktop.exe" 2>&1
   ```

2. **Check logs:**
   ```powershell
   bun run devops desktop-loop logs --tail 100
   type "$env:LOCALAPPDATA\vivim\vivim-supervisor.log"
   type "$env:LOCALAPPDATA\vivim\vivim-server.log"
   ```

3. **Common causes:**
   - **Missing sidecar binary:** `binaries/vivim-server` not found in install dir → Tauri can't spawn it
   - **Database path:** `sidecar-entry.ts` forces `DATABASE_URL` to absolute path in `%LOCALAPPDATA%\vivim\`
   - **WebView2 runtime:** Must be installed on the target machine

### Symptom: Window shows but frontend is blank

1. Check if sidecar started: `bun run devops desktop-loop logs`
2. Look for `listening on http://127.0.0.1:9421` in the server log
3. If sidecar didn't start: check `%LOCALAPPDATA%\vivim\vivim-server.log`
4. If sidecar started but frontend is blank: the `frontend/out/` static export may be incomplete — rebuild with `pwsh scripts/tauri/build.ps1`

### Symptom: Screenshot shows blank/black

```bash
bun run devops desktop-loop screenshot --out dist/screenshot.png --verify
```
- If `nonBlank: false` → WebView2 didn't render. Check that `frontend/out/` exists and has HTML files.
- ImageMagick `identify` checks color count (≥2 colors means rendered).

### Symptom: Port 9421 in use / readyz fails

1. Check what's using the port: `bun run devops desktop-loop process`
2. The sidecar `findAvailablePort` will try 9421, then 9422, 9423, etc.
3. The actual port is emitted via `backend-ready` event → `ws-url.ts` updates dynamically.
4. If the desktop-loop polls 9421 but sidecar is on 9422: the `readyz` action uses `DEFAULT_PORT` unless `--port` is specified or runtime state has `actualPort`.

### Windows Defender / Antivirus

NSIS installers and compiled Bun binaries are frequently flagged. If the installer fails silently:
1. Check Windows Security → Protection history
2. Add the build directory to exclusions as a workaround
3. Sign the binary for production distribution (not needed for local testing)

## Test Batteries

| Battery | Checks | Purpose |
|---------|--------|---------|
| `smoke` | process + readyz + window + screenshot + probe:readyz + probe:health | Full integration after launch |
| `all` | same as smoke | Alias |
| `boot` | kill → launch → poll /readyz | Verify fresh boot |
| `http` | probe /readyz + /health + /api/openapi.json | Backend HTTP surface only |
| `window` | window title + screenshot | Frontend render only |
| `process` | desktop + server process info | Process lifecycle only |

### Smoke test timeouts

Per AGENTS.md: "Smoke tests must have client-side timeouts." The `probe`/`readyz` actions use `AbortSignal.timeout(5_000)` or `AbortSignal.timeout(10_000)`. The `/send` endpoint blocks forever waiting for a CDP browser — never call it without a timeout wrapper.

## Key Files Reference

| File | Purpose |
|------|---------|
| `src-tauri/tauri.conf.json` | Tauri config: nsis-only, visible:false, no updater, CSP with unsafe-eval |
| `src-tauri/src/lib.rs` | Sidecar supervisor: spawns vivim-server.exe, listens for "backend-ready", shows window |
| `src-tauri/src/main.rs` | Entry point (4 lines, calls lib::run) |
| `src-tauri/Cargo.toml` | Tauri v2 deps (no tauri-plugin-updater) |
| `src-tauri/capabilities/default.json` | Permissions: core:default + shell:allow-open + shell:allow-execute (sidecar) |
| `scripts/tauri/build.ps1` | Canonical 3-step build pipeline |
| `scripts/tauri/build-sidecar.ps1` | Sidecar wrapper (calls compile-sidecar.ts) |
| `scripts/tauri/compile-sidecar.ts` | Bundle → compile → UPX compress |
| `scripts/tauri/prepare-frontend.ts` | `bun run build` (static export) |
| `scripts/tauri/version.ts` | Version source of truth (reads tauri.conf.json) |
| `scripts/_shared.ps1` | Resolve-Bun helper |
| `frontend/next.config.mjs` | `output: "export"`, images.unoptimized, ignoreBuildErrors |
| `frontend/src/lib/ws-url.ts` | Dynamic port listener for `backend-ready` event |
| `src/desktop/sidecar-entry.ts` | Sidecar entry: forces DATABASE_URL to app-data, starts server |
| `devops/desktop/index.ts` | Gate orchestrator (G1-G5) + CLI dispatch |
| `devops/desktop/actions.ts` | 15 action handlers |
| `devops/desktop/spawn.ts` | Process spawning + NSIS install/uninstall |
| `devops/desktop/verify.ts` | Port owner, readyz, screenshot, window info |
| `devops/desktop/build.ts` | Hash-gated rebuild logic (version-scoped) |
| `devops/desktop/state.ts` | Ledger + runtime state persistence |

## Related Skills

- **production-build** — full release pipeline (precheck → gate → cleanup → converge → build → docs → verify → report)
- **vivim-build** — backend engine implementation
- **vivim-testing** — test patterns and workflows
- **diagnose** — structured debugging workflow
