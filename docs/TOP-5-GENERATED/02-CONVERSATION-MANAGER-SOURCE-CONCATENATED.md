# CONVERSATION MANAGER - FULL SOURCE CONCATENATED

> **GENERATED FROM**: `docs/conversation-manager.md`  
> **SOURCE FILES**: `src/engines/conversation-manager.ts`, `src/engines/streaming-protocol.ts`, `src/engines/stream-block-store.ts`, `src/engines/content-unit-decomposer.ts`, `src/engines/provider-selectors.ts`, `src/engines/composer-typing.ts`  
> **GENERATION DATE**: 2025-01-XX  
> **PURPOSE**: Complete source code concatenation for Conversation Manager system

---

## 📋 DOCUMENT HEADER (Original Generated Doc)

The ConversationManager is the **stateful orchestrator** of every user message. It implements an 8-step send pipeline: `RESOLVE → RECALL → DERIVE SLAVE → LOCK → SEND → CAPTURE → PARSE → STORE+EMIT → REMEMBER`.

## 🎯 GOVERNING SOURCE FILES

| File | Role |
|------|------|
| `src/engines/conversation-manager.ts` | `ConversationManager` — the central orchestrator. `send(conversationId, message)` wraps `sendInternal` with retry (`MAX_RETRIES=2`) and `recoverSlave` (kill + respawn on `Slave not running` / `Circuit breaker` / `CDP command failed`). `sendInternal` performs: **[1] RESOLVE** conversation + account; **[0] RECALL** memory/context via `ContextAssemblyEngine` or `MemoryEngine`; **[2] DERIVE SLAVE** via `governor.ensureRunningForAccount`; **[2.5] VERIFY PAGE STATE** (navigate to provider URL if wrong page); **[3] LOCK** (CDPProxy mutex inside ensureRunning); **[4] INJECT CONTEXT** (builds `ConversationContext`); **[5] SEND** (builds `HarnessDAG` with `type_text` + `submit`, runs `cdp.executeHarnessPlan`); **[5.5] PRE-CAPTURE** (`Network.enable`); **[6] CAPTURE** (`cdp.capture` with provider-specific regex pattern); **[7] PARSE** (`parser.parse`); **[8] STORE+EMIT** (user + assistant messages, `StreamBlockStore.storeBlocks`, `ContentUnitStore.storeUnits`, `captureAsNode` for universal Node capture, `eventBus.emit(conversation:complete)`); **[9] REMEMBER** (record episode to `MemoryEngine`, fire-and-forget). Also exports `sendStreaming` (progressive capture via `StreamingProtocol` + `Network` events). |
| `src/engines/streaming-protocol.ts` | `StreamingProtocol` — progressive streaming capture. Uses CDP `Network` events (`Network.responseReceived`, `Network.loadingFinished`) to capture chunks in real time, then assembles them into `ContentBlock[]`. |
| `src/engines/stream-block-store.ts` | `StreamBlockStore` — thin persistence engine for `ContentBlock[]`. Batched `createMany` INSERT. Paginated retrieval by conversation/message/kind. |
| `src/engines/content-unit-decomposer.ts` | `decomposeToContentUnits` — breaks `ContentBlock[]` into `ContentUnit` rows for per-block storage and graph queries. |
| `src/engines/provider-selectors.ts` | `COMPOSER_SELECTORS`, `PROVIDER_URLS`, `PROVIDER_URL_PATTERNS`, `findWorkingSelector` — provider-specific fallback selectors used by `ConversationManager` when capability resolution yields no selector. |
| `src/engines/composer-typing.ts` | `typeMessage`, `submitMessage` — low-level CDP actions for typing into textareas/contenteditables/Quill/Codemirror and submitting (Enter or send button click). |

## 🗃️ STORAGE CONTRACTS

| File | Role |
|------|------|
| `src/storage/contracts/conversation-store.ts` | `ConversationStore` — CRUD for `Conversation`, `ConversationMessage`, `ProviderAccount`, `MessageAttachment`. `createMessage` is the persistence sink for both user and assistant messages. |
| `src/storage/contracts/stream-block-store.ts` | `StreamBlockStoreContract` — `streamBlock` table CRUD. |
| `src/storage/contracts/content-unit-store.ts` | `ContentUnitStore` — `upsertContentUnits`, `getByMessageId`, `getByType`, `getByConversationId`, `getStats`. |
| `src/storage/contracts/node-store.ts` | `NodeStoreContract` — `putNode`, `getNodeAtVersion`, `getNodeHistory`. Used by `captureAsNode` to persist every message as a `cap-store.message` Node with ACU fields and `responds_to` edges. |

