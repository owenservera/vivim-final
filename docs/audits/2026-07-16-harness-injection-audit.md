# Chrome Slave Harness Injection System — Architecture Audit

**Date:** 2026-07-16  
**Objectives:**
1. Zero interference between Chrome slave and webapp frontend/backend
2. Harness mode concept
3. Concurrent dedicated harness I/O streams and states

---

## ARCHITECTURE DECOMPOSITION

### READ Path: Provider → vivim (Capture & Parse)

```
┌──────────────────────────────────────────────────────────────┐
│                    READ PATH (Provider → vivim)              │
│                                                              │
│  ┌─────────┐   ┌──────────────┐   ┌────────────┐   ┌──────┐│
│  │Provider │──▶│CdpTransport   │──▶│StreamParser │──▶│Stream││
│  │ WebApp  │   │Impl.capture() │   │Engine.parse │   │Block ││
│  │(Chrome) │   │              │   │             │   │Store ││
│  └─────────┘   │ Network.enable│   │             │   └──┬───┘│
│       ▲        │ Target.getT…  │   │             │      │    │
│       │        │ Network.resp… │   │             │      ▼    │
│  ─ ─ ─│─ ─ ─   │ getResponse…  │   └────────────┘   ┌──────┐│
│  Inject│        │ DOM fallback  │                     │Event ││
│  Type+ │        └──────────────┘                     │Bus   ││
│  Submit│                                              └──────┘│
│       │                                                       │
└───────┼───────────────────────────────────────────────────────┘
        │
        │  WRITE PATH (vivim → Provider via CDP)
        ▼
┌──────────────────────────────────────────────────────────────┐
│                    WRITE PATH (vivim → Provider)             │
│                                                              │
│  ┌────────────┐   ┌──────────────┐   ┌────────────────────┐ │
│  │Conversation│──▶│HarnessDAG    │──▶│CDPProxy             │ │
│  │Manager     │   │(3-node DAG)  │   │.executeHarnessPlan()│ │
│  │            │   │              │   │                     │ │
│  │sendInternal│   │ type_text    │   │ acquire mutex       │ │
│  │            │   │     ↓        │   │ execute nodes       │ │
│  │            │   │ submit       │──▶│   → typeMessage()   │ │
│  │            │   │     ↓        │   │   → submitMessage() │ │
│  │            │   │ capture      │   │   → capture()       │ │
│  └────────────┘   └──────────────┘   │ release mutex       │ │
│                                      └────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

**Pipe diameter analysis:**

| Layer | Read Bandwidth | Write Bandwidth | Shared? |
|---|---|---|---|
| `BunCdpClient` | One WS connection per slave | Same WS | Yes — single socket |
| `CdpTransportImpl` | `clients: Map<slaveId, SlaveSession>` | Same session | Yes — one session per slave |
| `CDPProxy` | Mutex-protected per slave | Same mutex | Yes — `AsyncMutex` serializes ALL I/O |
| `ConversationManager` | `Network.getResponseBody` via capture | `Runtime.evaluate` via typeMessage | Yes — same slave |

**Architectural truth:** The entire READ and WRITE path of a single slave funnels through ONE `BunCdpClient` WebSocket connection, ONE CDP `sessionId` on a single page target, behind ONE `AsyncMutex`. There is one pipe per slave.

---

## OBJECTIVE 1: Zero Interference Between Chrome Slave and Webapp

### Current Isolation Model

| Boundary | Mechanism | Status |
|---|---|---|
| **Process isolation** | Chrome runs as separate OS process (Bun.spawn detached) | ✅ Clean |
| **Network isolation** | CDP WebSocket bound to `127.0.0.1` only | ✅ No remote access |
| **Port isolation** | Each slave gets a unique debug port from pool | ✅ FleetSupervisor allocates |
| **Profile isolation** | Per-account Chrome profile directories | ✅ ProfileAllocator |
| **CDP session isolation** | One `SlaveSession` per slave | ✅ CdpTransportImpl.clients |
| **Frontend ↔ Chrome interference** | Vite dev server on :5173, backend on :9420, Chrome on :9222+ | ✅ Separate ports |
| **Backend ↔ Chrome interference** | CDP commands go through `CDPProxy` mutex | ⚠️ Serialized — can't collide, but can block |
| **Health probe ↔ Harness interference** | Health probe calls `cdp.send()` → goes through same mutex as harness | 🔴 Blocks |

### Findings

**F1.1** 🔴 Health probe blocks on harness mutex. `FleetSupervisor.healthCheck()` creates a new `BunCdpClient` and calls `Browser.getVersion` — this bypasses the `CDPProxy` mutex (it connects directly). But the governor's `HealthMonitor.probe()` calls `this.cdp.send()` which goes through the CDPProxy mutex. Since Agent C delegated health probes to `FleetSupervisor`, this is now resolved — the fleet health probe uses its own direct connection. **Resolved by Agent C.**

**F1.2** 🔴 Capture timeout holds the mutex for 60s. `CDPProxy.executeHarnessPlan()` acquires the slave mutex at line 225 and holds it until ALL nodes complete, including the `capture` node with `timeoutMs: 60_000`. During those 60s, no other CDP operation can touch the same slave — not even a health probe or a `getPageState()` call. If the user navigates away, the mutex is still held.

**F1.3** 🟡 Network listeners accumulate across sends. `CdpTransportImpl.capture()` calls `client.on('Network.responseReceived', ...)` but never removes the handler via `client.off()`. Each send registers a new set of handlers. After 100 sends, 300 event handlers fire for every network response. The cleanup is in the `finish()` closure but only fires when capture completes or times out — if Chrome crashes during capture, handlers leak.

**F1.4** 🟡 `composer-typing.ts` injects DOM events directly into the provider page. `typeMessage()` calls `Runtime.evaluate` which modifies the page's DOM (sets textContent, dispatches input events). This is write-only — the page state changes but the webapp frontend has no knowledge of it. This is by design, but if the webapp frontend were to render the same provider page in an iframe (as the canvas UI might), the CDP-injected text would appear in the iframe's DOM without the frontend knowing about it.

**F1.5** ✅ Port isolation prevents address conflicts. The backend (:9420), frontend (:5173), and Chrome slaves (:9222+) are on separate ports. No routing collision possible.

---

## OBJECTIVE 2: Harness Mode Concept

### Current State

The system has an implicit harness mode — every send builds the same 3-node DAG:

```
type_text → submit → capture
```

The `HarnessNode.type` field declares 7 strategies (`action`, `sequence`, `branch`, `parallel`, `retry`, `precondition`, `step`) — only `action` is ever used. The `composer-typing.ts` has 4 strategies (textarea, contenteditable, quill, codemirror), but the mode is derived from a hardcoded switch in `composerTypeForProvider()`, not from DB config or runtime detection.

### What "Harness Mode" Should Mean

A harness mode is a **provider-specific interaction profile** that defines:
1. The WRITE strategy (how text enters the composer)
2. The SUBMIT strategy (how the message is sent)
3. The READ strategy (how the response is captured)
4. The WAIT strategy (what conditions must be met between steps)
5. The RECOVERY strategy (what to do on failure)

### Findings

**F2.1** 🔴 No harness mode registry. Modes exist implicitly but are not named, versioned, or DB-backed. A provider's "mode" is scattered across:
- `composerTypeForProvider()` in `conversation-manager.ts` (hardcoded switch)
- `COMPOSER_SELECTORS` in `provider-selectors.ts` (hardcoded Map)
- `SEND_BUTTON_SELECTORS` in `provider-selectors.ts` (hardcoded Map)
- `CAPTURE_PATTERNS` in `conversation-manager.ts` (hardcoded Map)
- `ProviderEndpoint.composerType` + `sendMethod` + `selectorsJson` in the DB

The DB columns exist (`composerType`, `sendMethod`, `selectorsJson`) but the conversation-manager ignores them in favor of hardcoded Maps.

**F2.2** 🟡 No runtime mode detection. `composerTypeForProvider()` is a compile-time switch. If a provider changes its UI (e.g., ChatGPT switches from ProseMirror to a custom CDE), the mode is wrong until someone updates the hardcoded switch. A harness mode should be detectable at runtime by probing the page.

**F2.3** 🟡 Harness DAG is always 3-node. Never adapts:
- No "wait for thinking indicator" node for providers that show "..." before responding
- No "dismiss dialog" node for providers that show cookie consents or upgrade prompts
- No "retry" node on transient failures (the `type: 'retry'` and `type: 'branch'` exist but are unused)
- No "scroll to bottom" node for providers that auto-scroll the conversation view away from the capture

**F2.4** 🟡 No mode inheritance. Every provider mode is independently hardcoded. If two providers use the same composer framework (e.g., both use ProseMirror), their modes should share a base template with overrides.

**F2.5** ✅ Mode isolation per account. Each provider+account gets its own slave, its own Chrome profile, and its own CDP session. A mode change for one provider doesn't affect others.

### Proposed Harness Mode Schema

```ts
interface HarnessMode {
  id: string
  name: string
  providerFamily: string  // 'ai-chat' | 'email' | 'messenger'
  version: number
  // WRITE: how to input text
  writeStrategy: {
    composerType: 'textarea' | 'contenteditable' | 'quill' | 'codemirror'
    selectors: string[]           // priority-ordered composer element selectors
    clearBeforeType: boolean      // clear existing text before typing
    verifyAfterType: boolean      // verify text landed
  }
  // SUBMIT: how to send
  submitStrategy: {
    method: 'enter_key' | 'button_click' | 'both'
    selectors: string[]           // priority-ordered send button selectors
    waitAfterSubmitMs: number     // settle time before capture
  }
  // READ: how to capture the response
  readStrategy: {
    captureType: 'network' | 'dom_poll' | 'both'
    networkPatterns: RegExp[]     // streaming API endpoint patterns
    domSelectors: string[]        // rendered response element selectors
    maxWaitMs: number             // timeout for response
  }
  // WAIT: conditions between steps
  waitConditions: Array<{
    name: string
    type: 'selector_visible' | 'selector_disabled' | 'network_idle' | 'timer'
    config: Record<string, unknown>
    timeoutMs: number
  }>
  // RECOVERY: what to do on failure
  recovery: {
    maxRetries: number
    strategies: Array<'retype' | 'reclick' | 'navigate' | 'restart_chrome'>
  }
}
```

Where to store: `ProviderEndpoint.selectorsJson` already exists. Extend it or add a `harness_mode` table. The `ProviderStreamConfig` table already models per-provider streaming configuration — it should be unified with the harness mode concept.

---

## OBJECTIVE 3: Concurrent Dedicated Harness I/O Streams and States

### Current State: Single Serial Pipe

```
              ┌──────────────────────┐
              │    AsyncMutex         │
              │   (per slave)         │
              │                      │
   WRITE ────▶│ type_text            │
              │   ↓ (mutex ACQUIRED) │
              │ submit               │
              │   ↓                  │
   READ  ────▶│ capture              │
              │   ↓ (mutex RELEASED) │
              │                      │
              └──────────────────────┘
