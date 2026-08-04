# PRD — Agentic Desktop Test Loop Toolkit

**Date:** 2026-08-04
**Repo:** vivim-final (`C:\0-BlackBoxProject-0\vivim-final`)
**Status:** Approved — ready for implementation
**Scope:** Upgrade `devops/desktop-loop.ts` into an agent-driven desktop test toolkit for exercising the actually-installed exe.

> Follows `PRD-2026-08-03-desktop-autonomous-loop.md` (the original G1–G5 loop). This PRD
> reworks the loop into a granular, composable, machine-readable toolkit the agent runs
> repeatedly while testing the installed desktop app.

## Problem Statement

`devops/desktop-loop.ts` is a monolithic, all-or-nothing gate loop. It is hard to drive
agentically: the agent cannot run individual stages (build / install / launch / probe),
each stage emits only human console text, and several defects make verification of the
actually-installed exe unreliable:

- Only `vivim-desktop.exe` is killed before install/launch, so a stale `vivim-server.exe`
  can keep `:9421` and answer `/readyz` 200 for an app that never rendered. The sidecar
  self-heals to the next free port, so the new exe may be serving on `9422` while the loop
  checks `9421`.
- `spawnStreaming` splits output per data chunk, corrupting lines and multi-byte UTF-8.
- msiexec relaunches itself; `spawnSync` can return before install finishes -> false pass/fail.
- Screenshot is full-screen with no window focus/verification -> desktop wallpaper
  false-passes the "non-blank" check.
- No way to probe the installed app's real HTTP endpoints, dump its logs, or get parseable
  JSON + exit codes for agent decision-making.
- Shared `dist/loop-state.json` + `dist/build-hashes.json` clobber across runs/versions; a
  failed cycle still exits 0.

## Solution

Turn `devops/desktop-loop.ts` into an **agentic desktop test toolkit**: granular, composable
subcommands (`status` / `build` / `install` / `launch` / `readyz` / `probe` / `screenshot` /
`window` / `process` / `logs` / `test` / `run` / `report` / `reset`), each returning structured
JSON and a correct exit code, so the agent can drive the real build -> install -> launch ->
verify loop step by step against the installed exe — plus keep the full `run` loop for one-shot
green cycles.

## User Stories

1. As an agent, I want a `status` action returning configured version, MSI presence, installed-exe file version, product code, running processes, and port owner, so I can decide the next action.
2. As an agent, I want `build --version <v>` to compile sidecar + tauri -> MSI with hash-gating, so unchanged sources skip work.
3. As an agent, I want `install --version <v>` to kill stale processes, uninstall prior product, and msiexec-install with reliable completion detection, so I trust install success/failure.
4. As an agent, I want `launch` to kill stale desktop+server processes, start the exe, wait for `/readyz`, and verify the port owner is the PID I launched, so a stale sidecar can't fake readiness.
5. As an agent, I want `launch` to detect when the sidecar self-healed to a different port and report the actual port, so I always test the right process.
6. As an agent, I want `readyz` to return poll history, latency, owner PID, and stale-detection flags, so I can diagnose boot failures.
7. As an agent, I want `probe <path>` to hit arbitrary HTTP endpoints of the installed app with expected-status/contains assertions, so I test real behavior beyond readyz.
8. As an agent, I want `screenshot` to focus the app window, capture, and assert non-blank with color count, so a wallpaper/blank screen can't false-pass.
9. As an agent, I want `window` to report title/handle/responding, so I confirm the WebView actually painted.
10. As an agent, I want `process` to list vivim processes with PID/start-time/memory plus port owner, so I can see leaks or crashes.
11. As an agent, I want `logs` to tail `%LOCALAPPDATA%\vivim` logs, so failures are diagnosable from the installed app.
12. As an agent, I want `test <battery>` (`boot`/`http`/`window`/`process`/`smoke`) returning per-check pass/fail, so one command verifies the installed exe.
13. As an agent, I want `run` (full G1–G5 loop) to compose the same primitives, so green runs and manual diagnosis use identical logic.
14. As an agent, I want `report`/`reset` and a persisted runtime state file, so context survives across invocations.
15. As an agent, I want every action to emit clean JSON (`--json`), honor `--out=<path>`, and exit non-zero on failure, so I can parse and gate on results.
16. As a human, I want each run/action logged to its own file, so there is a self-contained record per invocation.