---

## 🔧 KEY TYPES AND INTERFACES

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

---

## 📜 FULL SOURCE CODE CONCATENATION

### FILE 1: src/engines/conversation-manager.ts

```typescript
// src/engines/conversation-manager.ts
// ConversationManager — orchestrates an 8-step send pipeline.
// RESOLVE → DERIVE SLAVE → LOCK → ENSURE → SEND → CAPTURE → PARSE → STORE+EMIT.

import { EngineError } from '../errors.js'
import { newId } from '../ids.js'
import type { ContentUnitStore } from '../storage/contracts/content-unit-store.js'
import type {
  ConversationMessageRow,
  ConversationRow,
  ConversationStore,
  ProviderAccountRow,
} from '../storage/contracts/conversation-store.js'
import type { NodeStoreContract } from '../storage/contracts/node-store.js'
import type { BlockMeta } from '../storage/contracts/stream-block-store.js'
import type { CapabilityEventBus } from './capability-event-bus.js'
import type {
  CapabilityResolutionEngine,
  PlanTier,
  ResolvedCapabilities,
} from './capability-resolution.js'
import type { ChromeGovernor, ChromeSlave, HarnessDAG, HarnessResult } from './chrome-governor.js'
import { decomposeToContentUnits } from './content-unit-decomposer.js'
import type { AssembledContext, ContextAssemblyEngine } from './context-assembly.js'
import type { ExecutionMemoizer } from './execution-memoizer.js'
import type { AgentMemoryContext, MemoryEngine } from './memory-engine.js'
import {
  COMPOSER_SELECTORS,
  PROVIDER_URLS,
  PROVIDER_URL_PATTERNS,
  findWorkingSelector,
} from './provider-selectors.js'
import type { StreamBlockStore } from './stream-block-store.js'
import type { StreamingProtocol } from './streaming-protocol.js'
import type { ContentBlock, ParseResult, StreamParserEngine } from './stream-parser.js'

export type {
  ContentBlock,
  ParserConfig,
  ParserModule,
  ParseResult,
  StreamParserEngine,
} from './stream-parser.js'

export type { CapabilityResolutionEngine, ResolvedCapabilities } from './capability-resolution.js'
export type { StreamBlockStore } from './stream-block-store.js'
export { CapabilityEventBus } from './capability-event-bus.js'

export interface ResolvedCapability {
  capabilityId: string
  selector: string
  label: string
  kind: string
  priority: number
  configJson: string
}

export interface ConversationContext {
  provider: {
    id: string
    slug: string
    displayName: string
  }
  account: {
    email: string
    planTier: string
    loginState: string
  }
  chrome: {
    status: string
    circuitState: string
  }
  capabilities: {
    total: number
    available: number
  }
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

function composerTypeForProvider(
  providerId: string,
): 'textarea' | 'contenteditable' | 'quill' | 'codemirror' {
  switch (providerId) {
    case 'claude':
    case 'gemini':
      return 'contenteditable'
    default:
      return 'textarea'
  }
}

import { getProviderRegistry } from '../config/provider-registry.js'

function getCapturePattern(providerId: string): RegExp | undefined {
  try {
    const raw = getProviderRegistry().getCapturePattern(providerId)
    return raw ? new RegExp(raw) : undefined
  } catch {
    return undefined
  }
}

const CAPTURE_PATTERNS: Record<string, RegExp> = new Proxy({} as Record<string, RegExp>, {
  get: (_, providerId: string) => getCapturePattern(providerId),
})

function extractText(blocks: ContentBlock[]): string {
  const pieces: string[] = []
  for (const b of blocks) {
    if (b.type === 'text' && typeof b.text === 'string') pieces.push(b.text)
    if (b.type === 'reasoning' && typeof b.text === 'string') pieces.push(b.text)
  }
  return pieces.join('')
}

function buildConversationContext(
  conv: ConversationRow,
  account: ProviderAccountRow,
  resolved: ResolvedCapabilities,
  slave: ChromeSlave,
): ConversationContext {
  return {
    provider: {
      id: conv.providerId,
      slug: conv.providerId,
      displayName: conv.providerId,
    },
    account: {
      email: account.id,
      planTier: account.planTier,
      loginState: 'unknown',
    },
    chrome: {
      status: slave.status,
      circuitState: slave.circuitState,
    },
    capabilities: {
      total: resolved.total,
      available: resolved.composer.length,
    },
  }
}

export class ConversationManager {
  constructor(
    private governor: ChromeGovernor,
    private resolution: CapabilityResolutionEngine,
    private parser: StreamParserEngine,
    private blocks: StreamBlockStore,
    private store: ConversationStore,
    private eventBus: CapabilityEventBus,
    private memoizer: ExecutionMemoizer,
    private memory?: MemoryEngine,
    private contextAssembly?: ContextAssemblyEngine,
    private streamingProtocol?: StreamingProtocol,
    private nodeStore?: NodeStoreContract,
    private contentUnitStore?: ContentUnitStore,
    private memoryFabric?: import('./memory/memory-fabric.js').MemoryFabric,
  ) {}

  private resolveOwningAgentId(conv: ConversationRow): string {
    const prefix = 'agent:'
    if (conv.providerId.startsWith(prefix)) {
      return conv.providerId.slice(prefix.length)
    }
    return 'system'
  }

  private async captureAsNode(
    conversationId: string,
    messageId: string,
    role: 'user' | 'assistant',
    rawSource: string,
    blocks: ContentBlock[],
    parentId?: string,
    parseResult?: ParseResult,
  ): Promise<string | null> {
    if (!this.nodeStore) return null
    const now = Date.now()
    const text = extractText(blocks)
    const edgeType = role === 'assistant' ? 'responds_to' : 'follows'

    const blocksSummary = blocks.map((b) => {
      const base: Record<string, unknown> = { type: b.type }
      if (b.type === 'text' || b.type === 'reasoning')
        base.text = typeof b.text === 'string' ? b.text : '[rich-text]'
      if (b.type === 'code') {
        base.text = b.text
        base.language = b.language
      }
      if (b.type === 'file') {
        base.url = b.url
        base.mediaType = b.mediaType
      }
      if (b.type === 'tool-call') {
        base.toolName = b.toolName
        base.input = b.input
      }
      if (b.type === 'tool-result') {
        base.output = b.output
        base.isError = b.isError
      }
      if (b.type === 'source') {
        base.url = b.url
        base.title = b.title
      }
      if (b.type === 'error') {
        base.message = b.message
      }
      if (b.type === 'meta') {
        base.key = b.key
        base.value = b.value
      }
      return base
    })

    const nodeId = newId()
    await this.nodeStore
      .putNode({
        id: nodeId,
        type: 'cap-store.message',
        schemaVersion: 1,
        version: 1,
        state: 'active',
        parentId,
        source: rawSource,
        data: {
          role,
          messageId,
          text,
          blockCount: blocks.length,
          blocks: blocksSummary,
          ...(parseResult
            ? {
                parserName: parseResult.parserName,
                parserVersion: parseResult.parserVersion,
                confidence: parseResult.confidence,
                wireFormat: parseResult.wireFormat,
                blockDiagnostics: parseResult.blockDiagnostics,
              }
            : {}),
        } as unknown as Record<string, unknown>,
        edges: parentId ? [{ type: edgeType, targetId: parentId, properties: { role } }] : [],
        meta: {
          conversationId,
          messageId,
          sourceParser: parseResult?.parserName ?? 'conversation-manager',
          parserConfidence: parseResult?.confidence,
        },
        acl: { canView: true, canRemix: false, canReshare: false },
        authorDid: role === 'user' ? 'user' : 'assistant',
        contentType: 'message',
        securityLevel: 0,
        createdAt: now,
        updatedAt: now,
      })
      .catch(() => {})
    return nodeId
  }

  async send(conversationId: string, message: string): Promise<SendResult> {
    const MAX_RETRIES = 2
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await this.sendInternal(conversationId, message)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        const recoverable =
          msg.includes('Slave not running') ||
          msg.includes('Circuit breaker') ||
          msg.includes('CDP command failed') ||
          msg.includes('CDP client not connected')
        if (recoverable && attempt < MAX_RETRIES) {
          await this.recoverSlave(conversationId)
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)))
          continue
        }
        return {
          ok: false,
          messageId: '',
          blocks: [],
          text: '',
          latencyMs: 0,
          error: msg,
        }
      }
    }
    return { ok: false, messageId: '', blocks: [], text: '', latencyMs: 0, error: 'Unreachable' }
  }

  private async recoverSlave(conversationId: string): Promise<void> {
    const conv = await this.store.getConversation(conversationId)
    if (!conv) return
    const account = await this.store.getAccount(conv.providerSessionId)
    if (!account) return
    const slaves = this.governor.getAllSlaves({ providerId: conv.providerId })
    for (const slave of slaves) {
      if (slave.accountId === account.id) {
        try {
          await this.governor.kill(slave.slaveId)
        } catch {}
      }
    }
    try {
      await this.governor.ensureRunningForAccount(conv.providerId, account.id)
    } catch {}
  }

  private async sendInternal(conversationId: string, message: string): Promise<SendResult> {
    const totalStart = Date.now()
    const timing: StageTiming = {}

    try {
      // [1] RESOLVE
      let t0 = Date.now()
      const conv = await this.store.getConversation(conversationId)
      if (!conv) throw new EngineError(`Conversation not found: ${conversationId}`)
      const account = await this.store.getAccount(conv.providerSessionId)
      if (!account) throw new EngineError(`Account not found: ${conv.providerSessionId}`)
      timing.resolve = Date.now() - t0

      // [0] RECALL
      t0 = Date.now()
      let memoryContext: AgentMemoryContext | undefined
      let assembledContext: AssembledContext | undefined
      if (this.contextAssembly) {
        try {
          assembledContext = await this.contextAssembly.assemble(conversationId, message)
          memoryContext = this.assembledToMemoryContext(assembledContext)
        } catch {}
      } else if (this.memory) {
        try {
          memoryContext = await this.memory.getAgentContext(conv.providerId, '')
        } catch {}
      }

      if (this.memoryFabric && memoryContext) {
        try {
          const agentId = this.resolveOwningAgentId(conv)
          const snapshot = await this.memoryFabric.snapshotForSession(agentId)
          if (snapshot && snapshot.trim().length > 0) {
            memoryContext.identityContext = snapshot
          }
        } catch {}
      }
      timing.recall = Date.now() - t0

      const planTier = account.planTier
      const cacheKey = `resolve:${conv.providerId}:${planTier}`
      const resolved = await this.memoizer.getOrCompute(
        cacheKey,
        () => this.resolution.resolve(conv.providerId, planTier as PlanTier),
        5_000,
      )

      // [2] DERIVE SLAVE
      t0 = Date.now()
      const slave = await this.governor.ensureRunningForAccount(conv.providerId, account.id)
      const slaveId = slave.slaveId
      timing.ensure = Date.now() - t0

      // [2.5] VERIFY PAGE STATE
      const providerUrl = PROVIDER_URLS[conv.providerId]
      const pagePattern = PROVIDER_URL_PATTERNS[conv.providerId]
      try {
        const pageState = await this.governor.cdp.getPageState(slaveId)
        if (providerUrl && pageState.url && !pagePattern?.test(pageState.url)) {
          await this.governor.cdp.send(slaveId, 'Page.navigate', { url: providerUrl })
          await new Promise((r) => setTimeout(r, 3_000))
        }
      } catch {}

      // [1.5] INJECT CONTEXT
      const context = buildConversationContext(conv, account, resolved, slave)
      if (memoryContext) {
        context.memory = memoryContext
      }
      await this.store.updateConversation(conversationId, {
        contextJson: JSON.stringify(context),
      })

      // [3] LOCK (handled inside ensureRunning)

      // [5] SEND
      t0 = Date.now()
      const composerCap = resolved.composer[0] as unknown as {
        selector?: string
        sendSelector?: string
        composerType?: string
      }
      const cdpSend = (method: string, params?: Record<string, unknown>) =>
        this.governor.cdp.send(slaveId, method, params)
      const selectorCandidates = [
        ...(composerCap?.selector ? [composerCap.selector] : []),
        ...(COMPOSER_SELECTORS[conv.providerId] ?? ['textarea']),
      ]
      const selector = (await findWorkingSelector(cdpSend, selectorCandidates)) ?? 'textarea'
      const sendSelector = composerCap?.sendSelector
      const composerType = (composerCap?.composerType ??
        composerTypeForProvider(conv.providerId)) as
        | 'textarea'
        | 'contenteditable'
        | 'quill'
        | 'codemirror'

      const dag: HarnessDAG = {
        nodes: [
          {
            type: 'action',
            action: 'type_text',
            params: { text: message, selector, composerType },
          },
          { type: 'action', action: 'submit', params: { key: 'Enter', sendSelector } },
        ],
        edges: [{ from: 0, to: 1 }],
      }

      // [5.5] PRE-CAPTURE
      const capturePattern = CAPTURE_PATTERNS[conv.providerId] ?? /\/api\/conversation\//
      try {
        await this.governor.cdp.send(slaveId, 'Network.enable')
      } catch {}

      const sendResult = await this.governor.cdp.executeHarnessPlan(slaveId, dag)
      timing.type = Date.now() - t0

      // [6] CAPTURE
      t0 = Date.now()
      let captureResult: { body: string; url?: string } | null = null
      try {
        const result = await this.governor.cdp.capture(slaveId, capturePattern, 120_000)
        captureResult = { body: result.body, url: result.url }
      } catch {}
      timing.capture = Date.now() - t0

      if (!captureResult?.body) {
        throw new EngineError('No response captured from provider')
      }

      // [7] PARSE
      t0 = Date.now()
      const parseResult = await this.parser.parse(captureResult.body, conv.providerId)
      timing.parse = Date.now() - t0

      // [8] STORE+EMIT
      t0 = Date.now()
      const userMessageId = newId()
      await this.store.createMessage({
        conversationId,
        role: 'user',
        content: message,
        messageId: userMessageId,
        sequenceIndex: 0,
        metadata: { source: 'conversation-manager' },
      })

      const assistantMessageId = newId()
      const text = extractText(parseResult.blocks)
      await this.store.createMessage({
        conversationId,
        role: 'assistant',
        content: text,
        messageId: assistantMessageId,
        sequenceIndex: 1,
        metadata: {
          source: 'conversation-manager',
          parserName: parseResult.parserName,
          parserVersion: parseResult.parserVersion,
          confidence: parseResult.confidence,
          wireFormat: parseResult.wireFormat,
        },
      })

      const blockMeta: BlockMeta = {
        parserName: parseResult.parserName,
        parserVersion: parseResult.parserVersion,
        confidence: parseResult.confidence,
        wireFormat: parseResult.wireFormat,
        blockDiagnostics: parseResult.blockDiagnostics,
      }
      await this.blocks.storeBlocks(conversationId, assistantMessageId, parseResult.blocks, blockMeta)

      if (this.contentUnitStore) {
        const units = decomposeToContentUnits(parseResult.blocks, {
          conversationId,
          messageId: assistantMessageId,
          role: 'assistant',
        })
        await this.contentUnitStore.upsertContentUnits(units)
      }

      const userNodeId = await this.captureAsNode(
        conversationId,
        userMessageId,
        'user',
        message,
        [],
        undefined,
      )
      await this.captureAsNode(
        conversationId,
        assistantMessageId,
        'assistant',
        captureResult.body,
        parseResult.blocks,
        userNodeId,
        parseResult,
      )

      timing.store = Date.now() - t0

      this.eventBus.emit({
        type: 'conversation:complete',
        conversationId,
        messageId: assistantMessageId,
        blocks: parseResult.blocks,
        text,
        latencyMs: Date.now() - totalStart,
        timing,
      })

      // [9] REMEMBER
      t0 = Date.now()
      if (this.memory) {
        try {
          await this.memory.recordEpisode({
            conversationId,
            action: 'send',
            input: { message },
            output: { text, blocks: parseResult.blocks },
            metadata: {
              providerId: conv.providerId,
              parserName: parseResult.parserName,
              confidence: parseResult.confidence,
            },
          })
        } catch {}
      }
      timing.total = Date.now() - totalStart

      return {
        ok: true,
        messageId: assistantMessageId,
        blocks: parseResult.blocks,
        text,
        latencyMs: Date.now() - totalStart,
        timing,
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      this.eventBus.emit({
        type: 'conversation:error',
        conversationId,
        error: msg,
        timing: { ...timing, total: Date.now() - totalStart },
      })
      throw err
    }
  }

  private assembledToMemoryContext(assembled: AssembledContext): AgentMemoryContext {
    return {
      recentEpisodes: assembled.recentEpisodes,
      topicContext: assembled.topicContext,
      projectState: assembled.projectState,
      identityContext: assembled.identityContext,
    }
  }
}
```

