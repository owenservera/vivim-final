# AGENT4.md — Agent-System Sandbox Audit & Live Model Testing

**Agent:** #4 &nbsp;|&nbsp; **Feature:** Testing sandbox for OpenCode agent system + live LLM calls (hy3-free, deepseek-v4-flash) &nbsp;|&nbsp; **Status:** DESIGN COMPLETE — execution paused for coordination
**Date:** 2026-07-19 &nbsp;|&nbsp; **Branch:** master (uncommitted working tree)

---

## OBJECTIVE

Design a comprehensive audit + testing-sandbox framework for the vivim OpenCode agent
system, and begin exercising it with **real live OpenCode LLM calls** using the two
verified free models:

- `opencode/hy3-free`
- `opencode/deepseek-v4-flash-free`  (per AGENT1.md verified model list)

The sandbox must validate the agent system end-to-end: capability resolution, the
local-agent executor (`cap:agent:run`, AGENT1's spec 022 work), and live model
behavior under a controlled, audited harness. Audit dimensions: resolution correctness,
latency budget, cost, failure modes, permission-denial handling, and crash recovery.

---

## SESSION SUMMARY (what was done before pause)

1. **Architecture recon** — mapped the live-call path:
   - `POST /api/interpret` (`src/server/interpret-router.ts`) → `NLCLEngine.interpret()`
     → capability resolution → execution. Second surface: `POST /api/nlcl/interpret`.
   - `cap:agent:run` is the local-agent capability (AGENT1) that shells out to the
     opencode CLI (`src/engines/local-agent/local-agent-executor.ts`) — this is the
     real path that reaches hy3-free / deepseek-v4-flash.
   - `TelemetryAggregator` (`src/engines/telemetry-aggregator.ts`) already aggregates
     capability latency/success; `ChromeGovernor` owns the fleet lifecycle.
2. **Confirmed no dedicated direct-LLM client exists** — vivim is a CDP browser-provider
   harness; raw model API calls (Z.AI / OpenRouter) are NOT wired. The viable live-call
   path is the opencode CLI via `cap:agent:run` (AGENT1's integration).
3. **Server preflight** — `bun run devops runtime-test preflight` shows DB OK, server
   UNREACHABLE (must be started before live tests). Backend port: `9420`
   (`.runtime/backend.port`).
4. **OpenClaw harvest Steps A–D completed earlier in session** (separate workstream):
   taxonomy harvest → shared pool (3,921 nodes), capability-ownership + observability
   translation docs written, all marked DONE. Not part of AGENT4 scope but same session.

---

## STATUS FIELDS

| Field | Value |
|-------|-------|
| Agent | #4 |
| Scope | Agent-system sandbox audit + live model testing (hy3-free, deepseek-v4-flash) |
| Design | COMPLETE |
| Live execution | BLOCKED — server not running; awaiting coordination + launch |
| Files owned | `tests/.../agent-sandbox-audit.test.ts` (planned), `.runtime/agent-sandbox-*.ts` (planned) |
| Pre-existing collisions | `cap:agent:run` owned by AGENT1; do NOT re-register. `telemetry-aggregator` shared read-only. |
| Blast radius | New test/sandbox files only; no engine edits without sync. |

---

## KEY FINDINGS (for other agents)

- Live model calls flow through AGENT1's `cap:agent:run` → opencode CLI. To test live,
  call `POST /api/capabilities/cap:agent:run/execute` (or `/api/interpret` with NL) with
  `model: 'opencode/hy3-free'` / `'opencode/deepseek-v4-flash-free'`.
- Server must be up (`bun run dev:backend`) before any live call; preflight fails
  otherwise.
- Free-model cold latency per AGENT1: 37–54s. Sandbox timeouts must exceed this.
- No API keys needed for opencode free models (they are Zen free tier, authenticated via
  the opencode CLI's own credentials) — differs from a direct Z.AI/OpenRouter harness.

---

## NEXT STEPS (post-coordination)

1. Start backend: `bun run dev:backend`; confirm `bun run devops runtime-test preflight` → server OK.
2. Build audit sandbox harness: `tests/e2e/agent-sandbox-audit.test.ts` driving `cap:agent:run`
   for both models with a fixed NL prompt set; capture latency/ok/permissionDenied/sessionId.
3. Add an offline/unit mode (mocked opencode CLI) so the audit runs without live calls,
   plus a live mode gated by `AGENT4_LIVE=1`.
4. Emit audit report: resolution rate, p50/p95 latency, failure taxonomy, model parity
   (hy3-free vs deepseek-v4-flash).
5. Wire results into `TelemetryAggregator` schedules (optional enrichment from Step D).
6. Do NOT commit unless explicitly asked.

---

## COLLISION NOTES

- Do NOT touch AGENT1's `local-agent-executor.ts`, `capability-bootstrap.ts` seed fn, or
  `cap:agent:run` registration.
- Do NOT touch AGENT2's `fleet-supervisor.ts` / `chrome-governor.ts` admission code.
- Sandbox owns only: new test files under `tests/e2e/` or `tests/unit/`, and `.runtime/`
  helper scripts. Read-only use of `TelemetryAggregator` / `CapabilityEventBus`.
