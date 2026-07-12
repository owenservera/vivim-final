# Atomic v10 Implementation Tracker

**Total units:** 45 | **Spec docs written:** 45/45 | **Code implemented:** 0/45

> **Plan status:** All 45 unit spec files are written (phases 24-30 complete).
> Every unit below links to its spec. Checkboxes track *code* implementation,
> not doc presence — they remain `[ ]` until the code lands.
>
> **Theme:** CLI = Frontend — one single entry point via natural language.
> The NLCL formats NL text to system-level `{capabilityId, input}` invocations.
> Both the CLI REPL and the frontend chat box call `/api/interpret` → `/api/capabilities/:id/execute`.
>
> **States:** `[ ]` pending · `[~]` in_progress · `[x]` done · `[!]` blocked
>
> **Classification:** C=CREATE · P=PORT · E=EXTEND · F=FIX

---

## Phase 24: SOA Spine — Universal Capability Execution (10 units)

> **Goal:** one registry, one transport. Every operation is a capability;
> CLI and frontend both invoke `POST /api/capabilities/:id/execute`.

- [ ] 24.1 [C] — Universal execute route `POST /api/capabilities/:id/execute` → `docs/atomic-v10/phase-24-soa-spine/24.1-universal-execute-route.md`
- [ ] 24.2 [C] — Introspection route `GET /api/capabilities` (+ `?surface=`) → `.../24.2-introspection-route.md`
- [ ] 24.3 [E] — `exportForUi()` + `ui` block on `UnifiedCapability` → `.../24.3-export-for-ui.md`
- [ ] 24.4 [P] — Fold CLI built-in commands (version/health/fleet/providers/config/conversations/admin/telemetry) into capabilities → `.../24.4-fold-cli-builtins.md`
- [ ] 24.5 [P] — Fold kernel/oracle commands into capabilities → `.../24.5-fold-kernel-caps.md`
- [ ] 24.6 [P] — Fold discovery commands into capabilities → `.../24.6-fold-discovery-caps.md`
- [ ] 24.7 [C] — `nl_interpret` meta-capability (NLCL is itself a capability) → `.../24.7-nl-interpret-capability.md`
- [ ] 24.8 [F] — CLI auto-generates from registry; delete hand-written command files + bridges → `.../24.8-cli-autogenerate.md`
- [ ] 24.9 [C] — Frontend `ActionRegistry` auto-population from `/api/capabilities?surface=ui` → `.../24.9-frontend-autopopulate.md`
- [ ] 24.10 [C] — Parity test harness skeleton → `.../24.10-parity-harness.md`

## Phase 25: NLCL Universal Resolver — NL → Capability (9 units)

> **Goal:** the NLP formatting layer. NL text in, `{capabilityId, input, ctx}` out.
> Three tiers: deterministic → LLM-via-slave → composite. Context-bound.

- [ ] 25.1 [E] — `capabilityId` field on `CommandResult`; bind every catalog pattern to a capability id → `.../phase-25-nlcl-universal-resolver/25.1-capability-id-binding.md`
- [ ] 25.2 [C] — Context binder (`conversationId`/`providerId`/`canvasState`/`activeSessionId` → resolver ctx; pronoun resolution) → `.../25.2-context-binder.md`
- [ ] 25.3 [C] — LLM-slave resolver (the logged-in provider LLM parses novel sentences against the capability catalog) → `.../25.3-llm-slave-resolver.md`
- [ ] 25.4 [E] — Composite/pipeline → multi-capability DAG execution (`executeComposite` already exists; wire to registry) → `.../25.4-composite-dag.md`
- [ ] 25.5 [C] — Parameter extraction (NL → typed `input` matching capability `inputSchema`) → `.../25.5-parameter-extraction.md`
- [ ] 25.6 [C] — Confirmation + clarification flow for ambiguous/irreversible intents → `.../25.6-confirmation-flow.md`
- [ ] 25.7 [C] — `POST /api/interpret` universal NL endpoint → `.../25.7-interpret-route.md`
- [ ] 25.8 [C] — CLI REPL mode (`vivim` with no args → interactive NL loop, streaming output) → `.../25.8-cli-repl.md`
- [ ] 25.9 [C] — Frontend chat box NL routing (composer detects command vs message → `/api/interpret`) → `.../25.9-frontend-nl-routing.md`

## Phase 26: Canvas Natural-Language Mutation (5 units) — Scenario 1a