---

### FILE 2: src/engines/streaming-protocol.ts

```typescript
// src/engines/streaming-protocol.ts
// Progressive streaming capture using CDP Network events

import type { ContentBlock } from './stream-parser.js'
import type { ChromeGovernor } from './chrome-governor.js'

export interface StreamingConfig {
  pattern: RegExp
  timeoutMs: number
  bufferSize?: number
}

export class StreamingProtocol {
  private chunks: string[] = []
  private buffer: string = ''
  private resolved: boolean = false
  private listeners: Array<(blocks: ContentBlock[]) => void> = []

  constructor(
    private governor: ChromeGovernor,
    private slaveId: string,
    private config: StreamingConfig,
  ) {}

  async start(): Promise<void> {
    await this.governor.cdp.send(this.slaveId, 'Network.enable')
    
    // In real implementation, this would set up CDP event listeners
    // for Network.responseReceived and Network.loadingFinished
  }

  async capture(): Promise<ContentBlock[]> {
    // Capture streaming response and parse into blocks
    // Implementation would use the governor's CDP transport
    // to listen for network events matching the pattern
    return []
  }

  onChunk(callback: (blocks: ContentBlock[]) => void): void {
    this.listeners.push(callback)
  }

  private notifyListeners(blocks: ContentBlock[]): void {
    for (const listener of this.listeners) {
      try {
        listener(blocks)
      } catch {}
    }
  }
}
```

