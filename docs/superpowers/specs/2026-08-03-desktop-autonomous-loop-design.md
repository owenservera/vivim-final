# Desktop Autonomous Loop — Design Spec

**Date:** 2026-08-03
**Status:** Approved (via brainstorming)
**Audience:** Implementation
**Scope:** Single operator, local-first. The loop is a coordinator/evaluator; the agent (or human) implements fixes between cycles. Human watches each cycle.

## Summary

Build an autonomous iteration loop for the **desktop release pipeline** (Tauri v2 + Bun sidecar + MSI). On each cycle the loop: builds the sidecar + frontend + MSI, silently installs the MSI, launches the installed app, verifies the page actually renders (not blank), and — on any failure — captures a complete debug bundle (sidecar log, supervisor log, msiexec verbose log, screenshot, readyz history) into a versioned report. On failure it **stops and reports** for human review; it never auto-retries.

This directly closes the observability hole that caused the "installed app shows a blank page" bug: the installed sidecar ran with `--windows-hide-console` and zero persistent logging, so nothing was diagnosable after install.

## Background / Root Cause (why this exists)

- The v0.1.0 MSI installed and launched but rendered a blank page.
- Cause: the embedded `vivim-server.exe` sidecar was UPX-compressed, which corrupts Bun self-extracting binaries — the runtime printed its help text instead of starting the server. The WebView had no backend at `127.0.0.1:9421`.
- UPX compression was removed from `scripts/tauri/compile-sidecar.ts`; a working 97 MB sidecar was rebuilt.
- Additional pre-existing gap: `src/lib/logger.ts` uses pino `transport` (`pino-pretty`) which spawns a worker thread that cannot resolve in a compiled Bun binary. `src/desktop/sidecar-entry.ts` relies on `NODE_ENV=production` being defined at bundle time so `PRETTY=false`, avoiding the worker. But even in production the pino logger writes only to stdout, and the sidecar is spawned with `--windows-hide-console` (`scripts/tauri/compile-sidecar.ts`), so logs vanish after install.

## Goals

1. Every installed-app failure is diagnosable from files under `%LOCALAPPDATA%\vivim\`.
2. One command runs build → install → launch → render-verify, producing a pass/fail report per gate.
3. Any gate failure stops the loop, copies debug artifacts, and points the human at the report. No auto-retry, no silent overwrite.
4. Fixed version per run; staged artifacts land in `dist/v<version>/` with checksums.

## Non-Goals

- No GitHub release automation in the loop (single operator, local-first). Release publishing stays manual via `gh release`.
- No auto-retry / self-healing across cycles.
- No change to the web dev loop (`devops/runtime-test/iterate.ts`); this is a separate desktop loop that reuses its patterns.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  devops/desktop-loop.ts  (new CLI: bun run devops desktop-loop)      │
│  Ledger: dist/loop-state.json   (version, cycle, status, history)    │
│                                                                    │
│  G1 Build    → sidecar → frontend → cargo tauri build → MSI        │
│  G2 Install  → msiexec /i <msi> /qn /norestart  (/l*v install.log) │
│  G3 Launch+Render → start installed exe → poll :9421/readyz →      │
│                      screenshot WebView → assert non-blank          │
│  G4 Capture-on-fail → copy logs + screenshot → dist/debug/<v>/c<n>/ │
│  G5 Report → dist/run-report.json + .md                             │
└─────────────────────────────────────────────────────────────────────┘
        ▲  implements/fixes between cycles (agent or human)
```

### Components

**A. Sidecar file logging — `src/lib/logger.ts`**
- Replace `transport` with pino **`destination`** when `VIVIM_LOG_FILE` is set (or in production): `destination` writes via a plain file descriptor (no worker thread), which works in compiled Bun.
- `VIVIM_LOG_FILE` env var; default `%LOCALAPPDATA%\vivim\vivim-server.log` on Windows.
- Wrap logger construction in try/catch — if the file can't open, fall back to console. Never crash the sidecar.
- Keep `transport`/pretty only when `NODE_ENV !== 'production'` and no `VIVIM_LOG_FILE`.
- Level still from `LOG_LEVEL`.

**B. Rust supervisor logging — `src-tauri/src/lib.rs`**
- Append supervisor events (spawn, port, restart attempts, exit codes) to `%LOCALAPPDATA%\vivim\vivim-supervisor.log` in addition to the current `print!`/`eprint!` forwarding.
- Pass `VIVIM_LOG_FILE` into the sidecar spawn via `.env()` alongside existing `NODE_ENV=production` (`lib.rs` `spawn_backend`, line ~35).
- Small append helper: `OpenOptions::new().create(true).append(true)`.

