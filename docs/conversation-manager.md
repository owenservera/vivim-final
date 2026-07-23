# ConversationManager

## Overview

The ConversationManager is the **stateful orchestrator** of every user message. It implements an 8-step send pipeline: `RESOLVE → RECALL → DERIVE SLAVE → LOCK → SEND → CAPTURE → PARSE → STORE+EMIT → REMEMBER`.

## Governing Source Files

| File | Role |
|------|------|
| `src/engines/conversation-manager.ts` | `ConversationManager` — the central orchestrator. `send(conversationId, message)` wraps `sendInternal` with retry (`MAX_RETRIES=2`) and `recoverSlave` (kill + respawn on `Slave not running` / `Circuit breaker` / `CDP command failed`). `sendInternal` performs: **[1] RESOLVE** conversation + account; **[0] RECALL** memory/context via `ContextAssemblyEngine` or `MemoryEngine`; **[2] DERIVE SLAVE** via `governor.ensureRunningForAccount`; **[2.5] VERIFY PAGE STATE** (navigate to provider URL if wrong page); **[3] LOCK** (CDPProxy mutex inside ensureRunning); **[4] INJECT CONTEXT** (builds `ConversationContext`); **[5] SEND** (builds `HarnessDAG` with `type_text` + `submit`, runs `cdp.executeHarnessPlan`); **[5.5] PRE-CAPTURE** (`Network.enable`); **[6] CAPTURE** (`cdp.capture` with provider-specific regex pattern); **[7] PARSE** (`parser.parse`); **[8] STORE+EMIT** (user + assistant messages, `StreamBlockStore.storeBlocks`, `ContentUnitStore.storeUnits`, `captureAsNode` for universal Node capture, `eventBus.emit(conversation:complete)`); **[9] REMEMBER** (record episode to `MemoryEngine`, fire-and-forget). Also exports `sendStreaming` (progressive capture via `StreamingProtocol` + `Network` events). |
| `src/engines/streaming-protocol.ts` | `StreamingProtocol` — progressive streaming capture. Uses CDP `Network` events (`Network.responseReceived`, `Network.loadingFinished`) to capture chunks in real time, then assembles them into `ContentBlock[]`. |
| `src/engines/stream-block-store.ts` | `StreamBlockStore` — thin persistence engine for `ContentBlock[]`. Batched `createMany` INSERT. Paginated retrieval by conversation/message/kind. |
| `src/engines/content-unit-decomposer.ts` | `decomposeToContentUnits` — breaks `ContentBlock[]` into `ContentUnit` rows for per-block storage and graph queries. |
| `src/engines/provider-selectors.ts` | `COMPOSER_SELECTORS`, `PROVIDER_URLS`, `PROVIDER_URL_PATTERNS`, `findWorkingSelector` — provider-specific fallback selectors used by `ConversationManager` when capability resolution yields no selector. |
| `src/engines/composer-typing.ts` | `typeMessage`, `submitMessage` — low-level CDP actions for typing into textareas/contenteditables/Quill/Codemirror and submitting (Enter or send button click). |

## Storage Contracts

| File | Role |
|------|------|
| `src/storage/contracts/conversation-store.ts` | `ConversationStore` — CRUD for `Conversation`, `ConversationMessage`, `ProviderAccount`, `MessageAttachment`. `createMessage` is the persistence sink for both user and assistant messages. |
| `src/storage/contracts/stream-block-store.ts` | `StreamBlockStoreContract` — `streamBlock` table CRUD. |
| `src/storage/contracts/content-unit-store.ts` | `ContentUnitStore` — `upsertContentUnits`, `getByMessageId`, `getByType`, `getByConversationId`, `getStats`. |
| `src/storage/contracts/node-store.ts` | `NodeStoreContract` — `putNode`, `getNodeAtVersion`, `getNodeHistory`. Used by `captureAsNode` to persist every message as a `cap-store.message` Node with ACU fields and `responds_to` edges. |

## Key Types and Interfaces

```typescript
// From src/engines/conversation-manager.ts
export interface ConversationContext {
  provider: { id: string; slug: string; displayName: string }
  account: { email: string; planTier: string; loginState: string }
  chrome: { status: string; circuitState: string }
  capabilities: { total: number; available: number }
  memory?: AgentMemoryContext
}

export interface StageTiming {
  resolve?: number
  recall?: number
  ensure?: number
  type?: number
  submit?: number
  capture?: number
  parse?: number
  store?: number
  total?: number
  [key: string]: number | undefined
}

export interface SendResult {
  ok: boolean
  messageId: string
  blocks: ContentBlock[]
  text: string
  latencyMs: number
  timing?: StageTiming
  error?: string
}
```

## Data Flow

1. **Send Request**: `conversationManager.send(conversationId, message)` → retry wrapper + `recoverSlave` on failure
2. **RESOLVE**: Load conversation + provider account from `ConversationStore`
3. **RECALL**: Assemble context via `ContextAssemblyEngine` or `MemoryEngine` (recent episodes, topic, project state)
4. **DERIVE SLAVE**: `governor.ensureRunningForAccount(providerId, accountId)` → spawn if needed
5. **VERIFY PAGE STATE**: Navigate to provider URL if current page is wrong
6. **LOCK**: CDPProxy mutex acquired inside `ensureRunning` — prevents concurrent sends
7. **INJECT CONTEXT**: Build `ConversationContext` with provider, account, chrome state, capabilities
8. **SEND**: Build `HarnessDAG` (`type_text` + `submit`) → `cdp.executeHarnessPlan(slaveId, dag)`
9. **PRE-CAPTURE**: `Network.enable` to start listening for streaming responses
10. **CAPTURE**: `cdp.capture(slaveId, pattern, timeoutMs)` — provider-specific regex pattern matches streaming URL
11. **PARSE**: `parser.parse(rawBody, providerId)` → `ContentBlock[]` with confidence, wire format, diagnostics
12. **STORE+EMIT**: Persist user + assistant messages to `ConversationStore`; store blocks in `StreamBlockStore`; decompose to `ContentUnitStore`; capture as Node via `captureAsNode`; emit `conversation:complete` on `EventBus`
13. **REMEMBER**: `memoryEngine.recordMemory()` fire-and-forget episode recording

## Critical Patterns

- **Retry + Recovery**: `MAX_RETRIES=2` with `recoverSlave` — kills + respawns Chrome on `Slave not running`, `Circuit breaker`, or `CDP command failed`
- **Provider-Specific Selectors**: `COMPOSER_SELECTORS` + `PROVIDER_URLS` + `PROVIDER_URL_PATTERNS` used when capability resolution yields no selector
- **Composer Type Detection**: `composerTypeForProvider()` returns `contenteditable` for Claude/Gemini, `textarea` for others
- **Node Capture**: `captureAsNode()` persists every message as `cap-store.message` Node with full block structure, parser diagnostics, and `responds_to`/`follows` edges
- **Streaming Support**: `sendStreaming()` uses `StreamingProtocol` for progressive block delivery during capture
- **Context Assembly**: `ContextAssemblyEngine` assembles conversation context (recent episodes, topic, project state) before send

## System Connections

- **CapabilityResolutionEngine**: resolves composer capabilities per provider to get selectors + composerType
- **ChromeGovernor**: `ensureRunningForAccount`, `cdp.send`, `cdp.executeHarnessPlan`, `cdp.capture`
- **StreamParserEngine**: `parser.parse(rawBody, providerId)`
- **CapabilityEventBus**: emits `conversation:complete` and `conversation:error`
- **MemoryEngine**: `recordEpisode` for best-effort episode recording
- **ContextAssemblyEngine**: assembles conversation context before send