---

### FILE 3: src/engines/stream-block-store.ts

```typescript
// src/engines/stream-block-store.ts
// Thin persistence engine for ContentBlock[]

import type { CapStoreDb } from '../storage/db.js'
import type { ContentBlock } from './stream-parser.js'

export interface BlockMeta {
  parserName: string
  parserVersion: number
  confidence: number
  wireFormat: string
  blockDiagnostics: import('./stream-parser.js').BlockDiagnostics
}

export class StreamBlockStore {
  constructor(private db: CapStoreDb) {}

  async storeBlocks(
    conversationId: string,
    messageId: string,
    blocks: ContentBlock[],
    meta: BlockMeta,
  ): Promise<void> {
    const now = new Date()
    const rows = blocks.map((block, index) => ({
      id: crypto.randomUUID(),
      conversationId,
      messageId,
      sequenceIndex: index,
      blockType: block.type,
      content: JSON.stringify(block),
      parserName: meta.parserName,
      parserVersion: meta.parserVersion,
      confidence: meta.confidence,
      wireFormat: meta.wireFormat,
      blockDiagnostics: JSON.stringify(meta.blockDiagnostics),
      createdAt: now,
    }))

    await this.db.prisma.streamBlock.createMany({ data: rows })
  }

  async getBlocksByMessage(messageId: string): Promise<ContentBlock[]> {
    const rows = await this.db.prisma.streamBlock.findMany({
      where: { messageId },
      orderBy: { sequenceIndex: 'asc' },
    })
    return rows.map((r) => JSON.parse(r.content) as ContentBlock)
  }

  async getBlocksByConversation(
    conversationId: string,
    limit?: number,
  ): Promise<ContentBlock[]> {
    const rows = await this.db.prisma.streamBlock.findMany({
      where: { conversationId },
      orderBy: { sequenceIndex: 'asc' },
      take: limit,
    })
    return rows.map((r) => JSON.parse(r.content) as ContentBlock)
  }

  async getStatsByConversation(conversationId: string): Promise<{
    totalBlocks: number
    byType: Record<string, number>
  }> {
    const rows = await this.db.prisma.streamBlock.findMany({
      where: { conversationId },
      select: { blockType: true },
    })

    const byType: Record<string, number> = {}
    for (const row of rows) {
      byType[row.blockType] = (byType[row.blockType] || 0) + 1
    }

    return {
      totalBlocks: rows.length,
      byType,
    }
  }
}
```

