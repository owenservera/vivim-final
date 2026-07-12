# Atomic v10 — SOA Architecture: CLI = Frontend

> **The one rule:** An operation exists in exactly one place — a
> `UnifiedCapability` row. CLI and frontend are thin shells that resolve
> natural-language input → `capabilityId` → invoke the same endpoint.
> No hand-written per-surface handlers. No second registry. No HTTP-bridge
> duplication.

---

## 1. The Spine

```
┌──────────────────────────────────────────────────────────────────┐
│                        ENTRY SURFACES                             │
│                                                                   │
│   Frontend Chat Box      CLI REPL         POST /api/interpret     │
│   (logged-in provider)   (interactive)    (programmatic / MCP)    │
│        │                      │                    │              │
│        └──────────┬───────────┴────────────────────┘              │
│                   │ natural language text (+ context)             │
└───────────────────┼──────────────────────────────────────────────┘
                    ▼
┌──────────────────────────────────────────────────────────────────┐
│              NLCL Universal Resolver  (Phase 25)                  │
│                                                                   │
│   text ─► deterministic patterns ─┐                              │
│         └► LLM fallback (via the logged-in slave) ─┤             │
│         └► composite/pipeline detect ──────────────┤             │
│                                                    ▼             │
│         { capabilityId, validatedInput, ctx, confirmation? }     │
└───────────────────┬──────────────────────────────────────────────┘
                    │  (or direct: { capabilityId, params } )
                    ▼
┌──────────────────────────────────────────────────────────────────┐
│     POST /api/capabilities/:id/execute   (universal, Phase 24)    │
│     GET  /api/capabilities               (introspection)          │
└───────────────────┬──────────────────────────────────────────────┘
                    ▼
┌──────────────────────────────────────────────────────────────────┐
│         UnifiedCapabilityRegistry  (single source of truth)       │
│   every op = { id, slug, surfaces[], inputSchema, handler,        │
│                cliCommand, uiAction, apiEndpoint, mcpToolName }   │
└───────┬───────────┬───────────┬───────────┬───────────┬──────────┘
        ▼           ▼           ▼           ▼           ▼
   Canvas       Provider/    Workflow    Fleet/       Memory/
   Engine       Streaming    Engine      Session      Knowledge
   (P26)        (P27)        (P28)       (P29)        (existing)
```

---

## 2. Why this satisfies "CLI = Frontend"

| Concern | Before v10 | After v10 |
|---------|-----------|-----------|
| Operation registry | 3 divergent (`CommandRegistry`, `ActionRegistry`, `UnifiedCapabilityRegistry`) | **1** (`UnifiedCapabilityRegistry`) |
| CLI command source | hand-written files + HTTP bridge + orphan modules | auto-generated from registry via `syncCliFromUnified` |
| Frontend action source | hand-written `catalog.ts` | auto-populated from `GET /api/capabilities?surface=ui` |
| Execution transport | HTTP (some) / in-process (some) / broken paths | **1**: `POST /api/capabilities/:id/execute` |
| Input into the system | argv (CLI) / clicks (UI) — different shapes | **NL text** (both) → NLCL → `{capabilityId, input}` |
| The "command" the system sees | different per surface | **identical** `{capabilityId, input, ctx}` regardless of surface |

---

## 3. The NLP formatting layer (the heart of the user's requirement)

> *"the cli and the frontend command / chat box should talk to the system
> using natural language and the system's nlp should format to system-level
> commands"*

`NLCL.interpret(rawText, ctx)` is the formatter. It produces a
`CommandResult` whose `capabilityId` + `validatedInput` IS the system-level
command. Three resolver tiers (Phase 25):

1. **Deterministic patterns** (`catalog.ts`) — fast path. "list providers"
   → `provider_list`. Each pattern carries a `capabilityId` binding.
2. **LLM fallback via the logged-in slave** (25.3) — the AI provider the
   user is chatting with becomes the NLP engine. The frontend chat box is
   already talking to a Chrome slave; NLCL reuses that slave's provider LLM
   to parse novel sentences like *"change my canvas background to an image
   of the moon made out of cheese"* → `canvas_set_background` with
   `{ imageQuery: "moon made out of cheese" }`.
3. **Composite/pipeline** (`detectComposite`) — *"go to cnn and summarize
   the news"* → `[browser_navigate, content_summarize]` DAG.

