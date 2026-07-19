# Feature Specification: DevOps Loop & Skill System Upgrade

**Feature Branch**: `025-devops-loop-skill-upgrade`

**Created**: 2026-07-19

**Status**: Draft

**Input**: User description: "Leverage the speckit plan > task system to fully upgrade the DevOps loop and skill system per audit findings"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Single-Pass Audit Commit (Priority: P1)

As a developer running the devops loop, I want `bun run devops mark <id> done "<msg>"` to mark a unit done AND commit with the resolved sha in one step, so that I avoid the two-commit anti-pattern where PROGRESS.md gets a `[PENDING-COMMIT]` placeholder then a second commit renames it.

**Why this priority**: The two-commit pattern occurs on every unit completion, creating noise and a fragile intermediate state. It is the most frequent friction in the loop.

**Independent Test**: Run `bun run devops mark <id> done "test message"` on any in_progress unit; verify exactly one git commit is created and PROGRESS.md contains the real `<sha>` (not `[PENDING-COMMIT]`).

**Acceptance Scenarios**:

1. **Given** a unit in `in_progress` state, **When** `bun run devops mark <id> done "<msg>"` runs, **Then** exactly one commit is created with the message and PROGRESS.md audit line contains the real sha.
2. **Given** a unit with no message arg, **When** `bun run devops mark <id> done` runs, **Then** it still marks done and commits with a default message.

---

### User Story 2 - Pre-Compaction Context Checkpoint (Priority: P1)

As an agent running long autonomous loops, I want a context-checkpoint mechanism that triggers a summarize prompt at 80% of context limit, so that valuable work-in-progress is preserved before auto-compaction.

**Why this priority**: Context loss on compaction silently destroys hours of incremental state. This is a P1 reliability concern for autonomous operation.

**Independent Test**: Configure `opencode.json` with `experimental.context_checkpoint_threshold: 0.8`; verify the plugin emits a summarize prompt when session tokens cross 80%.

**Acceptance Scenarios**:

1. **Given** an active session accumulating tokens, **When** usage crosses 80% of limit, **Then** a checkpoint prompt is emitted capturing current work + next steps.
2. **Given** the checkpoint fires, **When** compaction occurs, **Then** the summarized context is preserved in the post-compaction session.

---

### User Story 3 - Subagent Parallelize for Independent Units (Priority: P2)

As a devops orchestrator, I want `bun run devops parallelize` to compute the dependency-closure of independent units and spawn N OpenCode subagents, so that throughput scales linearly with available agents.

**Why this priority**: The current loop is strictly sequential. Independent units (different files, no deps) could complete in parallel, cutting wall-clock time significantly.

**Independent Test**: Run `bun run devops parallelize --dry-run` on a feature with ≥3 independent units; verify it reports the correct fan-out groups and merge strategy.

**Acceptance Scenarios**:

1. **Given** ≥2 units with no cross-dependencies, **When** `bun run devops parallelize` runs, **Then** spawns subagents and merges only when all pass.
2. **Given** a unit with an unresolved dependency, **When** parallelize runs, **Then** that unit is held until its dependency completes.

---

### User Story 4 - Structured Logging with pino (Priority: P2)

As a debugger of the devops system, I want structured JSON logging via pino in all engines, so that logs are aggregatable and traceable across the loop.

**Why this priority**: Current ad-hoc console.log makes post-mortem analysis of loop failures difficult. Structured logs enable filtering by engine/level.

**Independent Test**: Trigger a devops loop run; verify `src/lib/logger.ts` emits pino JSON with engine + level fields, and that TelemetryAggregator/ChromeGovernor/HarnessProtocolEngine use it.

**Acceptance Scenarios**:

1. **Given** a running devops command, **When** it logs, **Then** output is pino JSON with `engine`, `level`, `msg` fields.
2. **Given** an error in an engine, **When** logged, **Then** it includes the stack trace in `err` field.

---

### User Story 5 - OTel Instrumentation Sink (Priority: P3)

As a performance engineer, I want an OTel sink subscribing to CapabilityEventBus that exports gen_ai semantic traces, so that LLM call latency/cost is observable.

**Why this priority**: Without tracing, we cannot identify slow paths or cost hotspots in the autonomous loop. Lower priority because it requires external infra (Jaeger/Langfuse).

**Independent Test**: Run a capability execution; verify a span is emitted to the configured OTLP exporter with `gen_ai.prompt_tokens` / `gen_ai.completion_tokens` attributes.

**Acceptance Scenarios**:

1. **Given** a capability executes with LLM calls, **When** OtelSink is active, **Then** a trace with gen_ai attributes is exported.
2. **Given** no exporter configured, **When** OtelSink initializes, **Then** it no-ops gracefully.

---

### Edge Cases

- What happens when `mark done` is called on an already-done unit? (Should be idempotent / warn)
- How does parallelize handle a subagent that hangs or fails? (Timeout + fallback to sequential)
- What if pino logger is called before `src/lib/logger.ts` is initialized? (Lazy singleton)
- What if OTLP exporter is unreachable? (Drop spans, never block the loop)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide `bun run devops mark <id> done "<msg>"` that performs mark + commit in one atomic step.
- **FR-002**: System MUST eliminate the `[PENDING-COMMIT]` placeholder pattern in PROGRESS.md.
- **FR-003**: System MUST provide a pre-compaction checkpoint hook configurable via `opencode.json` `experimental.context_checkpoint_threshold`.
- **FR-004**: System MUST preserve work-in-progress context when checkpoint fires before compaction.
- **FR-005**: System MUST provide `bun run devops parallelize` that computes independent unit closures and spawns subagents.
- **FR-006**: System MUST merge parallel subagent results only when all pass their gates.
- **FR-007**: System MUST provide `src/lib/logger.ts` pino singleton used by all engines.
- **FR-008**: System MUST emit logs as JSON with `engine`, `level`, `msg` fields.
- **FR-009**: System MUST provide `src/engines/otel-sink.ts` subscribing to CapabilityEventBus.
- **FR-010**: System MUST export gen_ai semantic traces via OTLP when configured.

### Key Entities

- **Unit**: atomic task tracked by devops (id, state, deps). Source of parallelize fan-out.
- **CheckpointConfig**: `{ threshold: number, prompt: string }` from opencode.json experimental.
- **OtelSpan**: `{ engine, method, durationMs, ok, attributes }` input to OtelSink.
- **Logger**: pino singleton with child loggers per engine.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every unit completion produces exactly 1 git commit (was 2).
- **SC-002**: 100% of auto-compaction events have a preceding checkpoint summarize prompt.
- **SC-003**: Parallelize reduces wall-clock for ≥3 independent units by ≥40% vs sequential.
- **SC-004**: 100% of engine log lines are structured JSON (zero ad-hoc console.log in src/engines).
- **SC-005**: OTel traces capture ≥90% of LLM calls in the loop.

## Assumptions

- OpenCode supports `experimental.session.compacting` hook (verified in plan source).
- Jaeger/Langfuse is available for OTel export (docker-compose optional).
- Subagents spawn via OpenCode CLI in isolated worktrees.
- `bun` is the runtime for all devops commands.
- The devops tracker state machine (`mark.ts`) is the integration point for FR-001.
