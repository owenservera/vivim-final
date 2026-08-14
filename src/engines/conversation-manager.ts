// src/engines/conversation-manager.ts
// ConversationManager — orchestrates an 8-step send pipeline.
// RESOLVE → DERIVE SLAVE → LOCK → ENSURE → SEND → CAPTURE → PARSE → STORE+EMIT.

import { EngineError } from '../errors.js'
import { newId } from '../ids.js'
import { catchDebug } from '../lib/catch-logger.js'
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
import { MessageIdentity } from './message-identity.js'
import {
  COMPOSER_SELECTORS,
  findWorkingSelector,
  PROVIDER_URL_PATTERNS,
  PROVIDER_URLS,
} from './provider-selectors.js'
import type { StreamBlockStore } from './stream-block-store.js'
import type { StreamingProtocol } from './streaming-protocol.js'

// ── StreamParserEngine + shared parse types (real impl in stream-parser.ts) ─

import type { ContentBlock, ParseResult, StreamParserEngine } from './stream-parser.js'

export type {
  ContentBlock,
  ParseResult,
  ParserConfig,
  ParserModule,
  StreamParserEngine,
} from './stream-parser.js'

// ── Re-export real engine types ──────────────────────────────────────────

export { CapabilityEventBus } from './capability-event-bus.js'
export type { CapabilityResolutionEngine, ResolvedCapabilities } from './capability-resolution.js'
export type { StreamBlockStore } from './stream-block-store.js'

// ── Message Metadata Types ───────────────────────────────────────────────────

export interface MessageMetadataInput {
  isPinned?: number
  isArchived?: number
  readStatus?: string
}

// ── Local subset type for send pipeline ──────────────────────────────────

export interface ResolvedCapability {
  capabilityId: string
  selector: string
  label: string
  kind: string
  priority: number
  configJson: string
}

/** Unit 3.14 — context attached to a conversation before each send (04-merged-engines.md §Engine 2) */
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

// ── Types ──────────────────────────────────────────────────────────────────

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

// ── Helpers ────────────────────────────────────────────────────────────────

/** Best-effort composer type per provider when the endpoint manifest omits it. */
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

/** Provider-specific streaming API capture patterns (Unit 2.5) — loaded from DB via ProviderRegistry. */
import { getProviderRegistry } from '../config/provider-registry.js'

function getCapturePattern(providerId: string): RegExp | undefined {
  try {
    const raw = getProviderRegistry().getCapturePattern(providerId)
    return raw ? new RegExp(raw) : undefined
  } catch (e) {
    catchDebug(e, 'conversation-manager: regex compile')
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

// ── Context injection (unit 3.14) ─────────────────────────────────────────

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
      circuitState: slave.circuitState ?? 'closed',
    },
    capabilities: {
      total: resolved.total,
      available: resolved.composer.length,
    },
  }
}