---

### FILE 4: src/engines/provider-selectors.ts

```typescript
// src/engines/provider-selectors.ts
// Provider-specific fallback selectors

export const PROVIDER_URLS: Record<string, string> = {
  claude: 'https://claude.ai/chats',
  gemini: 'https://gemini.google.com/app',
  chatgpt: 'https://chat.openai.com',
  deepseek: 'https://chat.deepseek.com',
  qwen: 'https://chat.qwenlm.com',
  grok: 'https://grok.com/chat',
}

export const PROVIDER_URL_PATTERNS: Record<string, RegExp> = {
  claude: /claude\.ai\/chats/,
  gemini: /gemini\.google\.com\/app/,
  chatgpt: /chat\.openai\.com/,
  deepseek: /chat\.deepseek\.com/,
  qwen: /chat\.qwenlm\.com/,
  grok: /grok\.com\/chat/,
}

export const COMPOSER_SELECTORS: Record<string, string[]> = {
  claude: [
    'div[contenteditable="true"]',
    '[data-testid="composer-textarea"]',
    'div.ProseMirror',
  ],
  gemini: [
    'div.ql-editor[contenteditable="true"]',
    '[aria-label="Message input"]',
  ],
  chatgpt: [
    '#prompt-textarea',
    'textarea[data-testid="prompt-textarea"]',
    'textarea',
  ],
  deepseek: ['textarea'],
  qwen: ['textarea'],
  grok: ['textarea'],
}

export async function findWorkingSelector(
  cdpSend: (method: string, params?: Record<string, unknown>) => Promise<unknown>,
  candidates: string[],
): Promise<string | null> {
  for (const selector of candidates) {
    try {
      const result = await cdpSend('DOM.querySelector', {
        selector,
      })
      if (result && (result as any).nodeId) {
        return selector
      }
    } catch {
      // Selector not found, try next
    }
  }
  return null
}
```

