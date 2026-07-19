# Research: DevOps Loop & Skill System Upgrade

**Feature**: 025-devops-loop-skill-upgrade
**Date**: 2026-07-19

## Decisions & Rationale

### D1: Single-pass `mark done` implementation approach

**Decision**: Extend `devops/mark.ts` with a `done` subcommand that accepts an optional
message, performs the state transition, appends the PROGRESS.md audit line with the
resolved `<sha>`, runs `git add -A`, and `git commit` in one step.

**Rationale**: The current two-commit anti-pattern (placeholder → rename) was identified
in `docs/plans/1783633791586-devops-toolkit-upgrades.md` Pattern 4. Keeping it in
`mark.ts` reuses the existing state machine and PROGRESS.md writer.

**Alternatives considered**:
- Git hook (post-mark) — rejected: harder to test, decoupled from the command.
- Separate `devops commit` command — rejected: adds a command with no standalone value.

### D2: Pre-compaction checkpoint mechanism

**Decision**: OpenCode plugin (`.opencode/plugin-context-checkpoint/index.ts`) subscribing
to `session.next.*` events, tracking token usage, emitting a summarize prompt at
`experimental.context_checkpoint_threshold` (default 0.8).

**Rationale**: From `docs/plans/1783827600085-opencode-pre-compaction-hook.md` Option 1
(recommended). The `experimental.session.compacting` hook is the supported extension point.

**Alternatives considered**:
- External monitor script (Option 2) — rejected: polling is fragile, misses in-flight context.
- Manual `/session-objectives` (Option 3) — rejected: requires human discipline, not automated.

### D3: parallelize subagent fan-out

**Decision**: `devops/parallelize.ts` computes the dependency-closure of independent units
(no cross-deps, different files), spawns N OpenCode subagents via `Bun.spawn` in isolated
worktrees, merges only when all pass gates.

**Rationale**: From `docs/plans/1783721778699-devops-upgrade-implementation-plan.md` Phase 7.
Sequential loop is the main throughput bottleneck for independent units.

**Alternatives considered**:
- In-process worker threads — rejected: no isolation, shared state corruption risk.
- Parallel `bun test` only — rejected: doesn't address implementation throughput.

### D4: pino structured logging

**Decision**: `src/lib/logger.ts` exports a pino singleton; engines create child loggers
via `logger.child({ engine: 'X' })`. Wire into TelemetryAggregator, ChromeGovernor,
HarnessProtocolEngine.

**Rationale**: From `docs/plans/1783721778699-devops-upgrade-implementation-plan.md` 1.2.
pino is the de-facto Node structured logger; JSON output enables log aggregation.

**Alternatives considered**:
- `winston` — rejected: heavier, slower than pino.
- `console.log` with JSON.stringify — rejected: no level filtering, no child context.

### D5: OTel sink

**Decision**: `src/engines/otel-sink.ts` subscribes to CapabilityEventBus `trace_entry`
events, maps to gen_ai semantic conventions, exports via OTLP HTTP to configurable endpoint.
No-op if no exporter configured.

**Rationale**: From `docs/plans/1783721778699-devops-upgrade-implementation-plan.md` 1.1.
Standard OpenTelemetry GenAI semantics enable cross-tool observability.

**Alternatives considered**:
- Custom trace format — rejected: not interoperable with Jaeger/Langfuse.
- Direct Langfuse SDK — rejected: couples engine to a vendor; OTLP is vendor-neutral.

## Resolved Clarifications

- **C1**: Should parallelize use worktrees or temp dirs? → Worktrees (isolation per constitution).
- **C2**: Should checkpoint plugin modify ongoing generation? → No; only emits prompt (per plan open questions).
- **C3**: pino pretty-print in dev? → Yes, `pino-pretty` when `NODE_ENV !== production`.