```

Every CDP operation on a slave is serialized. The mutex guarantees no concurrent CDP commands, which is correct for a single CDP WebSocket connection — Chrome's DevTools protocol doesn't support multiplexing on a single connection. But this means:

1. You cannot type into the composer while a capture is in progress
2. You cannot start a new send until the previous capture finishes
3. Health probes must use a separate connection (which `FleetSupervisor` does, but the old `HealthMonitor` didn't)

### Findings

**F3.1** 🔴 The `StreamingProtocol` class in `streaming-protocol.ts` is never instantiated. It provides `captureChunk()`, progressive block delivery, and `conversation:block` events — all dead code. The provider never receives streaming data because the CDP `Network.dataReceived` handler doesn't accumulate. Result: all responses are captured in one shot at `loadingFinished`, defeating the purpose of progressive rendering.

**F3.2** 🔴 `CdpTransportImpl.captureStream()` has an empty data handler:

```ts
// src/executor/cdp-transport.ts lines 487-492
const dataHandler = (params: unknown) => {
    const event = params as { requestId?: string }
    if (event.requestId && matchingRequests.has(event.requestId)) {
        // Data is arriving — accumulate
    }
}
```

The comment says "accumulate" but the code never pushes to `chunks`. The `chunks` array returned to the caller is always empty. The streaming capture path is functionally identical to the one-shot capture.

**F3.3** 🔴 `ChromeSlave.superState` is always `'idle'`. The type defines 6 states (`idle`, `sending`, `capturing`, `parsing`, `authenticating`, `error`) but the only assignment is `superState: 'idle'` in `toChromeSlave()`. The state never transitions when the harness starts executing. The frontend cannot distinguish between "this slave is idle" and "this slave is mid-send."

**F3.4** 🟡 No per-operation identity. When `CDPProxy.executeHarnessPlan()` runs, it acquires the mutex and executes nodes. But the `CapabilityEventBus` emits `harness:step` events without a `conversationId` or `operationId`. The frontend can't tell which send a `harness:step` event belongs to.

**F3.5** 🟡 No dedicated READ stream channel. The `StreamingProtocol` class is designed to be an event emitter (push-based streaming), but the actual capture path is pull-based (one-shot `getResponseBody`). To achieve concurrent READ:
- The WRITE path (type + submit) should release the mutex immediately after submit confirmation
- The READ path should attach Network listeners BEFORE submit (already done at line 462)
- The READ path should stream data chunks as they arrive, not wait for completion
- The READ path should operate independently of the WRITE mutex

**F3.6** 🟢 One pipe per slave is architecturally correct. CDP doesn't support multiplexing on a single WebSocket. Having a dedicated `BunCdpClient` per slave is the right model. The issue is not the number of pipes — it's what happens inside them.

---

## SUMMARY TABLE

| Finding | Severity | Objective | Description |
|---|---|---|---|
| F1.2 | 🔴 | 1 | Capture timeout (60s) holds slave mutex — blocks ALL other CDP ops |
| F1.3 | 🟡 | 1 | Network event handlers leak if Chrome crashes during capture |
| F2.1 | 🔴 | 2 | No harness mode registry — provider interaction scattered across 4 hardcoded files |
| F2.2 | 🟡 | 2 | No runtime composer detection — relies on compile-time switch |
| F2.3 | 🟡 | 2 | HarnessDAG always 3-node, never adapts to provider quirks |
| F3.1 | 🔴 | 3 | `StreamingProtocol` class is dead code — never instantiated |
| F3.2 | 🔴 | 3 | `captureStream()` data handler is a no-op — never accumulates chunks |
| F3.3 | 🔴 | 3 | `superState` never transitions from `'idle'` |
| F3.4 | 🟡 | 3 | `harness:step` events lack operation/conversation identity |
| F3.5 | 🟡 | 3 | No progressive streaming — all reads are one-shot |
| F1.4 | 🟡 | 1 | CDP DOM injection has no frontend notification |
| F2.4 | 🟡 | 2 | No harness mode inheritance — duplicate code per provider |

---

## RECOMMENDED FIX ORDER

### Phase 1: Fix superState tracking (30 min)
`ChromeSlave.superState` must reflect actual harness state. Transition:
- `idle → sending` when `executeHarnessPlan` starts
- `sending → capturing` when the `type_text` + `submit` nodes complete
- `capturing → idle` when `capture` completes or times out
- `→ error` on any failure

Emit `fleet:slave_status` events on transitions. Frontend shows per-slave state.

### Phase 2: Release mutex after submit, stream capture independently (1 hour)
- `CDPProxy.executeHarnessPlan()` should release the mutex after the `submit` step completes
- The `capture` step should not be part of the DAG — it should be a separate operation
- `CdpTransportImpl.captureStream()` data handler must actually accumulate chunks
- `StreamingProtocol` must be instantiated in the bootstrap and wired to capture

### Phase 3: Harness mode registry (2 hours)
- Add `harness_mode` table or extend `ProviderEndpoint` with a `harnessModeJson` JSON column
- Migrate hardcoded `COMPOSER_SELECTORS`, `SEND_BUTTON_SELECTORS`, `CAPTURE_PATTERNS`, and `composerTypeForProvider()` into DB rows
- Seed modes for all known providers
- `ConversationManager` reads harness mode from DB via `ProviderEndpoint` at resolve time

### Phase 4: Harness DAG adaptability (1 hour)
- Remove the `capture` node from the default DAG (moved to separate operation in Phase 2)
- Add optional `wait_for` condition support in `CDPProxy.executeHarnessPlan`
- Seed provider-specific wait conditions (ChatGPT: wait for response indicator, Claude: wait for thinking block)
- Wire `type: 'branch'` node execution for DM/upgrade-prompt dismissal
