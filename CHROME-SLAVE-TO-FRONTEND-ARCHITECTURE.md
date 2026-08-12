# VIVIM Data-Flow Architecture: Chrome Slave Provider WebApp → VIVIM Frontend

> **Scope:** This document fully exposes and documents the *current* (as-built) design,
> data model, and control/data flow from a provider's web app running inside a
> **Chrome slave** (driven by the ChromeGovernor) all the way to the **VIVIM frontend**
> renderer — and every engine, transport, store, and event in between.
>
> All claims are cited to source files and line numbers. Where the *live* path and the
> *streaming-protocol* path diverge (they do), both are documented explicitly.
>
> Generated: 2026-08-12. Repo: `vivim-final`. Runtime: Bun + Prisma + Next.js 16 frontend.

---

## 0. Executive Summary

VIVIM talks to LLM providers (ChatGPT, Claude, Gemini, DeepSeek, Qwen, Grok, …) by
**piloting the provider's real web UI inside a dedicated Chrome instance** (a "slave"),
rather than calling an API. A message is:

1. typed into the provider's composer via CDP,
2. the provider streams its answer *in the browser*,
3. VIVIM intercepts the provider's network response (CDP `Network.getResponseBody`),
4. a **DB-driven sandboxed parser** converts the raw wire body into a canonical
   `ContentPart[]`,
5. the result is stored (message row + per-block rows + graph Nodes),
6. an event is emitted and forwarded over **WebSocket** to the frontend,
7. the frontend re-fetches history (`GET /messages`) and renders blocks.

The **uniform data contract** between engines is `ContentPart` (`src/schema/streaming.ts`),
a discriminated union of 11 part types. The **weak seam** (see §9) is the frontend, which
receives and renders a *legacy* `{kind, content, index}` shape, not the canonical
`ContentPart`, and currently drops most structured fields during the live path.

---

## 1. End-to-End Pipeline

```mermaid
flowchart TD
  subgraph BROWSER["Chrome Slave (provider web app)"]
    PW[Provider WebApp<br/>chatgpt.com / claude.ai / gemini.google.com]
    COMP[Composer DOM:<br/>textarea / contenteditable / quill]
    NET[Streaming API response<br/>SSE / batchexecute / json_stream]
  end

  subgraph GOV["ChromeGovernor layer"]
    FG[FleetSupervisor + ProfileAllocator<br/>spawn / ensureRunningForAccount]
    CDPX[CDPProxy<br/>mutex + circuit breaker + watchdog]
    XPORT[CDPTransport<br/>WebSocket↔Chrome DevTools]
  end

  subgraph CM["ConversationManager.send()"]
    STEP1[1. context injection]
    STEP2[2. resolve slave + verify page]
    STEP5[5. build HarnessDAG + selector]
    STEP55[5.5 Network.enable + capturePattern]
    STEP6[6. capture raw body]
    STEP7[7. StreamParserEngine.parse]
    STEP8[8. store + emit]
  end

  subgraph PARSE["StreamParserEngine"]
    PM[ParserModule.parse(rawBody)<br/>→ ContentPart + fallback chain]
    SANDB[Inline parser runs in<br/>SandboxRunner (QuickJS/VM)]
  end

  subgraph STORE["Storage fan-out"]
    MSG[(Message row<br/>blocksJson)]
    BLK[StreamBlockStore<br/>+ blockMeta]
    CU[ContentUnit decompose]
    NODE[(Node graph<br/>captureAsNode)]
  end

  subgraph EVT["EventBus + WS"]
    EB[CapabilityEventBus<br/>conversation:complete / :error / :block]
    WS[websocket.ts<br/>registerConversationForwarder]
  end

  subgraph FE["VIVIM Frontend (Next.js)"]
    HOOK[useWebSocket hook<br/>auto-reconnect + subscribe]
    COMP2[Composer.tsx<br/>RAF batch + loadHistory]
    MB[MessageBlock / RenderBlocks<br/>legacy {kind,content,index}]
    SLOTS[chat.* UI slots]
  end

  PW --> COMP
  COMP -->|type_text + submit| CDPX
  CDPX --> XPORT --> COMP
  NET -->|response interception| XPORT --> CDPX
  CDPX -->|capture(body)| STEP6
  STEP1 --> STEP2 --> STEP5 --> STEP55 --> STEP6 --> STEP7 --> STEP8
  STEP7 --> PM --> SANDB
  STEP8 --> MSG & BLK & CU & NODE
  STEP8 --> EB --> WS --> HOOK --> COMP2 --> MB --> SLOTS
  COMP2 -->|GET /messages| MSG
```