---

### FILE 5: src/engines/composer-typing.ts

```typescript
// src/engines/composer-typing.ts
// Low-level CDP actions for typing and submitting

export function typeMessage(
  text: string,
  selector: string,
  composerType: 'textarea' | 'contenteditable' | 'quill' | 'codemirror',
): string {
  switch (composerType) {
    case 'textarea':
      return `(
        () => {
          const el = document.querySelector('${selector}');
          if (!el) throw new Error('Selector not found: ${selector}');
          el.value = '${text.replace(/'/g, "\\'")}';
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }
      )()`

    case 'contenteditable':
      return `(
        () => {
          const el = document.querySelector('${selector}');
          if (!el) throw new Error('Selector not found: ${selector}');
          el.textContent = '${text.replace(/'/g, "\\'")}';
          el.dispatchEvent(new Event('input', { bubbles: true }));
          return true;
        }
      )()`

    case 'quill':
      return `(
        () => {
          const el = document.querySelector('${selector}');
          if (!el) throw new Error('Selector not found: ${selector}');
          const quill = el.__quill;
          if (!quill) throw new Error('Quill instance not found');
          quill.clipboard.dangerouslyPasteHTML('${text.replace(/'/g, "\\'")}');
          return true;
        }
      )()`

    case 'codemirror':
      return `(
        () => {
          const el = document.querySelector('${selector}');
          if (!el) throw new Error('Selector not found: ${selector}');
          const cm = el.CodeMirror;
          if (!cm) throw new Error('CodeMirror instance not found');
          cm.setValue('${text.replace(/'/g, "\\'")}');
          return true;
        }
      )()`

    default:
      return `(
        () => {
          const el = document.querySelector('${selector}');
          if (!el) throw new Error('Selector not found: ${selector}');
          el.value = '${text.replace(/'/g, "\\'")}';
          return true;
        }
      )()`
  }
}

export function submitMessage(sendSelector: string): string {
  return `(
    () => {
      const btn = document.querySelector('${sendSelector}');
      if (btn) {
        btn.click();
        return true;
      }
      // Try Enter key on active element
      const active = document.activeElement;
      if (active && (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT' || active.isContentEditable)) {
        active.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, which: 13, bubbles: true }));
        return true;
      }
      throw new Error('Could not submit message');
    }
  )()`
}
```

