# Feature Specification: Harness Command Registry

**Feature Branch**: `017-harness-command-registry`

**Created**: 2026-07-17

**Status**: Draft

**Input**: User description: "Design a future-proof harness command registry schema and system that encompasses the current automation/UI-automator/ChromeGovernor source code, so the primitive adaptors and the WebApp-LLM-I/O repair pipeline are integrated units designed around the known limitations from day 0. Critique the pasted Playwright-based WebApp LLM I/O harness design and re-home it onto vivim-final's existing HarnessDAG + Harness Protocol Engine primitives, Governor-Canon compliant."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Declarative harness commands with retry/branch (Priority: P1)

As an **Automation Builder**, I want to declare a harness interaction as a versioned, registered command (navigate → type → submit → capture → *retry on failure* → *branch on condition*) so that transient WebApp failures and provider quirks (cookie banners, upgrade prompts, "thinking" indicators) are handled by the harness runtime — not by me writing custom parser/loop code per automation.

**Why this priority**: The repo already declares `HarnessNode.type` variants `sequence | branch | parallel | retry | precondition` but `ChromeGovernor.executeHarnessPlan` only implements a flat `action` switch (chrome-governor.ts:262-359). This story closes the gap the `2026-07-16-harness-injection-audit.md` flagged as F2.3/F3.x, and is the backbone every other consumer (AgenticLoop, WorkflowEngine) depends on.

**Independent Test**: Can be fully tested by executing a `HarnessDAG` containing a `retry` node against a mock `CDPTransport` that fails the first N attempts then succeeds, asserting the captured body is returned and step count reflects retries; delivers value as a self-healing send even without any LLM/repair layer.

**Acceptance Scenarios**:

1. **Given** a DAG with a `retry` node wrapping `type_text → submit → capture` (maxAttempts=3, backoffMs=200), **When** the `capture` step fails twice then succeeds, **Then** the harness returns `{ success: true, stepsCompleted: 3, capturedBody: <text> }` and no error is surfaced to the caller.
2. **Given** a DAG with a `retry` node and the wrapped step always fails, **When** attempts exceed `maxAttempts`, **Then** the harness returns `{ success: false, error: <last error>, attempts: 3 }` and emits a `harness:retry_exhausted` event.
3. **Given** a DAG with a `branch` node whose `condition` reads an `outputKey` set by a prior `capture`, **When** the condition matches, **Then** the `then` subgraph executes and the `else` subgraph does not (and vice-versa).

---

### User Story 2 - Schema-driven repair of non-conformant WebApp JSON (Priority: P2)

As an **Automation Builder**, I want to declare an `expectedSchema` (a Zod contract) when I send a prompt to a WebApp LLM, and have the raw captured DOM response repaired into that schema — even when the LLM returns markdown-fenced JSON, trailing commas, single-quoted keys, truncated output, or aliased field names — so I get typed data instead of garbage.

**Why this priority**: sota-09 (HPE) FR-2/FR-3 already specify this pipeline, but no engine implements it. This story delivers the `harness-repair-engine` that turns the pasted "RepairPipeline" design into a store-contract-driven, Governor-Canon-compliant engine operating on `CaptureResult.body`.

**Independent Test**: Can be fully tested by feeding the repair engine a `CapturedBlock`-like input (markdown-fenced, trailing-comma, alias-keyed JSON) plus a Zod schema with repair metadata, asserting the engine returns `{ success: true, data: <typed>, repairs: [...] }` without any browser.

**Acceptance Scenarios**:

1. **Given** a raw response wrapped in ` ```json ` fences with a trailing comma, **When** repair runs, **Then** the fence is stripped, the trailing comma removed, and the parsed object is returned.
2. **Given** a JSON object using alias keys (`usr_name`) where the schema declares `aliases: ['usr_name']` for `username`, **When** repair runs, **Then** the canonical key `username` is populated.
3. **Given** prose wrapping the JSON ("Sure! Here's the data: {…} I hope this helps"), **When** repair runs, **Then** the boilerplate is stripped and the JSON extracted (structure_detect strategy).
4. **Given** a response with an apostrophe in a string value (`O'Brien`), **When** custom syntax repair runs, **Then** the apostrophe is preserved (no blind `'`→`"` rewrite).

---

### User Story 3 - Feedback loop with backoff (Priority: P3)

As an **Agentic Loop**, after a repair failure, I want the harness to regenerate a corrected prompt that includes the *specific* schema errors and uses exponential backoff between retries, so the LLM gets actionable, non-repeating feedback instead of an identical prompt storm that hits rate limits.

**Why this priority**: The pasted `FeedbackEngine` regenerates the same prompt every round (no backoff, no diff) → rate-limit storm. This story makes the retry/feedback a first-class, throttle-aware part of the registry.

**Independent Test**: Can be fully tested by invoking the feedback coordinator with a failed `RepairResult` and asserting the regenerated prompt contains the path-specific error, and that two successive calls are spaced by a growing delay.

**Acceptance Scenarios**:

1. **Given** a repair failure with errors at path `user.email`, **When** the feedback coordinator builds the next prompt, **Then** the prompt lists that specific path error and requests a corrected JSON.
2. **Given** `maxAttempts=3` with `backoffMs=200`, **When** three retries are scheduled, **Then** the delays follow 200ms, 400ms, 800ms (exponential).

---

### Edge Cases