---

## 2. Layer 0 — The Chrome Slave (Provider WebApp)

A **Chrome slave** is a logged-in Chrome instance whose profile is stored under
`chrome-profiles/<providerSlug>/<accountId>` (canonical layout, AGENTS.md). It is the
*only* thing that talks to the provider; VIVIM never uses the provider's REST API
directly for live chat.

- The provider web app renders an ordinary chat UI: a composer (textarea /
  `contenteditable` / Quill / CodeMirror) and a streaming answer region.
- VIVIM injects text and clicks "send" by **CDP DOM automation**, then **intercepts the
  provider's streaming network response** to read the model output — it does not scrape
  the DOM for the answer (more reliable than DOM scraping against shifting UI).
- Per-provider specifics live in:
  - `PROVIDER_URLS` / `PROVIDER_URL_PATTERNS` (URL + regex guard) — `conversation-manager.ts`
  - `CAPTURE_PATTERNS` (which network request to intercept) — `conversation-manager.ts:499`
  - `COMPOSER_SELECTORS` + `composerTypeForProvider()` — `conversation-manager.ts:472-483`
  - seeded CDP selectors — `src/engines/provider-selectors.ts`, `seeds/providers/manifests.ts`

---

## 3. Layer 1 — ChromeGovernor (slave lifecycle)

**File:** `src/engines/chrome-governor.ts` (class `ChromeGovernor`, line 124).

Responsibilities:
- **Spawn / launch** a slave: `spawn(providerId, accountId, opts)` (line 202) →
  delegates to `FleetSupervisor.spawn`. `launch(providerId)` is a convenience wrapper
  using account `'default'` (line 212).
