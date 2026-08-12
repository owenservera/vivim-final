// src/engines/opencode/opencode-ingest.ts
// OpenCodeIngest — projects served OpenCode events into the local DB (feature 027).
//
// Landing tables (reuse, no migration): AgentSession / AgentPermissionDecision /
// AgentFileEdit + durable EventRecord (hash-chained, source:'opencode').
// Session rendering reuses Option C chat methods (startAgentConversation/
// appendAgentMessage) -> ConversationMessage/StreamBlock.
// Governor owns permission decisions in-process (tier > 3 auto-denied).

import { catchDebug } from '../../lib/catch-logger.js'
import type { ContentBlock } from '../../schema/streaming.js'
import type { AgenticStoreContract } from '../../storage/contracts/agentic-store.js'
import type { EventRecordStore } from '../event-record-store.js'
import { parseOpencodeJson } from '../local-agent/local-agent-executor.js'
import type { OpenCodeClient } from './opencode-client.js'
import {
  type OpencodeEvent,
  type PermissionDecision,
  autoDenyTier,
  riskTierForTool,
} from './types.js'

const now = () => Date.now()

export interface OpenCodeIngestOptions {
  client: OpenCodeClient
  agenticStore: AgenticStoreContract
  eventRecordStore: EventRecordStore
  /** Hook for Governor assessment; defaults to in-process risk-tier rule. */
  assessPermission?: (tool: string | undefined) => { decision: PermissionDecision; tier: number }
}

export class OpenCodeIngest {
  private readonly client: OpenCodeClient
  private readonly store: AgenticStoreContract
  private readonly events: EventRecordStore
  private readonly assess: (tool: string | undefined) => {
    decision: PermissionDecision
    tier: number
  }
  private readonly seen = new Set<string>()
  /** Message IDs already projected from the serve transcript (per session). */
  private readonly projectedMessages = new Map<string, Set<string>>()
  /** v1.18.4: streamed text parts accumulate per partID until `session.idle`. */
  private readonly textByPart = new Map<string, string>()
  private threadBySession = new Map<
    string,
    { providerSessionId: string; conversationId: string; agentSessionId: string }
  >()
  /** F3: per-session denial log so cap:opencode:send can surface permissionDenied. */
  private readonly denialsBySession = new Map<
    string,
    Array<{ tool: string; tier: number; at: string }>
  >()

  constructor(opts: OpenCodeIngestOptions) {
    this.client = opts.client
    this.store = opts.agenticStore
    this.events = opts.eventRecordStore
    this.assess =
      opts.assessPermission ??
      ((tool) => {
        const tier = riskTierForTool(tool)
        return { decision: autoDenyTier(tier) ? 'deny' : 'allow', tier }
      })
  }

  /** Start ingesting a session: register landing rows, subscribe to SSE, project events. */
  async start(
    sessionId: string,
    meta: { model?: string; agentName?: string; projectPath?: string } = {},
  ): Promise<void> {
    const thread = await this.store.createOpencodeAgentSession({
      sessionId,
      model: meta.model,
      agentName: meta.agentName,
      projectPath: meta.projectPath,
    })
    this.threadBySession.set(sessionId, thread)
    // Subscribe is best-effort: the ingest layer can still receive events via
    // ingestEvent() even if SSE connection fails (e.g. in tests with mock clients).
    try {
      await this.client.subscribe(sessionId, (ev) => this.onEvent(sessionId, ev))
    } catch (err) {
      catchDebug(err, 'engines:opencode:opencode-ingest:74')
      // SSE subscribe failed — ingestEvent() still works for direct injection.
    }
  }

  /** Public event handler (also used by tests / non-SSE transports). */
  async ingestEvent(sessionId: string, ev: OpencodeEvent): Promise<void> {
    await this.onEvent(sessionId, ev)
  }

  async stop(sessionId: string): Promise<void> {
    this.threadBySession.delete(sessionId)
  }

