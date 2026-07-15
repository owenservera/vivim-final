# Unit 37.3 — Performance Tuning + Benchmarks

**Fork ID:** 13.4 (v3: 10.4) | **Status:** `[ ]` | **Class:** C

> **Audit (2026-07-13):** No `bench/` suite or `bun run bench` entry; no p50/p95 baselines. Latency budget enforcement (9.7) is partial but not a benchmark suite. Confirmed `[ ]`.
**Source spec:** `docs/atomic-v3-fork-canon/phase-13-polish-sdk/10.4-performance-tuning.md`
**Depends on:** all engines

## Context
Establish performance baselines and a benchmark suite so regressions are caught and hot paths are tuned.

## Current State
- No benchmark harness; latency budget enforcement (9.7 `[~]`) partial.

## Requirements
New `bench/` (or `scripts/bench.ts`):
- Benchmarks: capability execute latency, conversation send round-trip, memory indexing throughput, provider health poll.
- Captures p50/p95; compares against a stored baseline; fails CI on regression beyond threshold.
- A tuning pass on the worst p95 hot paths.

## Acceptance Criteria
1. Benchmark suite runs via `bun run bench`.
2. Produces p50/p95 per scenario; diffs vs baseline.
3. Regression beyond threshold fails CI.
4. `bun run devops gate` passes.

## Tests
Benchmarks are the artifacts; add a smoke test asserting the suite executes.

## DevOps
```powershell
bun run bench
bun run devops gate
```