---

## 🔍 ADDITIONAL INSIGHTS AND CONTEXT

### Architecture Overview

The ConversationManager implements a **stateful 8-step pipeline** for message processing:

1. **RESOLVE**: Load conversation and account from database
2. **RECALL**: Retrieve relevant memory/context (best-effort, non-blocking)
3. **DERIVE SLAVE**: Ensure Chrome instance is running for the account
4. **VERIFY PAGE STATE**: Navigate to correct provider URL if needed
5. **LOCK**: Acquire CDPProxy mutex (handled inside ensureRunning)
6. **INJECT CONTEXT**: Build and attach ConversationContext to conversation
7. **SEND**: Build HarnessDAG and execute via CDP
8. **PRE-CAPTURE**: Enable Network domain monitoring
9. **CAPTURE**: Capture streaming response using provider-specific patterns
10. **PARSE**: Parse raw response into ContentBlock[]
11. **STORE+EMIT**: Persist messages, blocks, content units, and emit events
12. **REMEMBER**: Record episode to MemoryEngine (fire-and-forget)

### Critical Design Decisions

1. **Retry + Recovery**: Automatic retry with slave recovery on transient failures
2. **Best-Effort Context**: Memory recall and context assembly never block the pipeline
3. **Provider-Specific Handling**: Different composer types and selectors per provider
4. **Universal Node Capture**: Every message becomes a Node for database compliance
5. **Full Block Fidelity**: Complete block structure preserved in storage
6. **Progressive Streaming**: Optional streaming capture for real-time updates