## Implementation Decisions

- **Structure:** extract a `devops/desktop/` module from the current monolithic file:
  - `spawn.ts` — `spawnStreaming` (StringDecoder + residual-line buffer fixes chunk/multibyte
    corruption), msiexec via PowerShell `Start-Process -Wait -PassThru`, taskkill/kill helpers.
  - `verify.ts` — readyz polling, netstat->owner-PID parsing, self-heal port scan (9421..9441),
    window focus/info, screenshot + non-blank assertion. **This is the deep module** (simple
    interface, tested in isolation).
  - `build.ts` — hash-gated sidecar/tauri rebuilds with **version-scoped keys**.
  - `state.ts` — `dist/loop-state.json` ledger + new `dist/desktop-runtime.json`
    (`{version, port, lastPid, readyAt, ownerPid}`).
  - `cli.ts` — arg parsing, action registry, JSON/human output, per-invocation log tee.
  - `actions/*.ts` — thin action implementations composing the primitives.
  - `devops/desktop-loop.ts` stays as the thin entry, re-exporting `runDesktopLoop` /
    `printLoopResult` for backward compat; `devops/index.ts` case `desktop-loop` delegates to
    the new CLI.
- **Stale-readiness fix:** `launch` records the spawned PID, then after readyz 200 resolves the
  port owner; if owner != launched PID it scans ports for the launched PID and reports
  `actualPort` (matches AGENTS.md gotcha "sidecar self-heals to next free port").
- **msiexec reliability:** install/uninstall run through PowerShell `Start-Process -Wait`, then
  confirm via install-log status line (`success or error status: 0`) and exe existence.
- **Exit codes:** action result determines `process.exitCode` (0/1); `run` keeps existing
  stop-on-failure semantics.
- **Output contract:** every action returns `{action, ok, detail, data, artifacts}`; `--json`
  emits only that object.

## Testing Decisions

- Good tests assert **external behavior** (a parse result or decision), not internals: e.g.
  netstat-text->owner-PID, readyz poll-sequence->verdict (injected fetch), msiexec-log-tail->status,
  fingerprint skip logic, state round-trip, arg parsing.
- **Modules tested:** `verify.ts` unit tests (netstat parsing, readyz verdict, non-blank
  decision). Windows-specific PowerShell calls are thin wrappers kept out of pure functions.
  The remaining modules are verified via the real `run`/`test` batteries against the installed exe.
- **Prior art:** repo uses `bun test` (AGENTS.md Testing Protocol); pure-decision tests mirror
  `tests/unit/lib/...` and `tests/unit/engines/...` patterns; devops output formatting convention
  is `devops/output-format.ts` (`--json`/`--out`).

## Out of Scope

- GitHub release automation (manual `gh release`, unchanged).
- The web dev loop (`devops/runtime-test`) — untouched.
- Frontend offline card (separate PRD component D).
- CDP-reachability of the Tauri WebView (impossible; screenshot heuristic remains the render assertion).
- Auto-retry / cross-cycle self-healing (loop still stops and reports).
- Headless/CI desktops (screenshot + window assertions require an interactive session).

## Further Notes

- Respect the AGENTS.md guardrails: no mid-task `tsc`, and never read app JSON via the
  PowerShell object pipeline (use bun/fetch).
- Follows `PRD-2026-08-03-desktop-autonomous-loop.md`; ships the per-run log fix already applied.
- Issue: `feat(devops): agentic desktop test loop toolkit`, label `ready-for-agent`,
  repo `owenservera/vivim-final`.
