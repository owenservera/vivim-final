# Spec: Discoverability Probe (009)

> SPECKIT `specify` artifact. Feature dir: `specs/009-discoverability-probe`.
> Drives the "how well is the system designed to surface the right data fast" goal.

## Problem Statement

The system advertises a **One Entry Point** invariant (AGENTS.md §One Entry Point): every
operation is a `UnifiedCapability` reachable through `POST /api/interpret` and
`GET /api/capabilities`. The claim is that an agent or user should be able to "know everything
about this project" in **two commands** — boot the system, then one enumerating call.

We have no automated test that proves (or measures) this. This feature adds a test suite that
**only uses the system's own CLI commands** to probe how fast and how completely the system
surfaces data about itself, and logs gaps where the invariant breaks.

## Constraint (non-negotiable)

- **CLI-only probing.** Tests invoke `bun run src/cli/index.ts <cmd>` (the `vivim` bin) and
  `bun run devops <cmd>` as subprocesses. No direct HTTP `fetch`, no Prisma/Db reads, no source
  import for the purpose of *probing the running system*. This is required to measure the system
  *as a user/agent experiences it*. (Test scaffolding like starting the server is exempt.)
- **PowerShell-compatible** invocation (AGENTS.md §Shell Environment).

## User Stories

- **US1 (Agent):** As an autonomous agent, I run `vivim serve` then `vivim help` and expect to
  see *every* registered capability across all surfaces (cli/ui/api/mcp/workflow), not just the
  `cli` surface.
- **US2 (Operator):** As an operator, I want a single offline command (`devops discover-all
  --offline` or `devops truth full`) that surfaces the system map without a running server.
- **US3 (Perf):** As a SRE, I want a latency budget assertion: each discovery command returns in
  < 2s p95.
- **US4 (Correctness):** As a reviewer, I want a coverage assertion: every capability registered
  in the system is reachable through *some* CLI command, and NL phrases resolve to the right
  capability in one call.

## Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| R1 | A test that boots the server (`vivim serve`) and runs exactly one discovery command, then asserts the full capability set is visible. | P0 |
| R2 | A latency harness that times each CLI discovery command and fails if p95 > 2s. | P0 |
| R3 | A coverage test that cross-checks registered capabilities vs CLI-reachable capabilities and reports the delta. | P0 |
| R4 | A test that exercises the kernel oracle single-call (`op:"all"`) path via its CLI surface and asserts it returns topology+health+capability+config. | P1 |
| R5 | A test that drives `POST /api/interpret` via the CLI and asserts NL→capability resolution latency and correctness. | P1 |
| R6 | A `DISCOVERABILITY-GAPS.md` gap log with severity + which invariant each gap violates. | P0 |

## Out of Scope

- Fixing the gaps (that is a follow-up feature). This feature *measures and logs* only.
- Browser/frontend surface testing (covered by other e2e suites).

## Acceptance Criteria

- All 5 test files exist under `tests/e2e/discoverability/`.
- `bun run devops gate` passes for the new files.
- `DISCOVERABILITY-GAPS.md` lists at least the 4 hypothesized gaps (see plan.md) with evidence.