- **Find-or-spawn** for an account: `ensureRunningForAccount(providerId, accountId)`
  (called at `conversation-manager.ts:434`). This is the entry the chat path uses; it
  reuses an existing slave or spawns one, respecting `ProfileAllocator` singleton rules
  (one profile per provider+account — AGENTS invariants #6/#7).
- **Relogin path** (FR-9/10): kill + relaunch visible (line 272).
- **Capability execution:** `cap:cdp:*` capabilities are resolved to a live slave and
  fired (`Runtime.evaluate`, etc.) — `chrome-governor.ts:487-588`.

`ChromeSlave` is the handle returned by these methods (`slaveId` is the stable key used
everywhere downstream).

---

## 4. Layer 2 — CDPProxy + CDPTransport (the only I/O path)

**Invariant (AGENTS):** *Only `ChromeGovernor` touches CDP. No engine imports
`BunCdpClient` directly.* The governor delegates CDP I/O to the **CDPProxy**, which is the
single mediated command path.

**File:** `src/engines/chrome/cdp-proxy.ts` (class `CDPProxy`, line 32).

Every CDP command funnels through one of three methods, each guarded by a **per-slave
`AsyncMutex`** (CDP is not concurrent-safe) and a **circuit breaker**:

| Method | Lines | Purpose |
|---|---|---|
| `send(slaveId, method, params)` | 57-76 | generic CDP command (e.g. `Page.navigate`, `Network.enable`) |
| `capture(slaveId, pattern, timeoutMs)` | 78-90 | **intercept a network response body** (see §5) |
| `executeHarnessPlan(slaveId, dag)` | 92+ | run a `HarnessDAG` (type text → submit) |

`capture()` is a thin lock + delegation to the transport:

```ts
// src/engines/chrome/cdp-proxy.ts:78
async capture(slaveId, pattern, timeoutMs?) {
  await this.ensureConnected(slaveId)
  const mutex = this.getMutex(slaveId); await mutex.acquire()
  try {
    const result = await this.transport?.capture(slaveId, pattern, timeoutMs)
    if (!result) throw new EngineError('CDP transport not configured')
    return result
  } finally { mutex.release() }
}
```

**Transport:** `src/executor/cdp-transport.ts` (`CDPTransport`). Its `capture()`
(`cdp-transport.ts:121`) does the actual interception:
1. `Network.enable`
2. listen for `Network.responseReceived` — match the request URL against the
   provider `capturePattern` regex; collect `requestId`s
3. on `Network.loadingFinished` for a matched request → `Network.getResponseBody`
4. resolve `{ body, url, headers, status, durationMs, capturedAt }` (`CaptureResult`)

So the **raw wire body** (SSE text, batchexecute envelope, JSON stream, …) is captured
verbatim and handed up — *unparsed*. This is the boundary where "many data formats"
enter the system.

---

## 5. Layer 3 — ConversationManager.send() (the orchestrator)

**File:** `src/engines/conversation-manager.ts`. This is the heart of the live path.
The `send(conversationId, message)` method executes a numbered step sequence. Documented
steps (verified against source):

| Step | What happens | Source |
|---|---|---|
| [1] | Inject conversation context (provider/account/capability/memory/identity) | `:451-458` |
| [2] | `governor.ensureRunningForAccount(providerId, account.id)` → `slaveId` | `:432-436` |
| [2.5] | Verify page state; if wrong URL, `Page.navigate` to `providerUrl` | `:438-449` |
| [3] | Acquire CDP mutex (inside `ensureRunning`) | `:460` |
| [5] | Build `HarnessDAG` (nodes: `type_text`, `submit`) + resolve working composer selector + `composerType` | `:462-495` |
| [5.5] | `Network.enable`; pick `capturePattern = CAPTURE_PATTERNS[provider] ?? /\/api\/conversation\//` | `:497-504` |
| [6] | `governor.cdp.executeHarnessPlan(slaveId, dag)` (types + submits in the browser) | `:506` |
| [7] | `governor.cdp.capture(slaveId, capturePattern, 60_000)` → raw `body` | `:544-546` |
| [8] | `parser.parse(body, providerId)` → `ParseResult` | `:550-554` |
| [9] | Store (user msg, assistant msg, blocks, units, nodes) + emit events + remember | `:560-655` |

> **Note on timing:** `Network.enable` is issued *before* submit ([5.5]) so the
> streaming request is not missed during capture ([6]).

### Two distinct emission paths (important)

The live chat path (`ConversationManager.send`) emits:

```ts
this.eventBus.emit({ type: 'conversation:complete', conversationId, message: msgRow })
// conversation-manager.ts:620  — NOTE: no `blocks` field
```

and on failure:

```ts
this.eventBus.emit({ type: 'conversation:error', conversationId, error })
// conversation-manager.ts:659
```

It does **NOT** emit `conversation:block`. The `conversation:block` (per-chunk) event is
produced only by the **StreamingProtocol** (`src/engines/streaming-protocol.ts:101-107`,
`:154-160`) used by other flows (harness executor, incremental processing). Consequences
for the frontend are covered in §8.

---

## 6. Layer 4 — StreamParserEngine (wire format → canonical ContentPart)

**File:** `src/engines/stream-parser.ts`. **This is the uniform ingestion chokepoint.**

### 6.1 The parser contract

```ts
// src/engines/stream-parser.ts:24
export interface ParserModule {
  name: string
  version: number
  providerId: string
  parse(rawBody: string): ContentBlock[]      // ← canonical ContentPart[]
  detectCompletion(rawBody: string): boolean
  getConfidence(rawBody: string): number
}
export type ContentBlock = ContentPart      // alias (line 22)
```

`parse()` returns `ContentPart[]` — the canonical model (§7). This is the moment a raw
provider wire format becomes a uniform, typed structure.

### 6.2 Result envelope

```ts
// src/engines/stream-parser.ts:54
interface ParseResult {
  blocks: ContentBlock[]          // ContentPart[]
  confidence: number
  parserName: string
  parserVersion: number
  durationMs: number
  blockDiagnostics: BlockDiagnostics   // counts per type (text/tool/file/error/...)
  wireFormat: WireFormat        // 'sse'|'ndjson'|'json-array'|'batchexecute'|'xssi'|'plain-text'|'unknown'
  fallbackDepth: number
  rawSizeBytes: number
}
```

### 6.3 Fallback chain (uniformity guarantee)

Parser logic is **loaded from the DB** (engine is executor, not repository — AGENTS
invariant #5). Resolution order is `provider/001 → generic/001 → system/001` with
confidence-based promotion (`getConfidence` ≥ `confidenceMinThreshold`). Parsers run
**inside a sandbox** (`SandboxRunner`, QuickJS/VM) — the `logic_code` is a DB row, never
a file. See `ParserStore`, `ParserExecutionLogStore` contracts.

### 6.4 Unknown-format safety net

If confidence < 0.7, `FormatClassifier` (`src/engines/format-classifier.ts`) asks an LLM
to classify the transport and even **generate** a parser `logic_code` matching this same
contract — so novel formats stay inside the identical pipeline.

---

## 7. The Canonical Data Model — `ContentPart`

**File:** `src/schema/streaming.ts`. This is the single type the whole backend agrees on
for *rendered content*.

```ts
// src/schema/streaming.ts:90
export type ContentPart =
  | TextPart        | ReasoningPart   | CodePart     | FilePart
  | ToolCallPart    | ToolResultPart  | SourcePart   | CustomPart
  | ErrorPart       | MetaPart        | StepStartPart
```

Key fields (abridged):

| Type | Notable fields |
|---|---|
| `text` | `text: RichText` (`string ❘ { ast: unknown[] }`), `state: 'streaming'❘'done'`, `lang?` |
| `reasoning` | `text: RichText`, `signature?`, `state?` |
| `code` | `text: string`, `language?` |
| `file` | `mediaType: string`, `url: string`, `filename?`, `data?` |
| `tool-call` | `toolCallId`, `toolName`, `input: Record<string,unknown>`, `state?`, `approvalId?` |
| `tool-result` | `toolCallId`, `output?`, `isError?` |
| `source` | `sourceId`, `url?`, `title?`, `mediaType?` |
| `custom` | `kind: string`, `data: unknown`, `state?` |
| `error` | `message`, `code?` |
| `meta` | `key`, `value` |
| `step-start` | (marker) |

There is a `ContentPartSchema` (`z.discriminatedUnion('type', …)` at `:186`) and helpers
`extractText`, `blockKindOf`, `isStreaming`. Legacy `{kind, content, index}` blocks are
migrated at the boundary by `migrateLegacyBlock` / `migrateLegacyParts` (`:250-296`).

`ContentBlock = ContentPart` is exported for backwards compatibility (`:104`).

> **This is the model a "uniform rendering approach" should target.** See §9 for why the
> frontend currently does not use it.

---

## 8. Layer 5 → Layer 7 — Storage, Events, WebSocket, Frontend

### 8.1 Storage fan-out (step [9], `conversation-manager.ts:560-616`)

All fired from the parsed `ContentPart[]`:

1. **User message row** — `store.createMessage({ role:'user', content: message,
   blocksJson: JSON.stringify([{type:'text',text:message}]) })` (`:564`).
2. **Assistant message row** — `store.createMessage({ role:'assistant',
   content: extractText(blocks), blocksJson: JSON.stringify(blocks),
   blockCount })` (`:573-580`).
3. **Per-block store** — `blocks.storeBlocks(convId, msgId, blocks, blockMeta)` where
   `blockMeta = { parserName, parserVersion, confidence, wireFormat }` (`:583-589`).
4. **ContentUnit decompose** — `decomposeToContentUnits(blocks, convId, msgId)` →
   `contentUnitStore.storeUnits(...)` (`:592-596`; mapper in
   `src/engines/content-unit-decomposer.ts`).
5. **Graph Nodes** — `captureAsNode(...)` for user then assistant, linked as a fork
   (`responds_to` edge) (`:600-611`).

### 8.2 EventBus → WebSocket forwarder

**File:** `src/server/websocket.ts`.

- `registerConversationForwarder(eventBus)` (`:80`) subscribes to
  `conversation:complete`, `conversation:block`, `conversation:error` and forwards each
  to every WS session subscribed to topic `conversation:<conversationId>` (`:84-94`).
- Frontend subscription model: `subscribe { type:'subscribe', topic:'conversation:<id>' }`
  (handled `:256-301`). `hello`/`hello:ack` handshake establishes the session
  (`:167-183`). Auto-reconnect re-subscribes (`:68-72`).
- Other forwarders exist for `config:changed`, `kernel:oracle`, `canvas:mutated`,
  `canvas:node` (`:40-148`), plus agent↔frontend command routing and a `dev:` firehose.

### 8.3 Frontend receive + render

**Hook:** `frontend/src/hooks/useWebSocket.ts` — connects to `ws://localhost:9420/ws`,
auto-reconnect with exponential backoff, normalizes the event envelope (`:74-94`), exposes
`subscribe(topic)` which the chat surface calls with `conversation:<id>`.

**Composer** (`frontend/src/components/chat/Composer.tsx`):
- On `conversation:complete` → `loadHistory(conversationId)` → `GET
  /api/conversations/<id>/messages` (`:117-125`, `:162-171`). **The rendered blocks
  come from the stored message, not from the WS payload.**
- On `conversation:block` (only present on the StreamingProtocol path) → RAF-batched
  push into `streamingBlocks` (`:95-115`, `:143-160`). **Critical seam:** it reads only
  `payload.block?.text ?? payload.block?.content` (`:152`) — i.e. the legacy
  `{kind, content}` shape — and discards every other `ContentPart` field.
- The flush maps each chunk to `{ kind: b.kind, content: b.text, index }` (`:102-107`),
  the **legacy block shape**, not `ContentPart`.

**Renderer:** `frontend/src/components/chat/MessageBlock.tsx`
- Defines its *own* local `ContentBlock = { kind: string; content: string; index:
  number }` (`:10-15`) — a **different type** from the backend `ContentBlock`.
- `MessageBlock` is a hardcoded `switch (kind)` over `code | thinking | error | tool-call
  | tool-result | file | meta | step-start | default` (`:20-165`). All branches render
  `block.content` as a string; rich fields (`language`, `url`, `mediaType`, `toolName`,
  `input`, `data`) are only reachable via ad-hoc `(block as Record).x` casts.
- `RenderBlocks` merges adjacent text blocks then maps to `MessageBlock` (`:168-186`).
- Wired into UI slots via `frontend/src/ui/defaults/index.tsx` (`DefaultChatThread`,
  `DefaultChatBubble` → `RenderBlocks`/`MessageBlock`).

---

## 9. Cross-Cutting Concerns & Known Gaps (carried from the audit)

These are the current weaknesses most relevant to "rendering many formats uniformly":

1. **Frontend uses a legacy, non-canonical model.** `MessageBlock.ContentBlock`
   (`{kind, content, index}`) ≠ backend `ContentPart` (type union). Same name, two
   meanings. There is **no renderer registry** — adding a format means editing a
   `switch`.
2. **Field loss at the streaming seam.** `Composer.tsx:152` keeps only
   `block.text ?? block.content`; `language`, `mediaType`, `url`, `data`, `input`,
   `signature`, `state` are dropped in the live path.
3. **`RichText` AST branch unimplemented.** `ContentPart.text` may be `{ast}` but the
   frontend only ever renders a string.
4. **Divergent type vocabularies.** Backend `ContentPart.type` (11), frontend
   `kind` (loose), import `source` (chatgpt/claude/gemini/generic), node `contentType`
   (`cap-store.*`), canvas `node.type` — no single shared ontology.
5. **No progressive streaming in the live chat path.** `ConversationManager.send` emits
   `conversation:complete` *without* `blocks`; the frontend reloads history to get the
   blocks. `conversation:block` (per-token) exists only on the StreamingProtocol path.
6. **Imports bypass `ContentPart`.** `chatgpt-import.ts` etc. produce
   `ParsedMessage { role, content: string }` and store via `ContentItemEngine`
   (`contentType` + `bodyRichJson`) — a second ingestion model, not decomposed into
   `ContentUnit`.

See the companion audit for the recommended remediation (adopt `ContentPart` end-to-end,
preserve all fields, add a renderer registry, unify the ontology).

---

## 10. File Map (reference)

| Concern | File |
|---|---|
| Slave lifecycle | `src/engines/chrome-governor.ts` |
| CDP mediated I/O | `src/engines/chrome/cdp-proxy.ts` |
| CDP transport / capture | `src/executor/cdp-transport.ts` |
| Chat orchestration | `src/engines/conversation-manager.ts` |
| Parser engine | `src/engines/stream-parser.ts` |
| Parser contract + types | `src/schema/streaming.ts` |
| Blocker classifier (sandbox) | `src/engines/sandbox-runner.ts`, `sandbox-runner-quickjs.ts` |
| Unknown-format classifier | `src/engines/format-classifier.ts` |
| Per-block storage | `src/engines/content-unit-decomposer.ts`, `src/storage/contracts/content-unit-store.ts` |
| Node capture | `src/engines/conversation-manager.ts` (`captureAsNode`), `src/storage/contracts/node-store.ts` |
| HTTP entry (send) | `src/server/conversation-router.ts` |
| WS bridge | `src/server/websocket.ts` |
| Frontend WS hook | `frontend/src/hooks/useWebSocket.ts` |
| Frontend composer | `frontend/src/components/chat/Composer.tsx` |
| Frontend renderer | `frontend/src/components/chat/MessageBlock.tsx` |
| UI slot wiring | `frontend/src/ui/defaults/index.tsx` |
| Streaming protocol (alt path) | `src/engines/streaming-protocol.ts` |
| Imports (alt ingestion) | `src/engines/parsers/{chatgpt,claude,gemini}-import.ts`, `src/engines/content-item-engine.ts` |

---

## 11. One-Paragraph Mental Model

> A Chrome slave runs the provider's web app; the ChromeGovernor (via CDPProxy →
> CDPTransport) types the user's message into the composer and intercepts the provider's
> streaming network response. ConversationManager.send orchestrates this, hands the raw
> body to the StreamParserEngine, which uses a DB-driven sandboxed parser (with a
> provider→generic→system fallback chain) to produce a canonical `ContentPart[]`. That
> array is fanned out to a message row, per-block rows, decomposed content units, and
> graph Nodes; a `conversation:complete` event is emitted, forwarded over WebSocket to
> the subscribed frontend, which reloads the conversation messages and renders each
> stored block through a legacy `{kind, content}` renderer. The uniform contract is
> `ContentPart`; the frontend's legacy model and field-dropping seam are the main
> barriers to rendering the many future data formats uniformly.