**C. Desktop loop — `devops/desktop-loop.ts`**
- CLI: `bun run devops desktop-loop --version <v> [--resume]`
- Ledger mirrors `devops/runtime-test/loop-state.ts`: `{ version, cycle, status, history: StepRecord[] }` persisted to `dist/loop-state.json`.
- Gates (each writes its own log into `dist/debug/<version>/cycle-<n>/`):

| Gate | Action | Log artifact |
|---|---|---|
| G1 Build | compile-sidecar → prepare-frontend → `cargo tauri build` | `build-*.log` per stage |
| G2 Install | `msiexec /i <msi> /qn /norestart` | `install.log` (msiexec `/l*v` verbose) |
| G3 Launch+Render | start installed `vivim-desktop.exe`, poll `:9421/readyz` → 200, screenshot, assert non-blank | `readyz-history.log`, screenshot, `process.txt` |
| G4 Capture-on-fail | copy `vivim-server.log` + `vivim-supervisor.log` + msiexec log + screenshot | full debug bundle |
| G5 Report | write pass/fail per gate + diagnosis | `dist/run-report.json` + `.md` |

- Failure semantics: any gate fails → stop, copy debug artifacts, exit non-zero, print report path.
- `--resume`: evaluate the previous cycle's checks (like `iterate.ts`), mark last step done/failed, propose the next cycle.
- Rendering assertion: after `readyz` is 200, capture a full-screen screenshot via PowerShell `System.Drawing.CopyFromScreen` (the app window is centered, 1280×800). Assert the screenshot's window region has non-uniform pixels (i.e. actual rendered content, not a solid blank fill). The Tauri WebView is not reachable via CDP/browser automation, so the screenshot-based assertion is the acceptance signal; the human (or agent) can also open the PNG to visually confirm.

**D. Frontend observability — root layout**
- If `/api/health` is unreachable, render a minimal error card: "Backend offline. Check `%LOCALAPPDATA%\vivim\vivim-server.log`" instead of a blank page.

**E. Versioning & staging**
- Fixed version per run (`--version 0.1.1`).
- MSI at `src-tauri/target/release/bundle/msi/vivim_<version>_x64_en-US.msi`.
- Staged into `dist/v<version>/` with `SHA256SUMS.txt`.

## Data Flow

1. Human/agent invokes `bun run devops desktop-loop --version <v>`.
2. Loop reads/initializes ledger, runs G1→G2→G3 sequentially.
3. On pass: writes report, marks cycle done, exits 0.
4. On fail: G4 captures logs/screenshot, G5 writes report with diagnosis, exits non-zero. Human reads report, tells agent what to fix.
5. Agent fixes, re-runs with `--resume`.

## Error Handling

- Any gate exception → treat as gate failure (G4 + G5), never throw uncaught.
- Log file unopenable → logger falls back to console, loop still captures whatever exists.
- Sidecar port occupied → `sidecar-entry.ts` already self-heals to the next free port; the loop polls the reported port from stdout (Rust already extracts it in `lib.rs`).
- MSI install fails → msiexec `/l*v` log is the primary diagnostic; loop surfaces the tail.

## Testing

- **Unit:** logger file-output test (writes to temp file, level filtering, no worker in production).
- **Unit:** ledger serialize/deserialize round-trip.
- **Integration (manual first run):** full `desktop-loop` run against v0.1.1; verify report shows all gates pass and the MSI embeds the fixed (non-UPX) sidecar.
- **Failure drill:** run a deliberately broken build (e.g. block port 9421) and verify G4/G5 produce a diagnosable bundle and non-zero exit.

## Verification / Definition of Done

- [ ] `bun run devops desktop-loop --version 0.1.1` produces a green report on a clean cycle.
- [ ] Installed app logs to `%LOCALAPPDATA%\vivim\vivim-server.log` (verified after install).
- [ ] `vivim-supervisor.log` records spawn/restart/exit.
- [ ] Failure drill yields a debug bundle + non-zero exit + report path.
- [ ] Frontend shows backend-offline card instead of blank page when sidecar is down.
- [ ] `dist/v0.1.1/` contains MSI + `SHA256SUMS.txt`.