  private async onEvent(sessionId: string, ev: OpencodeEvent): Promise<void> {
    // Durable capture first (hash-chained source of truth).
    await this.events
      .append({
        source: 'opencode',
        type: ev.type ?? 'unknown',
        providerSessionId: sessionId,
        payload: ev as unknown,
      })
      .catch(() => {})
  // [audit] log the error with context here

    const thread = this.threadBySession.get(sessionId)
    if (!thread) return

    try {
      switch (ev.type) {
        // --- opencode v1.18.4 events ---
        case 'message.part.delta': {
          // accumulate streaming text per partID
          if (ev.properties?.field === 'text' && typeof ev.properties.delta === 'string') {
            const pid = ev.properties.partID ?? 'text'
            this.textByPart.set(pid, (this.textByPart.get(pid) ?? '') + ev.properties.delta)
          }
          break
        }
        case 'session.idle':
          // Prefer the authoritative serve transcript (clean per-message text,
          // both roles, correct ordering). Falls back to delta accumulation if
          // the transcript fetch fails.
          await this.projectSessionTranscript(sessionId, thread.conversationId)
          break
        // --- opencode v1.17.15 events (legacy) ---
        case 'text':
        case 'step_start':
        case 'step_finish':
        case 'reasoning':
          await this.ingestMessage(thread.conversationId, ev)
          break
        case 'tool':
        case 'tool_use':
          await this.ingestTool(thread.agentSessionId, sessionId, ev)
          break
        case 'permission':
        case 'permission_request':
        case 'permission.asked':
          await this.ingestPermission(thread.agentSessionId, sessionId, ev)
          break
        case 'diff':
        case 'file_edit':
          await this.ingestFileEdit(thread.agentSessionId, ev)
          break
        case 'error':
          await this.ingestMessage(thread.conversationId, ev)
          break
        default:
          break
      }
    } catch (err) {
      catchDebug(err, 'engines:opencode:opencode-ingest:128')
      // never crash ingest on one bad event
    }
  }

  /**
   * Project the authoritative serve transcript (`GET /session/:id/message`) into
   * the conversation as clean user/assistant messages, keyed by serve message ID
   * so replayed `session.idle` events never duplicate rows. Falls back to
   * `flushAccumulatedText` (delta accumulation) when the fetch fails so tests and
   * non-SSE transports still land output.
   */
  private async projectSessionTranscript(sessionId: string, conversationId: string): Promise<void> {
    let messages: Array<Record<string, unknown>> = []
    try {
      messages = await this.client.getSessionMessages(sessionId)
    } catch (err) {
      catchDebug(err, 'engines:opencode:opencode-ingest:project:fetch')
      await this.flushAccumulatedText(conversationId, sessionId)
      return
    }
    if (!Array.isArray(messages) || messages.length === 0) {
      await this.flushAccumulatedText(conversationId, sessionId)
      return
    }

    const seen = this.projectedMessages.get(sessionId) ?? new Set<string>()
    this.projectedMessages.set(sessionId, seen)
    for (const rawMsg of messages) {
      const info = (rawMsg.info ?? {}) as {
        id?: string
        role?: string
        modelID?: string
      }
      const msgId = info.id
      if (!msgId || seen.has(msgId)) continue

      const parts = Array.isArray(rawMsg.parts)
        ? (rawMsg.parts as Array<Record<string, unknown>>)
        : []
      const text = parts
        .filter((p) => p.type === 'text' && typeof p.text === 'string')
        .map((p) => p.text as string)
        .join('\n')
      if (!text.trim()) {
        // Still mark as seen so we never re-project an empty (e.g. step-start-only) message.
        seen.add(msgId)
        continue
      }

      const role = info.role === 'user' ? 'user' : 'assistant'
      seen.add(msgId)
      await this.store.appendAgentMessage(conversationId, {
        role,
        text,
        model: info.modelID ?? undefined,
        blocks: [{ kind: 'text', data: { type: 'text', text } }],
      })
    }
    // Clear any live-streamed deltas now that the transcript has been projected.
    this.textByPart.clear()
  }

  /** Flush v1.18.4 streamed text (accumulated per part) as one assistant message. */
  private async flushAccumulatedText(conversationId: string, sessionId: string): Promise<void> {
    const texts = [...this.textByPart.values()].filter((t) => t.trim().length > 0)
    this.textByPart.clear()
    if (texts.length === 0) return
    const text = texts.join('\n')
    const key = `v18:${sessionId}:${texts.length}`
    if (this.seen.has(key)) return
    this.seen.add(key)
    await this.store.appendAgentMessage(conversationId, {
      role: 'assistant',
      text,
      blocks: [{ kind: 'text', data: { type: 'text', text } }],
    })
  }

