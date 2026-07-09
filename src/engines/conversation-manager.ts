// src/engines/conversation-manager.ts
// ConversationManager — orchestrates an 8-step send pipeline.
// RESOLVE → DERIVE SLAVE → LOCK → ENSURE → SEND → CAPTURE → PARSE → STORE+EMIT.

import type {
  ConversationMessageRow,
  ConversationRow,
  ConversationStore,
  ProviderAccountRow,
} from '../storage/contracts/conversation-store.js'
import type { ChromeGovernor, ChromeSlave, HarnessDAG } from './chrome-governor.js'
import type { ExecutionMemoizer } from './execution-memoizer.js'

// ── Forward-declared interfaces (implemented in future phases) ────────────

/** Unit 4.3 — resolved capabilities for a provider+plan */
export interface ResolvedCapabilities {
  composer: ResolvedCapability[]
  header: ResolvedCapability[]
  message: ResolvedCapability[]
  sidebar: ResolvedCapability[]
  inline: ResolvedCapability[]
  total: number
  resolvedAt: number
}

export interface ResolvedCapability {
  capabilityId: string
  selector: string
  label: string
  kind: string
  priority: number
  configJson: string
}

/** Unit 4.3 — CapabilityResolutionEngine (stub interface) */
export interface CapabilityResolutionEngine {
  resolve(providerId: string, planTier: string): Promise<ResolvedCapabilities>
}

/** Unit 4.1 — StreamParserEngine (stub interface) */
export interface StreamParserEngine {
  parse(rawBody: string, providerId: string): Promise<ParseResult>
}

export interface ParseResult {
  blocks: ContentBlock[]
  confidence: number
  parserName: string
  parserVersion: number
  durationMs: number
}

export type ContentBlock =
  | { kind: 'text'; content: string; index: number }
  | { kind: 'thinking'; content: string; index: number }
  | { kind: 'code'; content: string; language?: string; index: number }
  | { kind: 'artifact'; content: string; artifactType?: string; index: number }
  | { kind: 'image'; url: string; alt?: string; index: number }
  | { kind: 'citation'; content: string; source?: string; index: number }
  | { kind: 'tool_use'; toolName: string; input: Record<string, unknown>; index: number }
  | { kind: 'error'; message: string; code?: string; index: number }
  | { kind: 'meta'; key: string; value: unknown; index: number }

/** Unit 3.7 — StreamBlockStore (stub interface) */
export interface StreamBlockStore {
  storeBlocks(conversationId: string, messageId: string, blocks: ContentBlock[]): Promise<void>
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
}

/** Unit 3.6 — CapabilityEventBus (stub interface) */
export interface CapabilityEventBus {
  emit(event: unknown): void
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface SendResult {
  ok: boolean
  messageId: string
  blocks: ContentBlock[]
  text: string
  latencyMs: number
  error?: string
}

// ── Helpers ────────────────────────────────────────────────────────────────

function deriveSlaveId(providerId: string, accountId: string): string {
  return `slave_${providerId}_${accountId}`
}

function extractText(blocks: ContentBlock[]): string {
  return blocks
    .filter((b): b is ContentBlock & { kind: 'text' } => b.kind === 'text')
    .map((b) => b.content)
    .join('')
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
      circuitState: slave.circuitState,
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
  ) {}

  // ── send: 8-step pipeline ───────────────────────────────────────────────

  async send(conversationId: string, message: string): Promise<SendResult> {
    const start = Date.now()

    try {
      // [1] RESOLVE
      const conv = await this.store.getConversation(conversationId)
      if (!conv) throw new Error(`Conversation not found: ${conversationId}`)
      const account = await this.store.getAccount(conv.providerSessionId)
      if (!account) throw new Error(`Account not found: ${conv.providerSessionId}`)

      const planTier = account.planTier
      const cacheKey = `resolve:${conv.providerId}:${planTier}`
      const resolved = await this.memoizer.getOrCompute(
        cacheKey,
        () => this.resolution.resolve(conv.providerId, planTier),
        5_000,
      )

      // [2] DERIVE SLAVE
      const slaveId = deriveSlaveId(conv.providerId, account.id)

      // [4] ENSURE — Governor's CDPProxy handles mutex internally; returns slave state
      const slave = await this.governor.ensureRunning(slaveId)

      // [1.5] INJECT CONTEXT — attach provider/account/chrome/capability state to the conversation
      const context = buildConversationContext(conv, account, resolved, slave)
      await this.store.updateConversation(conversationId, {
        contextJson: JSON.stringify(context),
      })

      // [3] LOCK — CDPProxy mutex is handled inside ensureRunning

      // [5] SEND — build HarnessDAG for composer typing
      const dag: HarnessDAG = {
        nodes: [
          {
            type: 'action',
            action: 'type_text',
            params: { text: message, selector: resolved.composer[0]?.selector ?? 'textarea' },
          },
          { type: 'action', action: 'submit', params: { key: 'Enter' } },
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
          error: sendResult.error ?? 'Harness plan failed',
        }
      }

      // [6] CAPTURE — intercept API response
      const captureResult = await this.governor.cdp.capture(
        slaveId,
        /\/api\/conversation\//,
        30_000,
      )

      // [7] PARSE
      const parseResult = await this.parser.parse(captureResult.body, conv.providerId)

      // [8] STORE + EMIT
      const msgRow = await this.store.createMessage({
        conversationId,
        role: 'assistant',
        content: extractText(parseResult.blocks),
        blocksJson: JSON.stringify(parseResult.blocks),
        blockCount: parseResult.blocks.length,
        latencyMs: Date.now() - start,
      })

      await this.blocks.storeBlocks(conversationId, msgRow.id, parseResult.blocks)

      await this.store.updateConversation(conversationId, {
        messageCount: conv.messageCount + 1,
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
    } catch (err) {
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
        latencyMs: Date.now() - start,
        error,
      }
    }
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────

  async createConversation(providerId: string, title?: string): Promise<ConversationRow> {
    return this.store.createConversation({
      providerSessionId: `session_${providerId}_${Date.now()}`,
      providerId,
      title: title ?? null,
    })
  }

  async getConversation(id: string): Promise<ConversationRow> {
    const conv = await this.store.getConversation(id)
    if (!conv) throw new Error(`Conversation not found: ${id}`)
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
}
