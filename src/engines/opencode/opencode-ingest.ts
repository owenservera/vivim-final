// src/engines/opencode/opencode-ingest.ts
// OpenCodeIngest — projects served OpenCode events into the local DB (feature 027).
//
// Landing tables (reuse, no migration): AgentSession / AgentPermissionDecision /
// AgentFileEdit + durable EventRecord (hash-chained, source:'opencode').
// Session rendering reuses Option C chat methods (startAgentConversation/
// appendAgentMessage) -> ConversationMessage/StreamBlock.
// Governor owns permission decisions in-process (tier > 3 auto-denied).

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
  private threadBySession = new Map<
    string,
    { providerSessionId: string; conversationId: string; agentSessionId: string }
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
    } catch {
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

    const thread = this.threadBySession.get(sessionId)
    if (!thread) return

    try {
      switch (ev.type) {
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
    } catch {
      // never crash ingest on one bad event
    }
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
    const tool = ev.toolName ?? ev.part?.tool
    const { decision, tier } = this.assess(tool)
    await this.respondDecision(agentSessionId, sessionId, ev, tool ?? 'unknown', decision, tier)
  }

  private async respondDecision(
    agentSessionId: string,
    sessionId: string,
    ev: OpencodeEvent,
    tool: string,
    decision: PermissionDecision,
    tier: number,
  ): Promise<void> {
    await this.appendDecisionRow(agentSessionId, sessionId, ev, tool, tier, decision)
    const pid = ev.permissionID ?? ev.id
    if (pid) {
      try {
        await this.client.respondPermission(sessionId, pid, decision)
      } catch {
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
    const providerPermissionId = ev.permissionID ?? ev.id ?? `${sessionId}:${tool}:${now()}`
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
