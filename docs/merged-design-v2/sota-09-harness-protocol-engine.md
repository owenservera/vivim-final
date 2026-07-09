# SOTA-09 — Harness Protocol Engine

**Status:** DRAFT — PRD
**Priority:** P1 — CROSS-CUTTING (serves P1 MirrorEngine, P2 AgenticLoop, P3 WorkflowEngine)
**Epic:** CAP-002
**Date:** 2026-07-09
**Extends:** `04-merged-engines.md` (ConversationManager, StreamParserEngine, CapabilityEngine), `sota-03-agentic-observation-loop.md` (AgenticLoopEngine), `sota-04-visual-workflow-engine.md` (WorkflowEngine), `sota-01-priority-pipe-mirror.md` (MirrorEngine)

---

## 1. Feature Name

**Harness Protocol Engine (HPE)**

The bidirectional bridge that transforms every prompt sent through cap-store into a *harness-contextualized* prompt, and transforms every raw LLM response — regardless of provider, format, or quality — into a *harness-actionable* output.

---

## 2. Epic

- **Parent Epic:** CAP-002 — SOTA Enhancement Suite (cap-store v2)
- **Architecture Baseline:** `02-merged-architecture.md` (v1 architecture + Governor canon)
- **Engine Baseline:** `04-merged-engines.md` (ConversationManager, StreamParserEngine, CapabilityEngine, HarnessDAG)
- **SOTA Baseline:** `sota-00-master-index.md` through `sota-08-implementation-glossary-delta.md`

---

## 3. Goal

### Problem

cap-store automates LLM interactions through webapp-CD in Chrome, capturing responses from the DOM or network layer. These raw responses are inherently unreliable for harness consumption:

1. **Format ambiguity** — The same LLM may return a plan as JSON, markdown, or free-form text, depending on session state, model version, or prompt phrasing. Existing `StreamParserEngine` parsers are provider-specific and expect well-formed input; they break on partial, malformed, or inconsistently formatted responses.

2. **No harness context on the outbound side** — Prompts are sent as plain text. The LLM has no structured awareness of what capabilities are available, what selectors are valid, what the current page state is, or what DAG step types it can request. This forces every consumer (ConversationManager, AgenticLoopEngine, WorkflowEngine) to reinvent prompt engineering for harness context injection.

3. **No response-to-action pipeline** — When an LLM responds with "click the send button" or "navigate to /chat/new", the system has no unified engine to parse that intent, validate it against the capability registry, and route it to the correct executor. Each consumer builds its own ad-hoc extraction logic.