Context binding (25.2): the resolver receives `{ conversationId, providerId,
canvasState, activeSessionId }` so pronouns ("it", "the canvas", "my
account") resolve against live state.

---

## 4. Scenario Traceability

Each user sentence maps to a capability chain realized by specific units.

### Scenario 1a — *"change my canvas background to an image of the moon made out of cheese"*
| Step | Engine | Capability | Unit |
|------|--------|-----------|------|
| 1 | NLCL | parse → `canvas_set_background` + `{imageQuery}` | 25.1, 26.3 |
| 2 | (LLM) | fallback resolver via logged-in slave | 25.3 |
| 3 | Image bridge | `image_generate { query }` → moon-cheese image | 26.2 |
| 4 | Canvas | `canvas_set_background { imageBase64 }` | 26.1 |
| 5 | WS | mutation streams back to live canvas | 26.4 |
| 6 | (undo) | `canvas_undo` if user dislikes it | 26.5 |

### Scenario 1b — *"add new streaming channels like my facebook messaging feed, my whatsapp"*
| Step | Engine | Capability | Unit |
|------|--------|-----------|------|
| 1 | NLCL | parse → composite `[channel_add, channel_add]` | 27.4 |
| 2 | Provider seeds | whatsapp/facebook archetypes registered | 27.2, 27.3 |
| 3 | Auth | `channel_connect { providerId }` → login wizard | 27.5 |
| 4 | Mux | `stream_mux_subscribe` ingests into conversation | 27.6 |

### Scenario 1c — *"create an automated weekly newsletter that distills the week's work and sends to the team"*
| Step | Engine | Capability | Unit |
|------|--------|-----------|------|
| 1 | NLCL | parse → `workflow_create` from template | 28.6 |
| 2 | Workflow | newsletter template (distill→compose→send) | 28.2 |
| 3 | Distill | `knowledge_distill { window: 7d }` | 28.4 |
| 4 | Send | `email_send { recipients }` | 28.5 |
| 5 | Schedule | `schedule_register { cron: "0 9 * * 1" }` | 28.3 |
| 6 | Register | compiled workflow becomes a callable capability | 28.1 |

### Scenario 2 — *"load my chatgpt.com and start an interactive session"* (CLI)
| Step | Engine | Capability | Unit |
|------|--------|-----------|------|
| 1 | CLI REPL | stdin NL loop | 29.2 |
| 2 | NLCL | parse → `session_load { providerId: "chatgpt" }` | 29.1, 25.7 |
| 3 | Fleet | spawn slave, ensure login | 29.1, 29.5 |
| 4 | Session | interactive conversation attached to REPL | 29.3 |
| 5 | Persist | session resumable next REPL invocation | 29.4 |

---

## 5. Invariants v10 enforces

1. **One registry.** No operation is defined outside `UnifiedCapabilityRegistry`. Verified by Phase 30 parity tests.
2. **One transport.** Every invocation crosses `POST /api/capabilities/:id/execute` (or the NL wrapper `/api/interpret`). No in-process-only commands.
3. **One resolver.** NLCL is the only NL→capability path. Both shells call it.
4. **Symmetric surfaces.** A capability marked `surfaces: ['cli','ui']` MUST be reachable from both. The parity test (30.1) invokes each via CLI argv AND via HTTP and asserts identical structured output.
5. **Context flows.** The resolver context (`conversationId`, `providerId`, `canvasState`, `activeSessionId`) is populated identically regardless of whether the request came from CLI or frontend.

---

## 6. Files touched (summary)

**Spine (P24):** `engines/unified-registry.ts`, `engines/capability-bootstrap.ts`, new `server/capability-router.ts`, `server/index.ts`, `cli/index.ts`, delete `cli/bridges/*`, delete hand-written `cli/commands/*` (folded).

**Resolver (P25):** `engines/nlcl/nlcl-engine.ts`, `engines/nlcl/types.ts`, `engines/nlcl/catalog.ts`, new `engines/nlcl/context-binder.ts`, new `engines/nlcl/llm-slave-resolver.ts`, new `server/interpret-router.ts`, new `cli/repl.ts`.

**Canvas (P26):** `canvas/canvas-agent-tools.ts`, new `canvas/mutation-caps.ts`, new `engines/image-gen-bridge.ts`, `engines/nlcl/catalog.ts` (canvas patterns).

**Channels (P27):** new `seeds/providers/whatsapp.json`, `facebook.json`, `telegram.json`, `slack.json`; new `engines/streaming-channel-caps.ts`; `engines/provider-mux.ts` (channel subscribe).

**Workflow (P28):** `engines/workflow-engine.ts` (cap exposure), new `engines/workflow-templates/newsletter.ts`, `automation/scheduler.ts` (cap exposure), `engines/cross-conversation-synthesis.ts` (distill cap).

**Sessions (P29):** new `engines/session-caps.ts`, new `cli/repl.ts`, `web/sandbox/src/features/conversation-surface.tsx` (NL routing).

**Parity (P30):** new `tests/e2e/cli-frontend-parity.test.ts`, new `tests/e2e/nlcl-golden.test.ts`, update `AGENTS.md`.
