# PRD: CDP `Runtime.enable` Elimination (stealth hardening)

**Status:** READY FOR AGENT
**Date:** 2026-07-13
**Author:** opencode (research review)
**Labels:** `ready-for-agent`, `research-proposal`, `chrome-management`, `stealth`
**Source brief:** `docs/research/briefs/raw-cdp-patterns-brief.md` (High confidence, 6 sources)
**SOTA ref:** SOTA-05 anti-detection

---

## Problem Statement

The brief's key decision #5: **avoid `Runtime.enable`** — it is the primary CDP detection vector
(many automation detectors flag an enabled Runtime domain). However the code already implements the
*other* recommendations correctly:

- ✅ Per-slave `AsyncMutex` — `src/engines/chrome-governor.ts:300` (`getMutex`) serializes per slave.
- ✅ Flat session reuse — `chrome-governor.ts:684` ("ProfileAllocator … reuses the same session").
- ✅ Atomic command execution.

But `Runtime.enable` / `Runtime.evaluate` are used **directly in 6 engine call sites** that bypass
Governor mediation:

| File | Line | Call |
|------|------|------|
| `src/engines/slave-read.ts` | 40 | `Runtime.enable` (+ `Page.enable`) |
| `src/engines/composer-typing.ts` | 92, 107 | `Runtime.evaluate` |
| `src/cli/discovery-stack.ts` | 111, 120 | `Runtime.evaluate` |
| `src/engines/autonomous-execution.ts` | 708, 721, 724 | `Runtime.evaluate` |
| `src/engines/mcp-server-adapter.ts` | 267, 274, 281 | `Runtime.evaluate` |
| `src/engines/conversation-manager.ts` | 351, 567 | `Network.enable` (+ Runtime eval) |

`Network.enable` is lower-risk but the same "enable a domain you don't need" anti-pattern.

## Solution

Centralize **all** CDP evaluation behind a single Governor-mediated, stealth-aware path so the
Runtime domain is enabled at most once per session, wrapped, and disabled when idle.

### A. Governor API (`src/engines/chrome-governor.ts`)

Add:
```typescript
async evaluateStealth(slaveId: string, expression: string): Promise<unknown> {
  // per-slave mutex already serializes
  await this.cdpProxy.send(slaveId, 'Runtime.enable', {})
  try {
    return await this.cdpProxy.send(slaveId, 'Runtime.evaluate', { expression, returnByValue: true })
  } finally {
    await this.cdpProxy.send(slaveId, 'Runtime.disable', {}).catch(() => {})
  }
}
```
Prefer non-Runtime paths where possible (DOM.querySelector + Input.dispatch* + Page.captureScreenshot
need no Runtime domain). Reserve `evaluateStealth` for genuine JS needs.

### B. Refactor call sites

Replace the 6 direct `Runtime.evaluate` / `Runtime.enable` calls with
`governor.cdp.evaluateStealth(...)` (or DOM/Input equivalents). Move `Network.enable` into the
Governor-managed session lifecycle (enable once on session attach, not per call).

## Implementation Plan

1. Add `evaluateStealth` + `enableNetworkOnce` to `ChromeGovernor`/`CDPProxy`.
2. Grep `Runtime.enable|Runtime.evaluate|Network.enable` across `src/`; route each through the new API.
3. Update `slave-read.ts`, `composer-typing.ts`, `discovery-stack.ts`, `autonomous-execution.ts`,
   `mcp-server-adapter.ts`, `conversation-manager.ts`.
4. Keep `AsyncMutex` (already correct) — no change.

## Acceptance Criteria

1. `grep -rn "Runtime.enable" src/` returns **zero** results outside `chrome-governor.ts`.
2. `grep -rn "Runtime.evaluate" src/` returns zero direct engine calls (only inside Governor).
3. A stealth probe (sannysoft-style) against a governed slave shows Runtime domain not persistently
   enabled between commands.

## Tests

- `tests/unit/engines/chrome-governor.test.ts` — `evaluateStealth` enables+disables Runtime around
  the call; `Runtime.disable` always attempted (even on error).
- `tests/integration/stealth/runtime-enable.test.ts` — assert no `Runtime.enable` sent by engine
  call sites (mock CDP transport records sent methods).
- `tests/integration/stealth/sannysoft.test.ts` — stealth score unchanged/improved.

## Dependencies / Risks

- Must not break `slave-read.ts` (screenshot/READ paths) — verify capture still works post-refactor.
- Runtime domain sometimes already enabled by stealth module injection at page load; `evaluateStealth`
  should treat enable as idempotent.

## References

- `docs/research/briefs/raw-cdp-patterns-brief.md` (key decision #5)
- `src/engines/chrome-governor.ts:300,565,684`
- SOTA-05 anti-detection stealth modules (`src/engines/stealth/`)
