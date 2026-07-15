// src/engines/nlcl/executors/provider-llm-executor.ts
// ProviderLLMExecutor — delegates to user's provider LLM (ChatGPT/Claude/Gemini)
// via the existing ConversationManager + ChromeGovernor harness.
// This is the "send to chatgpt.com and return response" executor.
// NO local AI — uses the user's already-logged-in provider session.

import { newId } from '../../../ids.js'
import type { ConversationStore } from '../../../storage/contracts/conversation-store.js'
import type { ConversationManager } from '../../conversation-manager.js'
import type { CommandExecutor, CommandResult, NLCContext, ParsedIntent } from '../types.js'

export class ProviderLLMExecutor implements CommandExecutor {
  readonly id = 'provider-llm' as const

  constructor(
    private conversationManager?: ConversationManager,
    private conversationStore?: ConversationStore,
  ) {}

  async execute(intent: ParsedIntent, ctx: NLCContext): Promise<CommandResult> {
    const start = Date.now()
    const traceId = newId()

    try {
      const prompt = this.buildPrompt(intent, ctx)
      if (!prompt) {
        return this.fail(intent, traceId, start, 'Could not build prompt from command')
      }

      const providerId = (intent.input.providerId as string) ?? ctx.providerId
      if (!providerId) {
        return this.fail(intent, traceId, start, 'No provider specified')
      }

      if (!this.conversationManager) {
        return this.fail(intent, traceId, start, 'ConversationManager not available')
      }

      let conversationId = ctx.conversationId
      if (!conversationId && this.conversationStore) {
        const conv = await this.conversationManager.createConversation(
          providerId,
          `NLCL: ${prompt.slice(0, 50)}`,
        )
        conversationId = conv.id
      }

      if (!conversationId) {
        return this.fail(intent, traceId, start, 'No conversation available')
      }

      const result = await this.conversationManager.send(conversationId, prompt)

      return {
        ok: result.ok,
        intent: intent.intent,
        output: {
          providerId,
          conversationId,
          messageId: result.messageId,
          response: result.text,
          blocks: result.blocks,
        },
        text: result.text || result.error || 'No response',
        error: result.error,
        latencyMs: Date.now() - start,
        traceId,
        classification: 'communication',
        followUp: result.ok ? undefined : 'Provider may be unavailable. Try a different provider.',
      }
    } catch (err) {
      return this.fail(intent, traceId, start, err instanceof Error ? err.message : String(err))
    }
  }

  private buildPrompt(intent: ParsedIntent, _ctx: NLCContext): string {
    const action = intent.intent
    const input = intent.input

    switch (action) {
      case 'provider.query':
      case 'llm.ask': {
        return (
          (input.prompt as string) ?? (input.query as string) ?? (input.message as string) ?? ''
        )
      }

      case 'llm.summarize': {
        const content = input.content as string
        const topic = input.topic as string | undefined
        if (content) {
          return topic
            ? `Please summarize the following content, focusing on ${topic}:\n\n${content}`
            : `Please summarize the following content:\n\n${content}`
        }
        return topic
          ? `Please summarize the latest news about ${topic}`
          : 'Please summarize the current page content'
      }

      case 'llm.translate': {
        const text = input.text as string
        const targetLang = input.targetLanguage as string
        const sourceLang = input.sourceLanguage as string | undefined
        const sourcePart = sourceLang ? `from ${sourceLang} ` : ''
        return `Please translate the following ${sourcePart}to ${targetLang}:\n\n${text}`
      }

      case 'llm.explain': {
        const topic = input.topic as string
        const content = input.content as string | undefined
        return content ? `Please explain this:\n\n${content}` : `Please explain ${topic}`
      }

      case 'llm.rewrite': {
        const text = input.text as string
        const style = input.style as string | undefined
        return style
          ? `Please rewrite the following in a ${style} style:\n\n${text}`
          : `Please rewrite the following:\n\n${text}`
      }

      case 'llm.code': {
        const task = input.task as string
        const language = input.language as string | undefined
        return language ? `Write ${language} code that: ${task}` : `Write code that: ${task}`
      }

      case 'browser.summarize':
      case 'web.summarize': {
        const url = input.url as string | undefined
        const content = input.content as string | undefined
        if (content) {
          return `Please summarize the following web page content:\n\n${content}`
        }
        return url
          ? `Please read and summarize the content from ${url}`
          : 'Please summarize the current page'
      }

      default: {
        const raw = (input.raw as string) ?? (input.prompt as string) ?? intent.rawInput
        return raw
      }
    }
  }

  private fail(intent: ParsedIntent, traceId: string, start: number, error: string): CommandResult {
    return {
      ok: false,
      intent: intent.intent,
      error,
      latencyMs: Date.now() - start,
      traceId,
      classification: 'communication',
    }
  }
}
