# Unit 35.1 — System Health Daily Digest

**Fork ID:** 9.8 (v3: 8.8) | **Status:** `[ ]` | **Class:** C

> **Audit (2026-07-13):** No `health-digest` / daily digest producer. Telemetry + audit data are collected but never aggregated into a scheduled digest. Confirmed `[ ]`.
**Source spec:** `docs/atomic-v3-fork-canon/phase-09-observability/8.8-health-digest.md`
**Depends on:** telemetry dashboard (9.3 `[~]`), audit report (9.5 done), cost tracking (9.6 `[~]`)

## Context
A daily roll-up of system health so the user sees trends without opening dashboards: provider health, token/cost, error rates, selector-heal counts, task throughput.

## Current State
- Telemetry + audit data are collected; no scheduled digest producer.
- `src/engines/telemetry-aggregator.ts` exists (Phase 1).

## Requirements
New `src/engines/health-digest.ts` (+ a scheduled trigger):
- Aggregates last-24h metrics: provider health, token cost, error rate, heal counts, task completions.
- Renders a concise markdown digest.
- Delivery hook: persisted as a digest row + surfaced in workspace; optional file/stdout.
- Idempotent per-day.

## Acceptance Criteria
1. Digest covers all listed metric categories.
2. Re-running for the same day is idempotent.
3. Output is human-readable markdown.
4. `bun run devops gate` passes.

## Tests
`tests/unit/engines/health-digest.test.ts` — given 24h of fixtures, digest contains each metric; same-day re-run identical.

## DevOps
```powershell
bun run devops gate
```
