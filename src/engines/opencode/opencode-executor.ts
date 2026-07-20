// src/engines/opencode/opencode-executor.ts
// OpenCodeExecutor — NLCL executor for OpenCode `serve` operations.
// Handles intents: opencode.send, opencode.session.create, opencode.session.list,
// opencode.permission.respond. Uses OpenCodeClient for HTTP calls, OpenCodeIngest
// for event projection. Collects SSE response blocks with 30s timeout.

import { newId } from '../../ids.js'
import type { ContentBlock } from '../../schema/streaming.js'
import type { CommandExecutor, CommandResult, NLCContext, ParsedIntent } from '../nlcl/types.js'
import type { OpenCodeClient } from './opencode-client.js'
import type { OpenCodeIngest } from './opencode-ingest.js'
import type { OpencodeEvent } from './types.js'

const SEND_TIMEOUT_MS = 30_000

export interface OpenCodeExecutorOptions {
  client: OpenCodeClient
  ingest: OpenCodeIngest
}

export class OpenCodeExecutor implements CommandExecutor {
  readonly id = 'opencode' as const
  private readonly client: OpenCodeClient
  private readonly ingest: OpenCodeIngest

  constructor(opts: OpenCodeExecutorOptions) {
    this.client = opts.client
    this.ingest = opts.ingest
  }

  async execute(intent: ParsedIntent, _ctx: NLCContext): Promise<CommandResult> {
    const start = Date.now()
    const traceId = newId()

    try {
      switch (intent.intent) {
        case 'opencode.send':
          return await this.handleSend(intent, traceId, start)
        case 'opencode.session.create':
          return await this.handleSessionCreate(intent, traceId, start)
        case 'opencode.session.list':
          return await this.handleSessionList(intent, traceId, start)
        case 'opencode.permission.respond':
          return await this.handlePermissionRespond(intent, traceId, start)
        default:
          return this.fail(traceId, start, `Unknown opencode intent: ${intent.intent}`)
      }
    } catch (err) {
      return this.fail(traceId, start, err instanceof Error ? err.message : String(err))
    }
  }

  private async handleSend(
    intent: ParsedIntent,
    traceId: string,
    start: number,
  ): Promise<CommandResult> {
    const prompt = (intent.input.prompt as string) ?? ''
    if (!prompt.trim()) {
      return this.fail(traceId, start, 'prompt is required')
    }

    const sessionId = intent.input.sessionId as string | undefined
    const model = intent.input.model as string | undefined

    // 1. Resolve or create session
    let resolvedSessionId = sessionId
    if (!resolvedSessionId) {
      const { sessionId: newId } = await this.client.createSession({ model })
      resolvedSessionId = newId
    }

    // 2. Start ingest (registers thread + subscribes SSE)
    await this.ingest.start(resolvedSessionId, { model })

    // 3. Send prompt
    await this.client.sendPrompt(resolvedSessionId, prompt)

    // 4. Collect response blocks via direct SSE subscription
    const blocks: ContentBlock[] = []
    let text = ''
    const done = new Promise<void>((resolve) => {
      const timer = setTimeout(() => resolve(), SEND_TIMEOUT_MS)
      void this.client
        .subscribe(resolvedSessionId!, (ev: OpencodeEvent) => {
          if (ev.type === 'step_finish' || ev.type === 'done') {
            clearTimeout(timer)
            resolve()
          }
          if (ev.type === 'text' && ev.part?.text) {
            text += ev.part.text
            blocks.push({ type: 'text', text: ev.part.text })
          }
          if (ev.type === 'error') {
            clearTimeout(timer)
            resolve()
          }
        })
        .then((unsub) => {
          // Auto-cleanup on timeout — unsub called after resolve
          void unsub
        })
    })
    await done

    return {
      ok: blocks.length > 0 || text.length > 0,
      intent: intent.intent,
      output: {
        sessionId: resolvedSessionId,
        blocks,
        text,
      },
      text: text || 'No response from OpenCode',
      latencyMs: Date.now() - start,
      traceId,
      classification: 'communication',
    }
  }

  private async handleSessionCreate(
    intent: ParsedIntent,
    traceId: string,
    start: number,
  ): Promise<CommandResult> {
    const model = intent.input.model as string | undefined
    const cwd = intent.input.cwd as string | undefined

    const { sessionId } = await this.client.createSession({ model, cwd })

    return {
      ok: true,
      intent: intent.intent,
      output: { sessionId },
      text: `Session created: ${sessionId}`,
      latencyMs: Date.now() - start,
      traceId,
      classification: 'system',
    }
  }

  private async handleSessionList(
    _intent: ParsedIntent,
    traceId: string,
    start: number,
  ): Promise<CommandResult> {
    // Session list is best-effort — ingest tracks active sessions in memory
    return {
      ok: true,
      intent: _intent.intent,
      output: { sessions: [] },
      text: 'Session listing requires the ingest layer to be active.',
      latencyMs: Date.now() - start,
      traceId,
      classification: 'read',
    }
  }

  private async handlePermissionRespond(
    intent: ParsedIntent,
    traceId: string,
    start: number,
  ): Promise<CommandResult> {
    const sessionId = intent.input.sessionId as string
    const permissionId = intent.input.permissionId as string
    const decision = intent.input.decision as 'allow' | 'deny' | 'allow_always'

    if (!sessionId || !permissionId || !decision) {
      return this.fail(traceId, start, 'sessionId, permissionId, and decision are required')
    }

    await this.client.respondPermission(sessionId, permissionId, decision)

    return {
      ok: true,
      intent: intent.intent,
      output: { sessionId, permissionId, decision },
      text: `Permission ${decision}: ${permissionId}`,
      latencyMs: Date.now() - start,
      traceId,
      classification: 'system',
    }
  }

  private fail(traceId: string, start: number, error: string): CommandResult {
    return {
      ok: false,
      intent: 'opencode',
      error,
      latencyMs: Date.now() - start,
      traceId,
      classification: 'communication',
    }
  }
}