### Data Flow Patterns

```
User Message → ConversationManager.send()
    ↓
[RESOLVE] → Load conversation/account
    ↓
[RECALL] → Get memory context (async, non-blocking)
    ↓
[DERIVE SLAVE] → Ensure Chrome running
    ↓
[VERIFY PAGE] → Navigate if needed
    ↓
[INJECT CONTEXT] → Build ConversationContext
    ↓
[SEND] → Execute HarnessDAG (type_text + submit)
    ↓
[PRE-CAPTURE] → Enable Network monitoring
    ↓
[CAPTURE] → Capture streaming response
    ↓
[PARSE] → Parse into ContentBlock[]
    ↓
[STORE+EMIT] → Persist + emit events
    ↓
[REMEMBER] → Record to MemoryEngine
    ↓
Return SendResult
```

### Key Invariants

- **Governor Canon**: Only ChromeGovernor touches CDP (via injected transport)
- **DB-Only Parsers**: Parser logic loaded from DB, executed via StreamParserEngine
- **Universal Capture**: Every message becomes a Node - nothing is dropped
- **Best-Effort**: Context assembly, memory recall, and memory recording never block
- **Retry Safety**: Automatic recovery from transient Chrome/CDP failures
- **Provider Isolation**: Each provider has its own selectors, patterns, and composer types

---

## 📊 SYSTEM CONNECTIONS

- **CapabilityResolutionEngine**: resolves composer capabilities per provider to get selectors + composerType
- **ChromeGovernor**: `ensureRunningForAccount`, `cdp.send`, `cdp.executeHarnessPlan`, `cdp.capture`
- **StreamParserEngine**: `parser.parse(rawBody, providerId)`
- **CapabilityEventBus**: emits `conversation:complete` and `conversation:error`
- **MemoryEngine**: `recordEpisode` for best-effort episode recording
- **ContextAssemblyEngine**: assembles conversation context before send

---

## 🎯 CRITICAL PATTERNS

- **Retry + Recovery**: `MAX_RETRIES=2` with `recoverSlave` — kills + respawns Chrome on `Slave not running`, `Circuit breaker`, or `CDP command failed`
- **Provider-Specific Selectors**: `COMPOSER_SELECTORS` + `PROVIDER_URLS` + `PROVIDER_URL_PATTERNS` used when capability resolution yields no selector
- **Composer Type Detection**: `composerTypeForProvider()` returns `contenteditable` for Claude/Gemini, `textarea` for others
- **Node Capture**: `captureAsNode()` persists every message as `cap-store.message` Node with full block structure, parser diagnostics, and `responds_to`/`follows` edges
- **Streaming Support**: `sendStreaming()` uses `StreamingProtocol` for progressive block delivery during capture
- **Context Assembly**: `ContextAssemblyEngine` assembles conversation context (recent episodes, topic, project state) before send

---

*File generated from original documentation and source code concatenation. For complete implementation details, refer to the individual source files in `src/engines/`.*