- What happens when the captured response is empty or binary garbage? → Repair engine returns `{ success: false, errors: [{ stage: 'syntax', message: 'unparseable' }] }` (sota-09 AC-3.3); harness does not crash (NFR-4).
- What happens when a `retry` node wraps a `branch` node that itself wraps a failing step? → Retries apply to the whole subgraph; exhausted retries surface the innermost error.
- What happens when the registry has two versions of a command? → `resolve('latest')` returns the highest semver, never lexicographic (`'2' < '10'` bug avoided).
- What happens when an engine other than `ChromeGovernor` tries to drive CDP? → Blocked by Governor Canon; the registry's browser adaptors are *only* invoked through `executeHarnessPlan`.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a `HarnessCommand` registry that maps a command id + version to a `HarnessNode` template, a Zod validation schema, and an adaptor reference.
- **FR-002**: System MUST persist harness commands in a DB-backed table (`harness_command`) seeded from JSON manifests in `seeds/`, resolvable by `version` with `latest` semantics.
- **FR-003**: `ChromeGovernor.executeHarnessPlan` MUST implement `retry`, `branch`, `sequence`, and `precondition` node types (not only `action`), per the `HarnessNode` type declaration.
- **FR-004**: A `retry` node MUST re-execute its wrapped subgraph up to `maxAttempts` times, applying `backoffMs` exponential delay, and surface the last error on exhaustion.
- **FR-005**: A `branch` node MUST evaluate `condition` against an in-plan `outputKey` store and execute exactly one of `then`/`else` subgraphs.
- **FR-006**: System MUST provide a `HarnessRepairEngine` (store-contract driven, no browser access) that accepts a raw captured string + Zod schema and returns a `RepairResult` (`{ success, data?, errors, repairs }`).
- **FR-007**: The repair engine MUST apply extraction strategies in priority order: `schema_guided → json_block → structure_detect (with JSON repair) → plain_text` (sota-09 FR-2.2).
- **FR-008**: Repair metadata (aliases, coerce hints, defaults, semantic validators) MUST be carried in a side-table keyed by Zod type — MUST NOT monkey-patch the Zod prototype (fixes pasted-design defect).
- **FR-009**: Custom syntax repair MUST preserve apostrophes and quotes inside string values; MUST NOT blindly rewrite `'`→`"`.
- **FR-010**: `registry.resolve('latest')` MUST use semver ordering, not lexicographic string sort.
- **FR-011**: The repair engine MUST strip common LLM boilerplate (lead/trail pleasantries, disclaimers, prompt echo) before extraction (sota-09 FR-2.5).
- **FR-012**: A feedback coordinator MUST build the next prompt from path-specific repair errors and apply exponential backoff between retries.
- **FR-013**: Every harness operation (augment, extract, validate, route, retry, branch) MUST emit events on `CapabilityEventBus` with conversation/operation identity (fixes audit F3.4).
- **FR-014**: The registry and repair engine MUST NOT require any new runtime dependency beyond what exists (Bun + Zod 3.24). HTML/JSON extraction MUST be Bun-native (no `cheerio`/`playwright`/`jsonrepair`).

### Key Entities

- **HarnessCommand**: `{ id, version, kind, paramsSchema (Zod), adaptorRef, description }` — a registered, versioned harness interaction primitive.
- **HarnessNode** (extends existing): adds `retry`/`branch`/`sequence`/`precondition` fields used by `executeHarnessPlan`.
- **RepairResult<T>**: `{ success, data?, errors: RepairError[], repairs: RepairRecord[], attempts, originalContent, repairedContent? }`.
- **RepairMetadata**: `{ aliases?, coerceFrom?, defaultValue?, semanticValidator?, description? }` — stored in a `Map<ZodType, RepairMetadata>`, not on the prototype.
- **HarnessCommandRow** (DB): `id, commandId, version, kind, paramsSchemaJson, adaptorRef, description, createdAt`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A send that fails transiently (≤2 of 3 attempts) self-heals without caller intervention in 100% of cases in tests.
- **SC-002**: Non-conformant WebApp JSON (markdown-fenced, trailing comma, alias keys, truncated, boilerplate-wrapped) is repaired to the expected schema in >85% of cases (sota-09 target), measured by the repair-engine test suite.
- **SC-003**: Repair of a response containing an apostrophe in a string value preserves the apostrophe in 100% of cases.
- **SC-004**: `resolve('latest')` returns the highest semver across mixed-width versions (e.g. `1.2.10` > `1.2.9`) in 100% of cases.
- **SC-005**: Zero new runtime dependencies; the harness command registry and repair engine run under Bun with only Zod 3.24.
- **SC-006**: `bun run devops invariants check --category B` reports 0 Governor-Canon violations after implementation.

## Assumptions

- The harness command registry extends the **existing** `HarnessDAG`/`HarnessNode`/`executeHarnessPlan` in `ChromeGovernor` (chrome-governor.ts:81-408) and the HPE design in `docs/merged-design-v2/sota-09-harness-protocol-engine.md`; it does not introduce a parallel Playwright system.
- `harness_command` is stored in a new Prisma table seeded from `seeds/harness-commands/*.json` (matches `ProviderEndpoint` pattern; audit F2.1 recommends `harness_mode` — unified here as `harness_command`).
- No LLM call is made inside the repair engine for `llm_repair` in v1 (sota-09 FR-2.2 strategy 4 is deferred; the four local strategies satisfy SC-002).
- `CapabilityEventBus` already exists and is the event surface (FR-013).
- The WebApp LLM I/O path reuses `ChromeGovernor.capture()` → `CaptureResult.body`; the repair engine consumes that string. No separate DOM extractor process is spawned.