4. **Fragile to response quality variance** — LLMs produce partial responses (stopped mid-generation), broken JSON (missing closing braces), markdown-wrapped structured content (```json fences around actual data), boilerplate text (disclaimers, "I hope this helps"), and mixed-content responses (natural language interspersed with structured actions). The current parsers produce garbage `ContentBlock[]` or throw.

5. **No feedback loop** — When the harness executes an action extracted from an LLM response, the result (success/failure, output data, DOM changes) never feeds back into the prompt context for subsequent turns. The LLM operates blind to execution outcomes.

### Solution

The Harness Protocol Engine (HPE) is a **bidirectional normalization layer** that sits between any cap-store consumer and the ChromeGovernor's CDP transport. It has three subsystems:

- **PromptAugmenter** (outbound) — Injects a dynamic harness context schema into every prompt before it reaches the LLM. The schema describes: available capabilities, current slave state, valid selectors, DAG step types, expected response format, and any constraints. This is the "fuzzy" analog of Claude Code's tool-use protocol — the LLM sees what it *can* ask the harness to do, and receives formatting guidance to maximize response parsability.

- **ResponseExtractor** (inbound) — Receives raw LLM responses (text, markdown, HTML, partial/malformed content) and applies a multi-strategy extraction pipeline to produce structured `HarnessAction[]` or normalized `ContentBlock[]`. Strategies include: schema-guided regex extraction, markdown fence unwrapping, JSON repair (brace balancing, quote completion), LLM-powered extraction (when confidence is low), and fallback to plain-text block extraction.

- **ActionRouter** (inbound) — Validates extracted `HarnessAction[]` against the capability registry and selector strategy tables. Routes each action to the appropriate executor: `ChromeGovernor.cdp.executeHarnessPlan()` for DAG steps, `CapabilityEngine.execute()` for capability actions, `AgenticLoopEngine` for goal-directed loops, or `WorkflowEngine` for sub-workflow execution. Collects execution outcomes and feeds them back to the `PromptAugmenter` for subsequent turns.

### Impact

| Metric | Before HPE | After HPE |
|--------|-----------|-----------|
| LLM response → harness action success rate | ~40% (ad-hoc extraction per consumer) | >85% (unified fuzzy extraction + repair) |
| Broken/partial response handling | Parser throws → error block | Repaired → best-effort valid action |
| Harness context in prompts | Each consumer builds its own (inconsistent) | Single schema injected automatically |
| New automation onboarding | Write custom prompt + custom parser | Define expected schema → HPE handles the rest |
| Action execution feedback loop | None | Execution results fed into next prompt context |

---

## 4. User Personas

| Persona | Role | Needs from HPE |
|---------|------|---------------|
| **Automation Builder** | Developer or power user building workflows/automations in cap-store | Define what the LLM should do, write a prompt, and have HPE handle the rest — no custom parsing code |
| **Agentic Loop** (system) | The AgenticLoopEngine's PlanLayer (SOTA-03) | Needs LLM to propose valid actions from the current page state; HPE injects page context + capability catalog and extracts a `PlanResult` from the response |
| **Workflow Engine** (system) | The WorkflowEngine's `llm_call` and `agent_decide` nodes (SOTA-04) | Needs LLM responses to produce `WorkflowNodeExecution` outputs that the rest of the workflow DAG can consume |
| **ConversationManager** (system) | The 8-step pipeline (v1 04) | Needs progressive `ContentBlock[]` from LLM responses, but with blocks that survive malformed input |
| **Provider Discovery** (system) | ProviderDiscoveryEngine (SOTA-02) | Needs LLM to analyze DOM snapshots and return `InferredCapability[]` in a parseable format |
| **Operator** | Human monitoring or intervening in automations | Needs clear visibility into what actions were extracted from LLM responses and whether they executed successfully |

---

## 5. User Stories

### US-1: Prompt Augmentation (Outbound)
> As an **Automation Builder**, I want HPE to automatically inject harness context into every prompt I send, so that the LLM knows what capabilities, selectors, and actions are available without me writing custom system prompts for every automation.

### US-2: Schema-Directed Response Extraction (Inbound)
> As an **Automation Builder**, I want to declare an `expectedSchema` when I send a prompt (e.g., `{ type: "plan", fields: ["action", "selector", "input"] }`), and have HPE extract and validate the LLM's response against that schema — even if the response is wrapped in markdown, contains boilerplate, or has minor formatting issues.

### US-3: Broken Response Repair
> As an **Agentic Loop**, when the LLM returns a partial JSON response (e.g., truncated mid-generation), I want HPE to repair it to the best valid structure possible — close braces, complete strings, fill defaults — rather than throwing an error and aborting the loop iteration.

### US-4: Multi-Format Response Extraction
> As a **Workflow Engine**, when an `llm_call` node receives a response that mixes natural language, code blocks, and JSON data, I want HPE to split the response into structured blocks (text, code, data) that I can route to different downstream workflow nodes.

### US-5: Action Validation & Routing
> As the **Harness Runtime**, I want every action extracted from an LLM response to be validated against the capability registry before execution — rejecting actions that reference non-existent capabilities, invalid selectors, or forbidden operations — so that a hallucinated action doesn't crash the slave.

### US-6: Execution Feedback Loop
> As an **Agentic Loop**, after executing actions extracted from an LLM response, I want the execution outcomes (success/failure, output data, DOM changes) automatically fed back into the prompt context for the next turn, so the LLM can adapt its plan based on what actually happened.

### US-7: Provider-Agnostic Operation
> As a **Provider Discovery Engine**, I want HPE to work identically regardless of which provider (Claude, ChatGPT, Gemini) the LLM response came through — the extraction and repair logic should be provider-agnostic, relying on the response content rather than the transport.

### US-8: Human-Readable Trace
> As an **Operator**, I want to see exactly what harness context was injected into each prompt, what raw response was received, what actions were extracted, and whether each action executed successfully — all in a single trace view.

---

## 6. Requirements

### Functional Requirements

#### FR-1: Prompt Augmentation

- **FR-1.1:** HPE MUST accept a `HarnessContext` object from the caller containing: provider ID, slave ID, conversation ID, available capabilities (resolved from `CapabilityResolutionEngine`), current page state (from `ObservationTap`/`MirrorEngine`), valid selector strategies, and any caller-specified constraints.
- **FR-1.2:** HPE MUST transform the `HarnessContext` into a `HarnessActionSchema` — a structured text block describing available actions, their parameters, and formatting instructions — and append it to the user's prompt before the prompt is sent to Chrome.
- **FR-1.3:** The `HarnessActionSchema` MUST include: (a) a list of available capability slugs with descriptions, (b) valid DAG step types (`sequence`, `branch`, `parallel`, `retry`, `step`), (c) available harness module IDs, (d) valid selector references for the current page state, (e) the expected response format (JSON schema, markdown template, or free-text hint), and (f) formatting instructions to maximize parsability ("respond in JSON", "wrap JSON in ```json fences", etc.).
- **FR-1.4:** If the caller specifies an `expectedSchema`, the `HarnessActionSchema` MUST include that schema as the primary response format instruction.
- **FR-1.5:** HPE MUST cache the `HarnessContext` for the duration of the send→capture→extract cycle so that the same context used for prompt augmentation is available for response validation.

#### FR-2: Response Extraction

- **FR-2.1:** HPE MUST accept a raw LLM response (string) and an `expectedSchema` (optional), and produce a `NormalizedResponse` containing: (a) `ContentBlock[]` for chat-style consumption, (b) `HarnessAction[]` for harness execution, (c) extraction metadata (confidence, strategy used, repairs applied).
- **FR-2.2:** HPE MUST apply extraction strategies in priority order: (1) `schema_guided` — parse against expectedSchema, (2) `json_block` — find and parse ```json fences, (3) `structure_detect` — heuristic detection of JSON objects/arrays in text, (4) `llm_repair` — send malformed content to a fast/cheap LLM for repair, (5) `plain_text` — fallback: wrap entire response as a single text ContentBlock.
- **FR-2.3:** The `json_block` strategy MUST handle: nested code fences, multiple JSON blocks in one response, JSON blocks with language annotations (`json`, `javascript`, no annotation), and indentation variations.
- **FR-2.4:** The `structure_detect` strategy MUST apply JSON repair: balance braces/brackets, complete truncated strings (close quotes), fill missing commas between array elements, truncate trailing garbage after valid JSON terminates.
- **FR-2.5:** HPE MUST detect and strip common boilerplate patterns from LLM responses before extraction: leading/trailing pleasantries ("Sure! Here's...", "I hope this helps!"), disclaimer paragraphs ("As an AI...", "Note: ..."), and repeated prompt echo.
- **FR-2.6:** The extraction MUST produce both `ContentBlock[]` (for backward compatibility with `StreamBlockStore` and `ConversationManager`) and `HarnessAction[]` (for harness execution consumers).

#### FR-3: Harness Action Validation

- **FR-3.1:** HPE MUST define a `HarnessAction` type with variants: `capability_action` (executes a registered capability), `dag_step` (executes a HarnessDAG step), `agentic_goal` (delegates to AgenticLoopEngine), `workflow_call` (invokes a sub-workflow), `observation_request` (requests DOM/network observation), and `data_transform` (transforms workflow variables).
- **FR-3.2:** HPE MUST validate every `HarnessAction` against the capability registry: (a) `capability_action` → action.capabilitySlug must exist in `capability_taxonomy` and have an active binding for the provider, (b) `dag_step` → action.moduleId must exist in the harness module registry, (c) selectors referenced in action.input must exist in `selector_strategy` for the provider or be resolvable via `SemanticGroundingEngine`.
- **FR-3.3:** HPE MUST reject actions that reference: non-existent capabilities, forbidden capabilities (as per caller-specified constraints), invalid selectors (after attempting `SelectorHealer` repair), or operations classified as `destructive` without explicit caller approval.
- **FR-3.4:** Rejected actions MUST produce an `ActionRejection` event on the `CapabilityEventBus` with the reason for rejection and the original extracted action for debugging.

#### FR-4: Action Routing

- **FR-4.1:** HPE MUST route validated `HarnessAction[]` to the appropriate executor based on action type: `capability_action` → `CapabilityEngine.execute()`, `dag_step` → `ChromeGovernor.cdp.executeHarnessPlan()`, `agentic_goal` → `AgenticLoopEngine`, `workflow_call` → `WorkflowEngine.execute()`, `observation_request` → `ObservationTap`, `data_transform` → in-process expression evaluation.
- **FR-4.2:** HPE MUST execute actions sequentially by default, with an option for parallel execution of independent actions (actions referencing different capabilities with no shared state).
- **FR-4.3:** If an action fails, HPE MUST: (a) log the failure to `episodic_memory` (MemoryEngine), (b) emit an `action:failed` event on the `CapabilityEventBus`, (c) stop sequential execution (do not execute remaining actions), and (d) include the failure in the execution feedback for the next prompt turn.

#### FR-5: Execution Feedback Loop

- **FR-5.1:** After executing `HarnessAction[]`, HPE MUST collect execution outcomes: (a) for each action: ok/fail, output data, duration, error details, (b) page state changes (from `ObservationTap`/`MirrorEngine`), (c) new DOM elements, navigation events, or state transitions.
- **FR-5.2:** HPE MUST format execution feedback into a structured block (`ExecutionFeedback`) and inject it into the `HarnessContext` for the next prompt turn, so the LLM receives "here's what happened when I executed your last plan."
- **FR-5.3:** The `ExecutionFeedback` block MUST be compact — limited to the last N actions (default 10) and the most recent page state diff — to avoid consuming the LLM's context window.

#### FR-6: Integration with ConversationManager

- **FR-6.1:** HPE MUST intercept the `ConversationManager.send()` pipeline at two points: (a) between step 4 (ENSURE) and step 5 (SEND) — augment the prompt with harness context, (b) between step 6 (CAPTURE) and step 7 (PARSE) — extract harness actions from the raw capture body before it reaches `StreamParserEngine`.
- **FR-6.2:** The `ConversationManager` MUST NOT require code changes to use HPE — HPE wraps the existing pipeline transparently. If HPE is not configured, the pipeline operates as before.
- **FR-6.3:** HPE MUST NOT break the `StreamParserEngine` pipeline — the existing provider-specific parsers continue to produce `ContentBlock[]` for chat display. HPE adds `HarnessAction[]` extraction on top.

#### FR-7: Store Contract

- **FR-7.1:** HPE MUST persist every prompt augmentation and response extraction as an `hpe_session` row in the database, referenced by `conversation_id` or `workflow_execution_id`.
- **FR-7.2:** HPE MUST provide a store contract for: (a) saving/loading HPE sessions, (b) saving/loading extraction results, (c) retrieving execution feedback history, (d) querying action execution outcomes.
- **FR-7.3:** HPE session rows MUST include: the raw prompt (before augmentation), the augmented prompt (after HarnessActionSchema injection), the raw response, the extracted `ContentBlock[]`, the extracted `HarnessAction[]`, validation results per action, execution results per action, and timestamps.

### Non-Functional Requirements

- **NFR-1 (Performance):** Prompt augmentation MUST complete in <5ms (in-memory transformation, no I/O beyond cached context).
- **NFR-2 (Performance):** Response extraction MUST complete in <200ms for responses under 100KB. The `llm_repair` strategy is exempt from this budget (it calls an external LLM) but MUST be triggered only when other strategies fail.
- **NFR-3 (Performance):** Action validation MUST complete in <10ms per action (in-memory lookup against cached capability registry).
- **NFR-4 (Reliability):** HPE MUST NOT crash on any input. Malformed JSON, empty responses, responses exceeding 10MB, responses in unexpected character encodings — all MUST produce a degraded but valid output (error `ContentBlock` + empty `HarnessAction[]`).
- **NFR-5 (Compatibility):** HPE MUST NOT break any existing `ConversationManager` flow, `StreamParserEngine` parser, or `CapabilityEngine` execution. If HPE is not explicitly engaged by the caller, the system operates exactly as before.
- **NFR-6 (Observability):** Every HPE operation (augment, extract, validate, route, execute) MUST emit events on the `CapabilityEventBus` with full trace context (conversation ID, workflow execution ID, action IDs, timestamps).
- **NFR-7 (Security):** Destructive actions extracted from LLM responses MUST NOT be auto-executed. They require explicit confirmation via the `HumanLoopGate` (SOTA-04) or a caller-specified approval flag.
- **NFR-8 (Extensibility):** New extraction strategies, new `HarnessAction` types, and new action validators MUST be registerable without modifying HPE core code (strategy pattern + registry).

---

## 7. Acceptance Criteria

### US-1: Prompt Augmentation

- [ ] **AC-1.1:** Given a `HarnessContext` with 5 available capabilities and 3 valid selectors, when `PromptAugmenter.augment(prompt, context)` is called, then the returned augmented prompt contains a `HarnessActionSchema` block listing all 5 capabilities with descriptions, all 3 selectors with their strategies, and formatting instructions.
- [ ] **AC-1.2:** Given a `HarnessContext` with an `expectedSchema`, when the prompt is augmented, then the `HarnessActionSchema` block mandates the `expectedSchema` as the primary format with a JSON Schema representation.
- [ ] **AC-1.3:** Given no `HarnessContext` (HPE not engaged), when `PromptAugmenter.augment(prompt, null)` is called, then the original prompt is returned unchanged.

### US-2: Schema-Directed Extraction

- [ ] **AC-2.1:** Given a raw response containing `{"action": "send_message", "selector": "#composer textarea", "input": {"text": "hello"}}` wrapped in ```json fences, when `ResponseExtractor.extract(response, expectedSchema)` is called, then the returned `HarnessAction[]` contains one `capability_action` with correct fields.
- [ ] **AC-2.2:** Given the same JSON but WITHOUT markdown fences (bare JSON in text), when `ResponseExtractor.extract()` is called, then the same action is extracted (via `structure_detect` strategy).
- [ ] **AC-2.3:** Given a response that is purely natural language ("I think you should click the send button"), when `ResponseExtractor.extract()` is called with no `expectedSchema`, then `HarnessAction[]` is empty and `ContentBlock[]` contains a single `text` block.

### US-3: Broken Response Repair

- [ ] **AC-3.1:** Given a truncated JSON response `{"action": "send_message", "selector": "#composer", "input": {"text": "hell` (missing closing braces), when `ResponseExtractor.extract()` is called, then the JSON is repaired to `{"action": "send_message", "selector": "#composer", "input": {"text": "hell"}}` and one `HarnessAction` is returned.
- [ ] **AC-3.2:** Given a response with extra text after valid JSON: `{"action": "click"}\n\nI hope this helps! Let me know if you need anything else.`, when extraction runs, then the trailing text is stripped and the action is extracted.
- [ ] **AC-3.3:** Given a completely unparseable response (binary garbage), when extraction runs, then `HarnessAction[]` is empty and `ContentBlock[]` contains a single `error` block with `code: 'unparseable'`.

### US-4: Multi-Format Extraction

- [ ] **AC-4.1:** Given a response containing: a paragraph of text, a ```json block, and a ```python code block, when extraction runs, then `ContentBlock[]` contains 3 blocks: `text`, `meta` (with parsed JSON data), and `code` (language: python).
- [ ] **AC-4.2:** Given a response with multiple ```json blocks, when extraction runs, then all JSON blocks are extracted and the highest-confidence one (best matching expectedSchema) is used for `HarnessAction[]`.

### US-5: Action Validation & Routing

- [ ] **AC-5.1:** Given an extracted action referencing capability `send_message` for a provider where that capability exists and is active, when `ActionRouter.validateAndRoute(action)` is called, then the action passes validation and is routed to `CapabilityEngine.execute()`.
- [ ] **AC-5.2:** Given an extracted action referencing capability `nonexistent_cap`, when validation runs, then the action is rejected with reason `unknown_capability` and an `ActionRejection` event is emitted.
- [ ] **AC-5.3:** Given an extracted action of type `destructive` (e.g., `delete_account`), when validation runs without an approval flag, then the action is rejected with reason `requires_approval`.

### US-6: Execution Feedback Loop

- [ ] **AC-6.1:** Given that 3 `HarnessAction[]` were executed (2 successes, 1 failure), when `PromptAugmenter.buildFeedback(context, outcomes)` is called, then the returned feedback block contains: the 3 actions with ok/fail status, the failure error message, and the latest page state.
- [ ] **AC-6.2:** Given a subsequent prompt turn, when the `HarnessContext` is built, then the feedback from the previous turn is included as `previous_outcomes`.

### US-7: Provider-Agnostic Operation

- [ ] **AC-7.1:** The same extraction test case (a JSON response wrapped in markdown) produces identical `HarnessAction[]` regardless of which `providerId` is passed — extraction logic does not branch on provider.
- [ ] **AC-7.2:** The `HarnessActionSchema` format injected into prompts is structurally identical across providers — only the capability catalog (which is provider-specific) varies.

### US-8: Human-Readable Trace

- [ ] **AC-8.1:** After a full send→extract→validate→execute cycle, the `hpe_session` row contains the augmented prompt, raw response, extracted actions, validation results, and execution outcomes — all queryable by `conversation_id`.
- [ ] **AC-8.2:** The CLI command `cap-store hpe trace <conversationId>` renders a human-readable trace of the entire cycle.

---

## 8. Out of Scope

| Item | Rationale |
|------|-----------|
| **LLM fine-tuning for harness actions** | HPE uses prompt engineering + fuzzy extraction, not model training. Fine-tuning is a separate initiative. |
| **Natural language → HarnessDAG compilation** | HPE extracts structured actions from structured (if fuzzy) responses. Full NL→DAG compilation (e.g., "go to claude.ai and send a message about cats" → full DAG) is the AgenticLoopEngine's domain. |
| **Multi-turn autonomous planning (agent mode)** | HPE provides the single-turn extract→validate→route→feedback loop. Multi-turn planning across many observations belongs to AgenticLoopEngine (SOTA-03). |
| **Response quality scoring / model selection** | HPE does not decide which provider/model to use or evaluate response quality. That belongs to `ProviderHealthKernel` and router infrastructure. |
| **Visual workflow builder integration** | The WorkflowEngine consumes HPE via `llm_call` and `agent_decide` nodes. Building the visual editor for those nodes is SOTA-04 scope. |
| **Streaming response repair** | HPE operates on the complete captured response (batch mode). Progressive streaming repair (repair partial JSON as it arrives) is deferred to a future SOTA. |
| **MCP tool schema auto-generation** | HPE's `HarnessActionSchema` is an internal format. Mapping it to MCP tool definitions is SOTA-07 (McpServerAdapter) scope. |
| **Multi-language prompt augmentation** | HPE injects harness context in English. Localized schema injection is out of scope for v1. |

---

## Architecture & Integration Detail

### Position in the System

```
                     ┌─────────────────────────────┐
                     │  Consumers                   │
                     │  • ConversationManager       │
                     │  • AgenticLoopEngine         │
                     │  • WorkflowEngine (llm nodes)│
                     │  • ProviderDiscoveryEngine   │
                     └──────────────┬──────────────┘
                                    │ send(prompt, harnessContext, expectedSchema?)
                                    ▼
                     ┌─────────────────────────────┐
                     │  Harness Protocol Engine      │
                     │                              │
                     │  ┌───────────────────────┐   │
                     │  │ PromptAugmenter        │   │
                     │  │                        │   │
                     │  │ buildSchema(context)   │   │
                     │  │   → HarnessActionSchema│   │
                     │  │ augment(prompt, schema)│   │
                     │  │   → augmentedPrompt     │   │
                     │  └───────────┬───────────┘   │
                     │              │               │
                     │              ▼               │
                     │  ┌───────────────────────┐   │
                     │  │ ChromeGovernor         │   │
                     │  │ (actually sends via CDP│   │
                     │  │  captures response)    │   │
                     │  └───────────┬───────────┘   │
                     │              │ rawResponse    │
                     │              ▼               │
                     │  ┌───────────────────────┐   │
                     │  │ ResponseExtractor      │   │
                     │  │                        │   │
                     │  │ extract(raw, schema)   │   │
                     │  │   strategy chain:      │   │
                     │  │   1. schema_guided     │   │
                     │  │   2. json_block        │   │
                     │  │   3. structure_detect  │   │
                     │  │   4. llm_repair        │   │
                     │  │   5. plain_text        │   │
                     │  │                        │   │
                     │  │   → ContentBlock[]     │   │
                     │  │   → HarnessAction[]    │   │
                     │  └───────────┬───────────┘   │
                     │              │               │
                     │              ▼               │
                     │  ┌───────────────────────┐   │
                     │  │ ActionRouter           │   │
                     │  │                        │   │
                     │  │ validate(actions)      │   │
                     │  │   → validated + rejected│   │
                     │  │                        │   │
                     │  │ route(validated):      │   │
                     │  │   capability_action    │   │
                     │  │     → CapabilityEngine │   │
                     │  │   dag_step             │   │
                     │  │     → Governor.cdp     │   │
                     │  │   agentic_goal         │   │
                     │  │     → AgenticLoopEngine│   │
                     │  │   workflow_call        │   │
                     │  │     → WorkflowEngine   │   │
                     │  │                        │   │
                     │  │ collectOutcomes()      │   │
                     │  │   → ExecutionFeedback  │   │
                     │  └───────────┬───────────┘   │
                     │              │               │
                     │              ▼               │
                     │  ┌───────────────────────┐   │
                     │  │ HPE Store              │   │
                     │  │ persistSession()       │   │
                     │  └───────────────────────┘   │
                     └──────────────────────────────┘
```

### Integration with ConversationManager (v1 04 §2)

The 8-step pipeline is extended at two points (no code changes to `ConversationManager` — HPE wraps it):

```
Original pipeline:       With HPE:
                         
RESOLVE                   RESOLVE
DERIVE SLAVE              DERIVE SLAVE
LOCK                      LOCK
ENSURE                    ENSURE
SEND                      [HPE AUGMENT] ← PromptAugmenter injects harness context
CAPTURE                   SEND (augmented prompt)
PARSE                     CAPTURE
STORE + EMIT              [HPE EXTRACT] ← ResponseExtractor processes raw capture
                          PARSE (on extracted ContentBlock[])
                          STORE + EMIT
                          [HPE VALIDATE + ROUTE] ← If HarnessAction[] exist
                          [HPE FEEDBACK] ← Collect outcomes for next turn
```

### HarnessAction Type Definition

```typescript
type HarnessAction =
  | {
      type: 'capability_action';
      capabilitySlug: string;
      providerId: string;
      accountId: string;
      input: Record<string, unknown>;
      confidence: number;          // extraction confidence (0.0-1.0)
      rawSource: string;           // the raw text that produced this action
    }
  | {
      type: 'dag_step';
      step: HarnessNode;           // a single HarnessDAG node
      slaveId: string;
      confidence: number;
      rawSource: string;
    }
  | {
      type: 'agentic_goal';
      goal: AgenticGoal;           // from SOTA-03
      slaveId: string;
      confidence: number;
      rawSource: string;
    }
  | {
      type: 'workflow_call';
      workflowId: string;
      input: Record<string, unknown>;
      confidence: number;
      rawSource: string;
    }
  | {
      type: 'observation_request';
      what: ('dom' | 'network' | 'console' | 'screenshot')[];
      slaveId: string;
      confidence: number;
      rawSource: string;
    }
  | {
      type: 'data_transform';
      expression: string;          // expression to evaluate (see SOTA-04 Expression type)
      outputVariable: string;
      confidence: number;
      rawSource: string;
    };

interface NormalizedResponse {
  // For chat consumers (backward compatible with StreamParserEngine)
  blocks: ContentBlock[];

  // For harness consumers
  actions: HarnessAction[];

  // Metadata
  extraction: {
    strategy: 'schema_guided' | 'json_block' | 'structure_detect' | 'llm_repair' | 'plain_text';
    confidence: number;
    repairs: RepairRecord[];
    durationMs: number;
  };
}

interface RepairRecord {
  type: 'balanced_braces' | 'completed_string' | 'added_comma' | 'stripped_boilerplate' | 'truncated_garbage';
  position: number;                // character position where repair was applied
  original: string;                // the problematic snippet
  repaired: string;                // the fixed snippet
}
```

### HarnessActionSchema Format (Injected into Prompts)

The `PromptAugmenter` appends this block to every prompt:

```
─── HARNESS CONTEXT (do not echo in your response) ───

You are interacting with a browser automation system. You have access to the following capabilities:

AVAILABLE CAPABILITIES:
• send_message — Send a message in the chat composer
  Selector: [aria] role=textbox name="Message"
• select_model — Change the active AI model
  Selector: [css] button[data-testid="model-selector"]
• upload_file — Upload a file to the conversation
  Selector: [css] input[type="file"]

CURRENT PAGE STATE:
• URL: https://claude.ai/chat/abc-123
• Composer: visible, empty
• Model: claude-sonnet-4-20250514
• Messages: 5 in thread

VALID DAG STEP TYPES:
• sequence — run steps in order
• branch — if/then/else routing
• parallel — run steps simultaneously
• retry — retry a step on failure
• step — execute a harness module (moduleIds: composer, selector, navigation, screenshot)

RESPONSE FORMAT:
Respond with a JSON object describing the action(s) to take:
{
  "actions": [
    {
      "type": "capability_action",
      "capabilitySlug": "send_message",
      "input": { "text": "your message here" }
    }
  ]
}

If no action is needed, respond with: { "actions": [] }
Wrap your JSON response in ```json fences.
─── END HARNESS CONTEXT ───
```

### Schema Delta (New Tables)

```sql
CREATE TABLE IF NOT EXISTS hpe_session (
  id TEXT NOT NULL PRIMARY KEY,
  conversation_id TEXT REFERENCES conversation(id) ON DELETE CASCADE,
  workflow_execution_id TEXT REFERENCES workflow_execution(id) ON DELETE CASCADE,
  -- Outbound
  raw_prompt TEXT NOT NULL,
  augmented_prompt TEXT NOT NULL,
  harness_context_json TEXT NOT NULL,
  expected_schema_json TEXT,
  -- Inbound
  raw_response TEXT,
  extracted_blocks_json TEXT,
  extracted_actions_json TEXT,
  extraction_strategy TEXT,
  extraction_confidence REAL,
  extraction_duration_ms INTEGER,
  repairs_applied_json TEXT DEFAULT '[]',
  -- Validation & Routing
  validated_actions_json TEXT,
  rejected_actions_json TEXT,
  -- Execution
  execution_outcomes_json TEXT,
  execution_feedback_json TEXT,
  -- Timing
  augmented_at INTEGER NOT NULL,
  responded_at INTEGER,
  extracted_at INTEGER,
  executed_at INTEGER,
  -- Errors
  error TEXT
);

-- Retention: rows are pruned after CAP_STORE_HPE_RETENTION_DAYS (default 30)
-- unless referenced by an active conversation or workflow execution.
-- The TelemetryAggregator runs a weekly retention cycle to purge old sessions.
-- raw_prompt and augmented_prompt may contain sensitive user data;
-- do not increase retention without privacy review.

CREATE INDEX idx_hpe_conv ON hpe_session(conversation_id, augmented_at DESC);
CREATE INDEX idx_hpe_wf ON hpe_session(workflow_execution_id, augmented_at DESC);

### HPE Config (Reprogrammable via ConfigManager)

HPE stores its configuration in the universal `config_entry` table (v1 `03-merged-schema.md` §L8) via `ConfigManager`, **not** in a separate `hpe_config` table. All 30 engines share the same config persistence, validation, and audit trail.

```typescript
// HPE reads config from ConfigManager at construction time:
// ConfigManager.getConfig('HarnessProtocolEngine', DEFAULT_HPE_CONFIG)

interface HpeConfig {
  // Extraction
  extractionTimeoutMs: number;         // default: 5000
  llmRepairEnabled: boolean;           // default: true
  llmRepairModel: string;              // default: 'claude-haiku'
  maxRepairAttempts: number;           // default: 1

  // Validation
  autoApproveReadOps: boolean;         // default: true
  autoApproveWriteOps: boolean;        // default: false
  requireApprovalDestructive: boolean; // default: true

  // Feedback
  maxFeedbackActions: number;          // default: 10

  // Schema injection
  schemaInjectionEnabled: boolean;     // default: true
  schemaMaxCapabilities: number;       // default: 20
}

const DEFAULT_HPE_CONFIG: HpeConfig = {
  extractionTimeoutMs: 5000,
  llmRepairEnabled: true,
  llmRepairModel: 'claude-haiku',
  maxRepairAttempts: 1,
  autoApproveReadOps: true,
  autoApproveWriteOps: false,
  requireApprovalDestructive: true,
  maxFeedbackActions: 10,
  schemaInjectionEnabled: true,
  schemaMaxCapabilities: 20,
};
```
  schemaInjectionEnabled: boolean;     // default: true
  schemaMaxCapabilities: number;       // default: 20
}
```

---

## Dependencies

| Engine | Direction | Purpose |
|--------|-----------|---------|
| `CapabilityResolutionEngine` (v1 04 §6) | Read | HPE reads resolved capabilities to build the `HarnessActionSchema` |
| `CapabilityEngine` (v1 04 §4) | Write | HPE routes `capability_action` → `CapabilityEngine.execute()` |
| `ChromeGovernor` (v1 04 §1) | Write | HPE routes `dag_step` → `Governor.cdp.executeHarnessPlan()` |
| `StreamParserEngine` (v1 04 §3) | Downstream | HPE pre-processes the raw response; `StreamParserEngine` still runs on the extracted `ContentBlock[]` |
| `ConversationManager` (v1 04 §2) | Wraps | HPE intercepts steps 4→5 (augment) and 6→7 (extract) |
| `AgenticLoopEngine` (SOTA-03) | Consumer | PlanLayer receives augmented prompts and `HarnessAction[]` extraction |
| `WorkflowEngine` (SOTA-04) | Consumer | `llm_call` and `agent_decide` nodes delegate to HPE |
| `MemoryEngine` (SOTA-06) | Consumer | HPE records episodes, facts, and rules from extraction+execution |
| `SemanticGroundingEngine` (SOTA-05) | Read | HPE validates selectors against grounding engine |
| `SelectorHealer` (SOTA-05) | Read | HPE attempts selector healing before rejecting an invalid selector action |
| `CapabilityEventBus` (v1 04 §7) | Publish | HPE emits `hpe:augmented`, `hpe:extracted`, `hpe:action_validated`, `hpe:action_rejected`, `hpe:action_executed`, `hpe:action_failed` |
| `ConfigManager` (v1 05) | Read | HPE config is stored and hot-reloaded via ConfigManager |

---

## See also

- `sota-00-master-index.md` — SOTA master index
- `04-merged-engines.md` — ConversationManager (8-step pipeline), StreamParserEngine, CapabilityEngine, ChromeGovernor, CapabilityEventBus
- `sota-03-agentic-observation-loop.md` — AgenticLoopEngine PlanLayer (primary consumer)
- `sota-04-visual-workflow-engine.md` — WorkflowEngine llm_call/agent_decide nodes (consumer)
- `sota-06-memory-learning-substrate.md` — MemoryEngine (episodic memory consumer)
- `sota-05-semantic-browser-automation.md` — SemanticGroundingEngine, SelectorHealer (validator dependencies)
- `sota-07-schema-streaming-mcp-delta.md` — Schema delta for hpe_session table (config stored via config_entry, not hpe_config)