// ── ConversationManager ────────────────────────────────────────────────────

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

  // Resolve the agent that owns a conversation's memory scope (spec 024 FR-005).
  // Agent threads use providerId='agent:<agentId>'; plain user conversations fall
  // back to the boot-provisioned 'system' agent.
  private resolveOwningAgentId(conv: ConversationRow): string {
    const prefix = 'agent:'
    if (conv.providerId.startsWith(prefix)) {
      return conv.providerId.slice(prefix.length)
    }
    return 'system'
  }

  // ── universal capture ── every message becomes a Node so the database is
  // fully compliant: nothing flowing through the system is dropped.
  // Captures ACU-proven fields (contentHash, version, state, acl, authorDid)
  // and links assistant→user to preserve the response fork.
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

    // Full block fidelity: store structured block data, not just text
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
          // Full block structure for graph-layer queries
          blocks: blocksSummary,
          // Parser diagnostics when available
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
    // [audit] log the error with context here
    return nodeId
  }

  // ── send: 8-step pipeline with retry (Units 2.x + 3.1, 3.5) ──────────────

  async send(conversationId: string, message: string): Promise<SendResult> {
    const MAX_RETRIES = 2
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await this.sendInternal(conversationId, message)
      } catch (err) {
        catchDebug(err, 'engines:conversation-manager:321')
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
    if (!conv.providerSessionId) return // No session to recover for history-synced conversations
    const account = await this.store.getAccount(conv.providerSessionId)
    if (!account) return
    const slaves = this.governor.getAllSlaves({ providerId: conv.providerId })
    for (const slave of slaves) {
      if (slave.accountId === account.id) {
        try {
          await this.governor.kill(slave.slaveId)
        } catch (e) {
          catchDebug(e, 'conversation-manager: governor kill')
        }
      }
    }
    // Use ensureRunningForAccount so the duplicate-instance guard in
    // FleetSupervisor.spawn prevents concurrent callers from spawning extras.
    try {
      await this.governor.ensureRunningForAccount(conv.providerId, account.id)
    } catch (e) {
      catchDebug(e, 'conversation-manager: ensure slave')
    }
  }

  private async sendInternal(conversationId: string, message: string): Promise<SendResult> {
    const totalStart = Date.now()
    const timing: StageTiming = {}

    try {
      // [1] RESOLVE
      let t0 = Date.now()
      const conv = await this.store.getConversation(conversationId)
      if (!conv) throw new EngineError(`Conversation not found: ${conversationId}`)
      if (!conv.providerSessionId)
        throw new EngineError(`No provider session for conversation: ${conversationId}`)
      const account = await this.store.getAccount(conv.providerSessionId)
      if (!account) throw new EngineError(`Account not found: ${conv.providerSessionId}`)
      timing.resolve = Date.now() - t0

      // [0] RECALL — retrieve relevant memory/context before execution
      t0 = Date.now()
      let memoryContext: AgentMemoryContext | undefined
      let assembledContext: AssembledContext | undefined
      if (this.contextAssembly) {
        try {
          assembledContext = await this.contextAssembly.assemble(conversationId, message)
          memoryContext = this.assembledToMemoryContext(assembledContext)
        } catch (e) {
          catchDebug(e, 'conversation-manager: context assembly')
        }
      } else if (this.memory) {
        try {
          memoryContext = await this.memory.getAgentContext(conv.providerId, '')
        } catch (e) {
          catchDebug(e, 'conversation-manager: memory recall')
        }
      }

      // FR-005 (spec 024): inject the active agent's frozen memory snapshot as the
      // identity layer so the provider sees stable per-agent context at send time.
      // The owning agent for a user conversation defaults to 'system' (provisioned
      // at boot); agent-spawned threads resolve via their bound agentId.
      if (this.memoryFabric && memoryContext) {
        try {
          const agentId = this.resolveOwningAgentId(conv)
          const snapshot = await this.memoryFabric.snapshotForSession(agentId)
          if (snapshot && snapshot.trim().length > 0) {
            memoryContext.identityContext = snapshot
          }
        } catch (e) {
          catchDebug(e, 'conversation-manager: snapshot injection')
        }
      }
      timing.recall = Date.now() - t0

      const planTier = account.planTier
      const cacheKey = `resolve:${conv.providerId}:${planTier}`
      const resolved = await this.memoizer.getOrCompute(
        cacheKey,
        () => this.resolution.resolve(conv.providerId, planTier as PlanTier),
        5_000,
      )

      // [2] DERIVE SLAVE — use account-based lookup with auto-spawn
      t0 = Date.now()
      const slave = await this.governor.ensureRunningForAccount(conv.providerId, account.id)
      const slaveId = slave.slaveId
      timing.ensure = Date.now() - t0

      // [2.5] VERIFY PAGE STATE (Unit 3.1) — ensure Chrome is on the right page
      const providerUrl = PROVIDER_URLS[conv.providerId]
      const pagePattern = PROVIDER_URL_PATTERNS[conv.providerId]
      try {
        const pageState = await this.governor.cdp.getPageState(slaveId)
        if (providerUrl && pageState.url && !pagePattern?.test(pageState.url)) {
          await this.governor.cdp.send(slaveId, 'Page.navigate', { url: providerUrl })
          await new Promise((r) => setTimeout(r, 3_000))
        }
      } catch (e) {
        catchDebug(e, 'conversation-manager: CDP pre-check')
      }

      // [1.5] INJECT CONTEXT — attach provider/account/chrome/capability/memory state to the conversation
      const context = buildConversationContext(conv, account, resolved, slave)
      if (memoryContext) {
        context.memory = memoryContext
      }
      await this.store.updateConversation(conversationId, {
        contextJson: JSON.stringify(context),
      })

      // [3] LOCK — CDPProxy mutex is handled inside ensureRunning

      // [5] SEND — build HarnessDAG for composer typing
      t0 = Date.now()
      const composerCap = resolved.composer[0] as unknown as {
        selector?: string
        sendSelector?: string
        composerType?: string
      }
      // Unit 3.2 + 3.6: adaptive selector with fallback chain
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

      // [5.5] PRE-CAPTURE — enable network monitoring before submit so the
      // streaming API request isn't missed (Unit 2.5).
      const capturePattern = CAPTURE_PATTERNS[conv.providerId] ?? /\/api\/conversation\//
      try {
        await this.governor.cdp.send(slaveId, 'Network.enable')
      } catch (e) {
        catchDebug(e, 'conversation-manager: Network.enable')
      }

      const sendResult = await this.governor.cdp.executeHarnessPlan(slaveId, dag)
      timing.type = Date.now() - t0

      if (!sendResult.success) {
        timing.total = Date.now() - totalStart
        return {
          ok: false,
          messageId: '',
          blocks: [],
          text: '',
          latencyMs: timing.total,
          timing,
          error: (sendResult as HarnessResult).error ?? 'Harness plan failed',
        }
      }

      // [6] CAPTURE — intercept streaming API response (provider-specific pattern)
      t0 = Date.now()
      let parseResult: ParseResult = {
        blocks: [],
        confidence: 0,
        parserName: '',
        parserVersion: 0,
        durationMs: 0,
        blockDiagnostics: {
          textBlocks: 0,
          toolCallBlocks: 0,
          fileBlocks: 0,
          errorBlocks: 0,
          reasoningBlocks: 0,
          codeBlocks: 0,
          sourceBlocks: 0,
        },
        wireFormat: 'unknown',
        fallbackDepth: 0,
        rawSizeBytes: 0,
      }
      let captureResult: { body?: string } | undefined
      try {
        captureResult = await this.governor.cdp.capture(slaveId, capturePattern, 60_000)
        timing.capture = Date.now() - t0

        // [7] PARSE
        t0 = Date.now()
        parseResult = await this.parser.parse(
          (captureResult as { body?: string }).body ?? '',
          conv.providerId,
        )
        timing.parse = Date.now() - t0
      } catch (e) {
        catchDebug(e, 'conversation-manager: CDP capture')
        timing.capture = Date.now() - t0
      }

      // [8] STORE + EMIT
      t0 = Date.now()

      // [8a] STORE USER MESSAGE (Unit 2.7 — was previously missing)
      const userMessageInput = {
        conversationId,
        role: 'user',
        content: message,
        blocksJson: JSON.stringify([{ type: 'text', text: message }]),
        blockCount: 1,
        latencyMs: 0,
      }

      // Generate identity hash for user message
      const userIdentityInput = MessageIdentity.fromMessageInput(
        userMessageInput,
        conv.providerId,
        account?.email || '',
      )
      const userIdentityHash = MessageIdentity.generate(userIdentityInput)

      // Check if user message already exists (deduplication)
      const existingUserMessage = await this.store.getMessageByIdentityHash(userIdentityHash)
      if (!existingUserMessage) {
        await this.store.createMessageWithIdentity({
          ...userMessageInput,
          identityHash: userIdentityHash,
        })
      }

      const assistantMessageInput = {
        conversationId,
        role: 'assistant',
        content: extractText(parseResult.blocks),
        blocksJson: JSON.stringify(parseResult.blocks),
        blockCount: parseResult.blocks.length,
        latencyMs: Date.now() - totalStart,
      }

      // Generate identity hash for assistant message
      const assistantIdentityInput = MessageIdentity.fromMessageInput(
        assistantMessageInput,
        conv.providerId,
        account?.email || '',
      )
      const assistantIdentityHash = MessageIdentity.generate(assistantIdentityInput)

      // Check if assistant message already exists (deduplication)
      const existingAssistantMessage =
        await this.store.getMessageByIdentityHash(assistantIdentityHash)
      const msgRow = existingAssistantMessage
        ? existingAssistantMessage
        : await this.store.createMessageWithIdentity({
            ...assistantMessageInput,
            identityHash: assistantIdentityHash,
          })

      // Store blocks with parser metadata for diagnostics
      const blockMeta: BlockMeta = {
        parserName: parseResult.parserName,
        parserVersion: parseResult.parserVersion,
        confidence: parseResult.confidence,
        wireFormat: parseResult.wireFormat,
      }
      await this.blocks.storeBlocks(conversationId, msgRow.id, parseResult.blocks, blockMeta)

      // Decompose blocks into ContentUnit rows for per-block storage
      if (this.contentUnitStore) {
        const units = decomposeToContentUnits(parseResult.blocks, conversationId, msgRow.id)
        await this.contentUnitStore.storeUnits(units).catch(() => {})
        // [audit] log the error with context here
      }

      // Universal capture — persist both messages as Nodes (fully compliant DB).
      // User node is captured first so the assistant node links to it (fork).
      const userNodeId = await this.captureAsNode(conversationId, msgRow.id, 'user', message, [
        { type: 'text', text: message },
      ])
      await this.captureAsNode(
        conversationId,
        msgRow.id,
        'assistant',
        (captureResult as { body?: string }).body ?? '',
        parseResult.blocks,
        userNodeId ?? undefined,
        parseResult,
      )

      await this.store.updateConversation(conversationId, {
        messageCount: conv.messageCount + 2,
        lastMessageAt: Date.now(),
      })

      timing.store = Date.now() - t0

      this.eventBus.emit({
        type: 'conversation:complete',
        conversationId,
        message: msgRow,
        // Full, canonical ContentPart[] — not a {text,kind} sliver. The
        // frontend renders from this immediately and treats loadHistory()
        // as reconciliation (upgrade doc Gap 2 / backend-patches.md §1).
        blocks: parseResult.blocks,
      })

      timing.total = Date.now() - totalStart

      // [9] REMEMBER — record episode and learn (best-effort, non-blocking)
      if (this.memory) {
        const durationMs = timing.total
        this.memory
          .recordEpisode({
            providerId: conv.providerId,
            action: 'send',
            input: { message },
            output: {
              text: extractText(parseResult.blocks),
              blockCount: parseResult.blocks.length,
            },
            success: true,
            durationMs,
            tags: ['conversation', conv.providerId],
          })
          .catch(() => {}) // fire-and-forget
        // [audit] log the error with context here
      }

      return {
        ok: true,
        messageId: msgRow.id,
        blocks: parseResult.blocks,
        text: extractText(parseResult.blocks),
        latencyMs: timing.total,
        timing,
      }
    } catch (err) {
      catchDebug(err, 'engines:conversation-manager:652')
      const error = err instanceof Error ? err.message : String(err)
      this.eventBus.emit({
        type: 'conversation:error',
        conversationId,
        error,
      })
      return {
        ok: false,
        messageId: '',
        blocks: [],
        text: '',
        latencyMs: Date.now() - totalStart,
        error,
      }
    }
  }

  // ── Streaming send (Unit 3.3) ───────────────────────────────────────────

  async sendStreaming(conversationId: string, message: string): Promise<SendResult> {
    const start = Date.now()
    const MAX_RETRIES = 2
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await this.sendStreamingInternal(conversationId, message, start)
      } catch (err) {
        catchDebug(err, 'engines:conversation-manager:678')
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
          latencyMs: Date.now() - start,
          error: msg,
        }
      }
    }
    return {
      ok: false,
      messageId: '',
      blocks: [],
      text: '',
      latencyMs: Date.now() - start,
      error: 'Unreachable',
    }
  }

  private async sendStreamingInternal(
    conversationId: string,
    message: string,
    start: number,
  ): Promise<SendResult> {
    // [1] RESOLVE
    const conv = await this.store.getConversation(conversationId)
    if (!conv) throw new EngineError(`Conversation not found: ${conversationId}`)
    if (!conv.providerSessionId)
      throw new EngineError(`No provider session for conversation: ${conversationId}`)
    const account = await this.store.getAccount(conv.providerSessionId)
    if (!account) throw new EngineError(`Account not found: ${conv.providerSessionId}`)

    const planTier = account.planTier
    const cacheKey = `resolve:${conv.providerId}:${planTier}`
    const resolved = await this.memoizer.getOrCompute(
      cacheKey,
      () => this.resolution.resolve(conv.providerId, planTier as PlanTier),
      5_000,
    )

    // [2] DERIVE SLAVE
    const slave = await this.governor.ensureRunningForAccount(conv.providerId, account.id)
    const slaveId = slave.slaveId

    // [5] SEND
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
    const composerType = (composerCap?.composerType ?? composerTypeForProvider(conv.providerId)) as
      | 'textarea'
      | 'contenteditable'
      | 'quill'
      | 'codemirror'

    // [5.5] PRE-CAPTURE
    const capturePattern = CAPTURE_PATTERNS[conv.providerId] ?? /\/api\/conversation\//
    try {
      await this.governor.cdp.send(slaveId, 'Network.enable')
    } catch (e) {
      catchDebug(e, 'conversation-manager: Network.enable (retry)')
    }

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

    const sendResult = await this.governor.cdp.executeHarnessPlan(slaveId, dag)
    if (!sendResult.success) {
      return {
        ok: false,
        messageId: '',
        blocks: [],
        text: '',
        latencyMs: Date.now() - start,
        error: (sendResult as HarnessResult).error ?? 'Harness plan failed',
      }
    }

    // [6] STREAM CAPTURE — use streamingProtocol if available, fallback to batch
    if (this.streamingProtocol) {
      const messageId = await this.streamingProtocol.startConversation(conversationId)
      // Progressive capture via Network events
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          cleanup()
          resolve()
        }, 60_000)

        const matchingRequests = new Set<string>()
        let lastBody = ''

        const responseHandler = (params: unknown) => {
          const event = params as { requestId?: string; response?: { url?: string } }
          if (event.response?.url && event.requestId && capturePattern.test(event.response.url)) {
            matchingRequests.add(event.requestId)
          }
        }

        const loadingFinishedHandler = async (params: unknown) => {
          const event = params as { requestId?: string }
          if (event.requestId && matchingRequests.has(event.requestId)) {
            try {
              const result = (await this.governor.cdp.send(slaveId, 'Network.getResponseBody', {
                requestId: event.requestId,
              })) as { body?: string }
              const body = result?.body ?? ''
              if (body.length > lastBody.length) {
                const newChunk = body.slice(lastBody.length)
                lastBody = body
                await this.streamingProtocol?.captureChunk(conversationId, messageId, newChunk)
              }
            } catch (e) {
              catchDebug(e, 'conversation-manager: body not ready')
            }
            cleanup()
            resolve()
          }
        }

        const cleanup = () => {
          clearTimeout(timer)
          // Event listeners will be GC'd when slave disconnects
        }

        // Register on the CDP client via send (proxy)
        // The CdpTransportImpl handles event registration internally
        void responseHandler
        void loadingFinishedHandler
        // For now, fall through to batch capture after a delay
        setTimeout(async () => {
          try {
            const result = await this.governor.cdp.capture(slaveId, capturePattern, 60_000)
            const body = (result as { body?: string }).body ?? ''
            if (body !== lastBody) {
              await this.streamingProtocol?.captureChunk(
                conversationId,
                messageId,
                body.slice(lastBody.length),
              )
            }
          } catch (e) {
            catchDebug(e, 'conversation-manager: capture failed')
          }
          cleanup()
          resolve()
        }, 30_000)
      })

      const finalBlocks = await this.streamingProtocol.finishConversation(conversationId, messageId)
      const msgRow = await this.store.createMessage({
        conversationId,
        role: 'user',
        content: message,
        blocksJson: JSON.stringify([{ type: 'text', text: message }]),
        blockCount: 1,
        latencyMs: 0,
      })
      await this.store.createMessage({
        conversationId,
        role: 'assistant',
        content: extractText(finalBlocks),
        blocksJson: JSON.stringify(finalBlocks),
        blockCount: finalBlocks.length,
        latencyMs: Date.now() - start,
      })
      return {
        ok: true,
        messageId: msgRow.id,
        blocks: finalBlocks,
        text: extractText(finalBlocks),
        latencyMs: Date.now() - start,
      }
    }

    // Fallback: batch capture (non-streaming)
    let parseResult: ParseResult = {
      blocks: [],
      confidence: 0,
      parserName: '',
      parserVersion: 0,
      durationMs: 0,
      blockDiagnostics: {
        textBlocks: 0,
        toolCallBlocks: 0,
        fileBlocks: 0,
        errorBlocks: 0,
        reasoningBlocks: 0,
        codeBlocks: 0,
        sourceBlocks: 0,
      },
      wireFormat: 'unknown',
      fallbackDepth: 0,
      rawSizeBytes: 0,
    }
    let rawBody = ''
    try {
      const captureResult = await this.governor.cdp.capture(slaveId, capturePattern, 60_000)
      rawBody = (captureResult as { body?: string }).body ?? ''
      parseResult = await this.parser.parse(rawBody, conv.providerId)
    } catch (e) {
      catchDebug(e, 'conversation-manager: CDP parse')
    }

    // Store
    await this.store.createMessage({
      conversationId,
      role: 'user',
      content: message,
      blocksJson: JSON.stringify([{ kind: 'text', content: message, index: 0 }]),
      blockCount: 1,
      latencyMs: 0,
    })
    const msgRow = await this.store.createMessage({
      conversationId,
      role: 'assistant',
      content: extractText(parseResult.blocks),
      blocksJson: JSON.stringify(parseResult.blocks),
      blockCount: parseResult.blocks.length,
      latencyMs: Date.now() - start,
    })
    // Store blocks with parser metadata for diagnostics
    const batchBlockMeta: BlockMeta = {
      parserName: parseResult.parserName,
      parserVersion: parseResult.parserVersion,
      confidence: parseResult.confidence,
      wireFormat: parseResult.wireFormat,
    }
    await this.blocks.storeBlocks(conversationId, msgRow.id, parseResult.blocks, batchBlockMeta)

    // Decompose blocks into ContentUnit rows for per-block storage
    if (this.contentUnitStore) {
      const units = decomposeToContentUnits(parseResult.blocks, conversationId, msgRow.id)
      await this.contentUnitStore.storeUnits(units).catch(() => {})
      // [audit] log the error with context here
    }

    // Universal capture — persist both messages as Nodes (fully compliant DB).
    // User node first so the assistant node links to it (fork).
    const streamUserNodeId = await this.captureAsNode(conversationId, msgRow.id, 'user', message, [
      { type: 'text', text: message },
    ])
    await this.captureAsNode(
      conversationId,
      msgRow.id,
      'assistant',
      rawBody,
      parseResult.blocks,
      streamUserNodeId ?? undefined,
      parseResult,
    )
    await this.store.updateConversation(conversationId, {
      messageCount: conv.messageCount + 2,
      lastMessageAt: Date.now(),
    })
    this.eventBus.emit({
      type: 'conversation:complete',
      conversationId,
      message: msgRow,
    })

    return {
      ok: true,
      messageId: msgRow.id,
      blocks: parseResult.blocks,
      text: extractText(parseResult.blocks),
      latencyMs: Date.now() - start,
    }
  }

  // ── Context assembly → memory context bridge ────────────────────────────

  private assembledToMemoryContext(assembled: AssembledContext): AgentMemoryContext {
    const episodes = assembled.layers.find((l) => l.name === 'recent_episodes')
    const topic = assembled.layers.find((l) => l.name === 'topic')
    const project = assembled.layers.find((l) => l.name === 'project_state')

    return {
      recentEpisodes: episodes
        ? [
            {
              id: '',
              providerId: '',
              action: episodes.content,
              input: {},
              output: {},
              success: true,
              durationMs: 0,
              timestamp: assembled.assembledAt,
              tags: [],
            },
          ]
        : [],
      relevantFacts: topic
        ? [
            {
              id: '',
              subject: 'context',
              predicate: 'topic',
              object: topic.content,
              confidence: 1,
              source: 'context-assembly',
              timestamp: assembled.assembledAt,
            },
          ]
        : [],
      applicableRules: project
        ? [
            {
              id: '',
              name: 'project_state',
              condition: '',
              action: project.content,
              confidence: 1,
              successCount: 0,
              failureCount: 0,
              createdAt: assembled.assembledAt,
              updatedAt: assembled.assembledAt,
            },
          ]
        : [],
    }
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────

  async createConversation(providerId: string, title?: string): Promise<ConversationRow> {
    const created = await this.store.createConversation({
      providerSessionId: `session_${providerId}_${Date.now()}`,
      providerId,
      title: title ?? null,
    })
    // P3-6: Emit conversation:created event so subscribers are notified.
    this.eventBus.emit({
      type: 'conversation:created',
      conversationId: created.id,
      providerId: created.providerId,
      accountId: created.accountId ?? '',
    })
    return created
  }

  async getConversation(id: string): Promise<ConversationRow> {
    const conv = await this.store.getConversation(id)
    if (!conv) throw new EngineError(`Conversation not found: ${id}`)
    return conv
  }

  async getMessages(
    conversationId: string,
    opts?: { limit?: number; before?: string },
  ): Promise<ConversationMessageRow[]> {
    return this.store.getMessages(conversationId, opts)
  }

  async truncate(conversationId: string, beforeMessageId: string): Promise<void> {
    const messages = await this.store.getMessages(conversationId)
    const idx = messages.findIndex((m) => m.id === beforeMessageId)
    if (idx <= 0) return
    const toDelete = messages.slice(0, idx)
    for (const msg of toDelete) {
      await this.store.deleteConversation(msg.id)
    }
  }

  // ── Message Metadata Methods ───────────────────────────────────────────────

  async pinMessage(messageId: string): Promise<void> {
    await this.store.updateMessageMetadata(messageId, { isPinned: 1 })
  }

  async unpinMessage(messageId: string): Promise<void> {
    await this.store.updateMessageMetadata(messageId, { isPinned: 0 })
  }

  async archiveMessage(messageId: string): Promise<void> {
    await this.store.updateMessageMetadata(messageId, { isArchived: 1 })
  }

  async unarchiveMessage(messageId: string): Promise<void> {
    await this.store.updateMessageMetadata(messageId, { isArchived: 0 })
  }

  async markMessageAsRead(messageId: string): Promise<void> {
    await this.store.updateMessageMetadata(messageId, { readStatus: 'read' })
  }

  async markMessageAsUnread(messageId: string): Promise<void> {
    await this.store.updateMessageMetadata(messageId, { readStatus: 'unread' })
  }

  async updateMessageMetadata(messageId: string, metadata: MessageMetadataInput): Promise<void> {
    await this.store.updateMessageMetadata(messageId, metadata)
  }

  async queryMessagesByMetadata(filters: {
    conversationId?: string
    isPinned?: number
    isArchived?: number
    readStatus?: string
  }): Promise<ConversationMessageRow[]> {
    return this.store.queryMessagesByMetadata(filters)
  }
}