  private async ingestMessage(conversationId: string, ev: OpencodeEvent): Promise<void> {
    const parsed = parseOpencodeJson(JSON.stringify(ev))
    const blocks: ContentBlock[] = parsed.blocks
    const text = blocks
      .filter((b) => b.type === 'text' || b.type === 'reasoning')
      .map((b) => (b as { text?: string }).text ?? '')
      .join('\n')
    const key = `msg:${ev.id ?? ev.sessionID ?? ''}:${conversationId}`
    if (ev.id && this.seen.has(key)) return
    if (ev.id) this.seen.add(key)
    await this.store.appendAgentMessage(conversationId, {
      role: 'assistant',
      text: text || '[event]',
      blocks: blocks.map((b) => ({ kind: b.type, data: b as unknown as Record<string, unknown> })),
    })
  }

  private async ingestTool(
    agentSessionId: string,
    sessionId: string,
    ev: OpencodeEvent,
  ): Promise<void> {
    const tool = ev.part?.tool ?? ev.toolName
    if (tool === 'invalid') {
      await this.respondDecision(agentSessionId, sessionId, ev, tool, 'deny', riskTierForTool(tool))
      return
    }
    await this.appendDecisionRow(
      agentSessionId,
      sessionId,
      ev,
      tool ?? 'unknown',
      riskTierForTool(tool),
      'allow',
    )
  }

  private async ingestPermission(
    agentSessionId: string,
    sessionId: string,
    ev: OpencodeEvent,
  ): Promise<void> {
    // v1.18.4 `permission.asked`: `{ type, properties: { id: ^per, sessionID, permission, patterns, ... } }`.
    // The permission/tool name and the `^per` request ID live in `properties`, NOT top-level.
    const tool = ev.properties?.permission ?? ev.toolName ?? ev.part?.tool
    const permissionId = ev.properties?.id ?? ev.permissionID
    const { decision, tier } = this.assess(tool)
    await this.respondDecision(
      agentSessionId,
      sessionId,
      ev,
      tool ?? 'unknown',
      decision,
      tier,
      permissionId,
    )
  }

  private async respondDecision(
    agentSessionId: string,
    sessionId: string,
    ev: OpencodeEvent,
    tool: string,
    decision: PermissionDecision,
    tier: number,
    permissionIdOverride?: string,
  ): Promise<void> {
    await this.appendDecisionRow(agentSessionId, sessionId, ev, tool, tier, decision)
    // v1.18.4: the path param must be the `^per` permission ID from
    // `properties.id`; `ev.id` is the `^evt_` event ID and would 400 on the
    // `^per` pattern check.
    const pid = permissionIdOverride ?? ev.permissionID ?? ev.id
    if (pid) {
      try {
        await this.client.respondPermission(sessionId, pid, decision)
      } catch (err) {
        catchDebug(err, 'engines:opencode:opencode-ingest:193')
        // best-effort POST back to OpenCode
      }
    }
  }

  private async appendDecisionRow(
    agentSessionId: string,
    sessionId: string,
    ev: OpencodeEvent,
    tool: string,
    tier: number,
    decision: PermissionDecision,
  ): Promise<void> {
    const providerPermissionId =
      ev.properties?.id ?? ev.permissionID ?? `${sessionId}:${tool}:${now()}`
    if (this.seen.has(`perm:${providerPermissionId}`)) return
    this.seen.add(`perm:${providerPermissionId}`)
    await this.store.appendAgentPermissionDecision({
      agentSessionId,
      providerPermissionId,
      toolName: tool,
      riskTier: tier,
      decision,
      payload: ev,
    })
    // F3: track denials per session so cap:opencode:send can surface permissionDenied
    if (decision === 'deny') {
      const list = this.denialsBySession.get(sessionId) ?? []
      list.push({ tool, tier, at: new Date().toISOString() })
      this.denialsBySession.set(sessionId, list)
    }
  }

  /** F3: Get denials recorded for a session (for cap:opencode:send output). */
  getDenialsForSession(sessionId: string): Array<{ tool: string; tier: number; at: string }> {
    return this.denialsBySession.get(sessionId) ?? []
  }

  /** F3: Clear denials for a session (call after the send handler has surfaced them). */
  clearDenialsForSession(sessionId: string): void {
    this.denialsBySession.delete(sessionId)
  }

  private async ingestFileEdit(agentSessionId: string, ev: OpencodeEvent): Promise<void> {
    const key = `edit:${ev.id ?? ev.filePath ?? ''}`
    if (this.seen.has(key)) return
    if (ev.id) this.seen.add(key)
    if (!ev.filePath) return
    await this.store.appendAgentFileEdit({
      agentSessionId,
      filePath: ev.filePath,
      patch: Array.isArray(ev.patch) ? ev.patch : [],
    })
  }
}
