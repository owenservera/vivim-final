// src/engines/nlcl/executors/conversation-executor.ts
// ConversationExecutor — conversation lifecycle operations via ConversationManager.

import { newId } from '../../../ids.js'
import type { ConversationManager } from '../../conversation-manager.js'
import type { CommandExecutor, CommandResult, NLCContext, ParsedIntent } from '../types.js'

export class ConversationExecutor implements CommandExecutor {
  readonly id = 'conversation' as const

  constructor(private conversationManager?: ConversationManager) {}

  async execute(intent: ParsedIntent, ctx: NLCContext): Promise<CommandResult> {
    const start = Date.now()
    const traceId = newId()

    if (!this.conversationManager) {
      return this.fail(intent, traceId, start, 'ConversationManager not available')
    }

    try {
      switch (intent.intent) {
        case 'conversation.create':
          return await this.create(this.conversationManager, intent, ctx, traceId, start)
        case 'conversation.list':
          return await this.list(this.conversationManager, intent, ctx, traceId, start)
        case 'conversation.send':
          return await this.send(this.conversationManager, intent, ctx, traceId, start)
        case 'conversation.switch':
          return await this.switchProvider(this.conversationManager, intent, ctx, traceId, start)
        case 'conversation.messages':
          return await this.messages(this.conversationManager, intent, ctx, traceId, start)
        default:
          return this.fail(intent, traceId, start, `Unknown conversation intent: ${intent.intent}`)
      }
    } catch (err) {
      return this.fail(intent, traceId, start, err instanceof Error ? err.message : String(err))
    }
  }

  private async create(
    cm: ConversationManager,
    intent: ParsedIntent,
    ctx: NLCContext,
    traceId: string,
    start: number,
  ): Promise<CommandResult> {
    const providerId = (intent.input.providerId as string) ?? ctx.providerId ?? 'chatgpt'
    const title = intent.input.title as string | undefined
    const conv = await cm.createConversation(providerId, title)
    return {
      ok: true,
      intent: intent.intent,
      output: { conversationId: conv.id, providerId },
      text: `New ${providerId} conversation created`,
      latencyMs: Date.now() - start,
      traceId,
      classification: 'system',
    }
  }

  private async list(
    cm: ConversationManager,
    intent: ParsedIntent,
    _ctx: NLCContext,
    traceId: string,
    start: number,
  ): Promise<CommandResult> {
    const limit = (intent.input.limit as number) ?? 20
    const _convs = (await cm.getMessages) as unknown
    // Use store directly through conversationManager's store
    const store = (
      cm as unknown as {
        store: { listConversations?: (limit: number) => Promise<unknown[]> }
      }
    ).store
    const conversations = store?.listConversations ? await store.listConversations(limit) : []
    return {
      ok: true,
      intent: intent.intent,
      output: { conversations, count: Array.isArray(conversations) ? conversations.length : 0 },
      text: `${Array.isArray(conversations) ? conversations.length : 0} conversations`,
      latencyMs: Date.now() - start,
      traceId,
      classification: 'read',
    }
  }

  private async send(
    cm: ConversationManager,
    intent: ParsedIntent,
    ctx: NLCContext,
    traceId: string,
    start: number,
  ): Promise<CommandResult> {
    const conversationId = (intent.input.conversationId as string) ?? ctx.conversationId
    const message = intent.input.message as string

    if (!conversationId) {
      return this.fail(intent, traceId, start, 'No conversation specified')
    }
    if (!message) {
      return this.fail(intent, traceId, start, 'No message specified')
    }

    const result = await cm.send(conversationId, message)
    return {
      ok: result.ok,
      intent: intent.intent,
      output: { messageId: result.messageId, text: result.text, blocks: result.blocks },
      text: result.text || result.error || 'No response',
      error: result.error,
      latencyMs: Date.now() - start,
      traceId,
      classification: 'communication',
    }
  }

  private async switchProvider(
    cm: ConversationManager,
    intent: ParsedIntent,
    _ctx: NLCContext,
    traceId: string,
    start: number,
  ): Promise<CommandResult> {
    const providerId = intent.input.providerId as string
    if (!providerId) {
      return this.fail(intent, traceId, start, 'No provider specified')
    }
    const conv = await cm.createConversation(
      providerId,
      `Switched to ${providerId}`,
    )
    return {
      ok: true,
      intent: intent.intent,
      output: { conversationId: conv.id, providerId },
      text: `Switched to ${providerId}`,
      latencyMs: Date.now() - start,
      traceId,
      classification: 'navigate',
    }
  }

  private async messages(
    cm: ConversationManager,
    intent: ParsedIntent,
    ctx: NLCContext,
    traceId: string,
    start: number,
  ): Promise<CommandResult> {
    const conversationId = (intent.input.conversationId as string) ?? ctx.conversationId
    if (!conversationId) {
      return this.fail(intent, traceId, start, 'No conversation specified')
    }
    const limit = (intent.input.limit as number) ?? 50
    const messages = await cm.getMessages(conversationId, { limit })
    return {
      ok: true,
      intent: intent.intent,
      output: { messages, count: messages.length },
      text: `${messages.length} messages`,
      latencyMs: Date.now() - start,
      traceId,
      classification: 'read',
    }
  }

  private fail(intent: ParsedIntent, traceId: string, start: number, error: string): CommandResult {
    return {
      ok: false,
      intent: intent.intent,
      error,
      latencyMs: Date.now() - start,
      traceId,
      classification: 'system',
    }
  }
}