- [ ] 26.1 [E] — Canvas mutation capability catalog (`canvas_set_background`, `add_layer`, `remove_layer`, `set_layout`, `set_theme`) → `.../phase-26-canvas-nl-mutation/26.1-canvas-mutation-caps.md`
- [ ] 26.2 [C] — Image generation bridge (`image_generate { query }` → base64; local model or provider) → `.../26.2-image-gen-bridge.md`
- [ ] 26.3 [C] — NLCL canvas patterns ("change background to...", "add a layer showing...") → `.../26.3-nlcl-canvas-patterns.md`
- [ ] 26.4 [E] — Canvas live mutation stream over WS (mutation → frontend re-render) → `.../26.4-canvas-live-stream.md`
- [ ] 26.5 [C] — Canvas undo/rollback capability (`canvas_undo`, `canvas_history`) → `.../26.5-canvas-undo.md`

## Phase 27: Streaming Channel Registration (6 units) — Scenario 1b

- [ ] 27.1 [C] — Streaming channel capability catalog (`channel_add`, `channel_remove`, `channel_list`, `channel_connect`) → `.../phase-27-streaming-channels/27.1-channel-caps.md`
- [ ] 27.2 [C] — Messaging provider archetypes (whatsapp/facebook/telegram/slack/dispatch) → `.../27.2-messaging-archetypes.md`
- [ ] 27.3 [C] — Provider manifest seeds for messaging providers → `.../27.3-messaging-seeds.md`
- [ ] 27.4 [C] — NLCL channel patterns ("add my whatsapp", "connect facebook feed") → `.../27.4-nlcl-channel-patterns.md`
- [ ] 27.5 [P] — Channel connect auth flow as capability (login wizard → `channel_connect`) → `.../27.5-channel-connect-auth.md`
- [ ] 27.6 [E] — Multi-channel stream mux (subscribe many channels → one conversation) → `.../27.6-multi-channel-mux.md`

## Phase 28: Workflow Automation (6 units) — Scenario 1c

- [ ] 28.1 [P] — Workflow-as-capability (compiled workflow registered as a callable capability) → `.../phase-28-workflow-automation/28.1-workflow-as-capability.md`
- [ ] 28.2 [C] — Newsletter workflow template (distill → compose → send) → `.../28.2-newsletter-template.md`
- [ ] 28.3 [P] — Schedule-as-capability (`schedule_register { cron }` → AutomationScheduler) → `.../28.3-schedule-capability.md`
- [ ] 28.4 [P] — Knowledge distillation capability (`knowledge_distill { window }` → cross-conversation synthesis) → `.../28.4-knowledge-distill.md`
- [ ] 28.5 [C] — Send capability (`email_send`, `message_send` via SMTP/provider) → `.../28.5-send-capability.md`
- [ ] 28.6 [C] — NLCL workflow patterns ("create a weekly newsletter", "automate...", "every monday send...") → `.../28.6-nlcl-workflow-patterns.md`

## Phase 29: Interactive Sessions (5 units) — Scenario 2

- [ ] 29.1 [P] — Session lifecycle capabilities (`session_load`, `session_start`, `session_switch`, `session_resume`) → `.../phase-29-interactive-sessions/29.1-session-caps.md`
- [ ] 29.2 [C] — CLI REPL interactive session loop (stdin NL → streaming stdout; `vivim` with no args) → `.../29.2-cli-interactive-repl.md`
- [ ] 29.3 [C] — Frontend session bootstrapping from NL ("load chatgpt" → spawn + attach composer) → `.../29.3-frontend-session-bootstrap.md`
- [ ] 29.4 [C] — Session context persistence (resume interactive sessions across CLI invocations) → `.../29.4-session-persistence.md`
- [ ] 29.5 [E] — Provider login-state detection capability (`session_verify_login`) → `.../29.5-login-state-detection.md`

## Phase 30: Parity Lock + Release (4 units)

- [ ] 30.1 [C] — CLI ↔ Frontend parity test suite (every `surfaces ∋ {cli,ui}` capability tested both ways) → `.../phase-30-parity-lock/30.1-parity-test-suite.md`
- [ ] 30.2 [C] — NLCL golden test set (the scenario sentences resolve to correct capability chains) → `.../30.2-nlcl-golden-tests.md`
- [ ] 30.3 [C] — Architecture docs update ("one entry point" guide in AGENTS.md) → `.../30.3-docs-update.md`
- [ ] 30.4 [F] — Cleanup: delete dead bridges (`cli/bridges/*`), orphan command files, hand-written `catalog.ts` → `.../30.4-cleanup-dead-code.md`
