# PRD — Desktop Autonomous Build & Testing Loop

**Date:** 2026-08-03
**Repo:** vivim-final (`C:\0-BlackBoxProject-0\vivim-final`)
**Status:** Draft — ready for fresh-session implementation
**Scope:** Tauri v2 desktop app + Bun sidecar + MSI release pipeline, local-first, single operator.

> Start here for a fresh session. The full design spec lives at
> `docs/superpowers/specs/2026-08-03-desktop-autonomous-loop-design.md`.
> Working implementation already exists: `devops/desktop-loop.ts`,
> `src/lib/logger.ts`, `src-tauri/src/lib.rs`. This PRD is the north star.

## 1. Problem

The shipped v0.1.0 MSI installs and launches but renders a **blank page**. Two compounding causes:

1. The embedded `vivim-server.exe` sidecar was UPX-compressed, which corrupts Bun
   self-extracting binaries — it printed Bun help text instead of starting the server.
   The WebView had no backend on `127.0.0.1:9421`. (UPX step removed; 97 MB sidecar rebuilt.)
2. The installed sidecar runs with `--windows-hide-console` and writes **zero persistent
   logging** — so after install, failures are completely undiagnosable.

There is no way today to locally exercise the full build → install → launch → render flow
and get a diagnosis when it breaks.

## 2. Goals

1. Every installed-app failure is diagnosable from files under `%LOCALAPPDATA%\vivim\`.
2. One command runs **build → install → launch → render-verify** and emits a per-gate pass/fail report.
3. Any gate failure **stops the loop**, captures a debug bundle, and points the human at the report.
   No auto-retry, no silent overwrite.
4. Fixed version per run; staged artifacts land in `dist/v<version>/` with `SHA256SUMS.txt`.

## 3. Non-Goals

- No GitHub release automation in the loop. Publishing stays manual via `gh release`.
- No auto-retry / self-healing across cycles.
- No change to the web dev loop (`devops/runtime-test/iterate.ts`).

## 4. Architecture

```
devops/desktop-loop.ts        CLI: bun run devops desktop-loop --version <v> [--resume]
Ledger: dist/loop-state.json  { version, cycle, status, history: StepRecord[] }

G1 Build    → compile-sidecar → prepare-frontend → cargo tauri build → MSI
G2 Install  → msiexec /i <msi> /qn /norestart   (/l*v install.log)
G3 Launch   → start installed vivim-desktop.exe → poll :9421/readyz → 200
   + Render → screenshot via PowerShell CopyFromScreen → assert non-blank
G4 Capture  → copy sidecar/supervisor/msiexec logs + screenshot → dist/debug/<v>/c<n>/
G5 Report   → dist/run-report.json + .md  (pass/fail per gate + diagnosis)
```

Human/agent implements fixes between cycles; re-run with `--resume`.

## 5. Components

| ID | Component | Key requirement |
|---|---|---|
| A | `src/lib/logger.ts` | pino `destination` (plain fd, no worker) when `VIVIM_LOG_FILE` set or production; default `%LOCALAPPDATA%\vivim\vivim-server.log`; try/catch fallback to console. **Type note:** pass stream as 2nd arg `pino(opts, pino.destination(file))` — pino v10 `LoggerOptions` has no `destination` field. |
| B | `src-tauri/src/lib.rs` | Append supervisor events (spawn/restart/exit/give-up) to `%LOCALAPPDATA%\vivim\vivim-supervisor.log`; pass `VIVIM_LOG_FILE` to sidecar spawn env. `cargo check` passes. |
| C | `devops/desktop-loop.ts` | G1–G5 orchestrator, ledger, staging. CLI + `--resume`. |
| D | `frontend/src/app/layout.tsx` | Render "Backend offline. Check `%LOCALAPPDATA%\vivim\vivim-server.log`" card instead of blank page when `/api/health` unreachable. **Not yet implemented.** |
| E | Versioning/staging | Fixed `--version`; stage MSI + `SHA256SUMS.txt` into `dist/v<version>/`. |

## 6. Implementation Status

- **A (logger):** DONE — written, now typechecks clean. Fix applied: two-arg `pino(opts, pino.destination(...))`.
- **B (Rust supervisor):** DONE — `cargo check` passes.
- **C (desktop-loop.ts):** DONE — written and wired into `devops/index.ts` as `case 'desktop-loop'`. Typecheck of this file not yet isolated.
- **D (frontend offline card):** TODO.
- **E (staging):** DONE inside desktop-loop.ts.

## 7. Verification / Definition of Done

- [ ] `bun run devops desktop-loop --version 0.1.1` produces a green report on a clean cycle.
- [ ] Installed app logs to `%LOCALAPPDATA%\vivim\vivim-server.log` after install.
- [ ] `vivim-supervisor.log` records spawn/restart/exit.
- [ ] Failure drill (e.g. block port 9421) yields a debug bundle + non-zero exit + report path.
- [ ] Frontend shows the backend-offline card instead of a blank page when the sidecar is down.
- [ ] `dist/v0.1.1/` contains the MSI + `SHA256SUMS.txt`.
- [ ] Re-release as v0.1.1 (bump `src-tauri/tauri.conf.json` + `Cargo.toml`), retire broken v0.1.0.

## 8. Gotchas & Constraints (from implementation)

- **pino transport is forbidden in compiled Bun** — `pino-pretty` worker cannot resolve. Use `pino.destination` (two-arg form) everywhere.
- **UPX corrupts Bun `--compile` binaries** — never re-enable UPX in `scripts/tauri/compile-sidecar.ts`.
- **Tauri WebView is not CDP-reachable** — the render assertion is a PowerShell full-screen screenshot with a non-uniform-pixel check; human/agent visually confirms the PNG.
- **Rebuilt MSI** (47,915,008 B, v0.1.0) contains the fixed 97 MB sidecar but is **not yet installed/tested/re-released**.
- **Commit blocker:** lefthook pre-commit fails on `devops runtime-test guard` ("prisma migration pending") and biome `format` ("No files were processed"). Spec + loop changes are staged but uncommitted.
- Sidecar self-heals to next free port; loop polls the reported port from stdout (Rust already extracts it).

## 9. Suggested Fresh-Session Entry Order

1. Read this PRD + `docs/superpowers/specs/2026-08-03-desktop-autonomous-loop-design.md`.
2. Finish **Component D** (frontend offline card in `frontend/src/app/layout.tsx`).
3. Isolate-typecheck `devops/desktop-loop.ts`; fix any remaining errors.
4. Run first cycle: `bun run devops desktop-loop --version 0.1.1`; verify all gates pass and the page renders.
5. Bump version to 0.1.1, re-release, and annotate/retire the broken v0.1.0.
