# Master PRD — Devops-Fullstack Toolkit v17 (Agent-Safe Autonomous Dev Loop)

**Status:** Draft → Approved for atomic build
**Owner:** vivim-final devops tooling
**Source:** STEP-1 scenario analysis (5 full-stack scenarios A–E) + deep inspection of current toolkit state
**Target skill:** `devops-fullstack` (merged master); CLI harness `bun run devops runtime-test <subcmd>`

---

## 1. Problem Statement

The `devops-fullstack` skill makes the LLM agent the runtime of the full-stack dev loop. The
current toolkit supports *probing and verifying*, but **not autonomous building from a general
goal** without the agent free-handing code and risking lockups. STEP-1 analysis of 5 grounded
scenarios surfaced six toolkit gaps that cause an autonomous CLI agent (Claude Code, Kilocode,
OpenCode) to **hang, produce partial work, or leak orphan processes**:

1. **Interactive-prompt hang** — `prisma migrate dev` blocks on stdin when no `--name` is given.
2. **Orphan processes** — detached `serve` + spawned Chrome survive agent crash (no watchdog).
3. **Verify-only loop / chicken-egg** — `loop` cannot *build*, and self-spawns a server that won't
   boot if code is broken, so discovery/verification is impossible until code compiles.
4. **No offline capability discovery** — planning a *new* capability requires a running server,
   which requires compiling code first.
5. **No capability codegen** — `build backend` is a no-op; thin agents drift from the exact
   `makeCapability` shape and break cross-surface parity.
6. **No enforceable goal gate** — vague goals get guessed/built wrong; no halt-and-ask rule.

## 2. Goals

- Make every dev-loop command **bounded, non-interactive, and structured-JSON**.
- Let an autonomous agent **plan offline** (static capability catalog) before building.
- Provide **codegen + non-interactive wrappers** so the agent emits correct capability/migration
  boilerplate instead of free-handing.
- Add **watchdogs + hooks** so servers/Chrome are always reclaimed (no orphans) and broken state
  (running servers, pending migrations) cannot be committed.
- Encode a **goal-resolution gate** so vague goals halt-and-ask instead of building wrong.
- Reconcile the SKILL's logical contradictions (loop launches its own server vs "launch once via
  PS1"; verify-only loop vs "agent builds").

## 3. Non-Goals

- Rewriting the 13 engines or the capability engine.
- Changing the Governor Canon / Store Contract / One-Entry-Point invariants.
- Building a black-box autonomous loop — the agent remains the runtime.

## 4. Requirements (mapped to the 6 toolkit areas)

| ID | Area | Requirement | Scenario |
|----|------|-------------|----------|
| R1 | Discovery opt | `discover --offline` reads a static capability catalog (no server) | A, E |
| R2 | Recipe | `build backend --cap=<slug>` emits a `makeCapability` skeleton + Store Contract stub | A |
| R3 | Timeout/Recipe | `migrate --name=<x>` runs `prisma migrate dev --name <x>` non-interactively under a spawn timeout | C |
| R4 | Background/Timeout | `ensure-browser` precheck returns `{ok,source}`; agent-death watchdog runs `stop` | B, D |
| R5 | Instruction | Loop enforces a goal-resolution gate: no `cap:<id>`+`slug` → halt & ask | E |
| R6 | Hooks | Lefthook guards: fail if `.runtime/*.pid` present; fail if `prisma migrate status` pending; `audit-code standard` in pre-push | C, E |
| R7 | Instruction | SKILL reconciled: loop uses PS1-launched servers; browser-unavailable → API-only + flag | B, D |
| R8 | Validation | Each new command is bounded + structured-JSON; `typecheck` clean; offline tests | all |

## 5. Success Metrics

- `bun run devops runtime-test discover --offline` returns capabilities without a server.
- `bun run devops runtime-test migrate --name=x` completes without stdin prompt and times out at 120s if blocked.
- `bun run devops runtime-test build backend --cap=foo_bar` writes a compilable skeleton.
- `bun run devops runtime-test ensure-browser` returns a deterministic `{ok,source}`.
- `bun run devops runtime-test loop --goal="vague"` returns a `needs-clarification` result (no spin).
- `git commit` while servers run is blocked by lefthook; `git push` runs `audit-code standard`.
- `bun run typecheck` clean on all new files.

## 6. Risks

- Static catalog can drift from source → mitigate with a `catalog-gen` command + document running it after capability changes.
- `migrate` timeout too short for large schemas → 120s default, overridable via `--timeout=`.
- Lefthook `run:` cross-platform (PowerShell repo) → implement guard logic in a TS `guard` command, call it from lefthook.

## 7. Out of Scope (future phases)

- Agent-death watchdog as a standalone long-running service (v17 implements a best-effort
  pre-commit/CI guard + documented manual watchdog).
- Full static UI-component inventory (v17 ships capability catalog; UI inventory deferred).
