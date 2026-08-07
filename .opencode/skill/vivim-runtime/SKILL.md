---
name: vivim-runtime
description: Agent becomes the runtime of its own dev loop (launch→engage→discover→test→debug→build→repeat). Fully-autonomous runtime-OS skill.
---
# vivim-runtime — Agentic Development Skill ✨

**Purpose:** Agent becomes the runtime of its own dev loop (launch→engage→discover→test→debug→build→repeat).

**Invocable as:** `vivim-runtime`

## Two Modes

- **Autonomous:** `bun run devops runtime-test` — full loop without human intervention
- **Human-in-the-middle:** Interactive mode for review/gate

## Commands

| Command | Action |
|---------|--------|
| `bootstrap` | Full server bootstrap with engines |
| `preflight` | Health check (DB + server) |
| `engage` | Launch browser slave |
| `discover-backend` | List backend capabilities |
| `discover-frontend` | Probe UI state via CDP |
| `test` | Live E2E harness |
| `ui-gate` | Check UI readiness |
| `debug` | Capture screenshot + console |
| `build` | Scaffold/regenerate UI |
| `runtime` | Full cycle |

## Invariants

- Governor Canon: only ChromeGovernor touches CDP
- Store Contracts: engines use `src/storage/contracts/*`
- FRONTEND=BACKEND (5.1)
- One Entry Point (25.7)

## Failure Playbook

1. Read `DebugReport` from `/tmp/vivim-debug/`
2. Apply fix, re-run loop

## Build Ledger

See `docs/atomic-v12/01-tracker.md` for atomic unit status.