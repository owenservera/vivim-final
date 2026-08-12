// web/ui/src/actions/agent-bridge.ts
// Unit 6.2 — AgentBridge: WebSocket command routing + result relay with timeout.

import { ActionRegistry } from './registry.js'

export interface AgentCommand {
  type: 'agent:command'
  actionId: string
  params: Record<string, unknown>
  correlationId: string
  targetSessionId?: string
}

export interface AgentResult {
  type: 'agent:result'
  correlationId: string
  ok: boolean
  data?: unknown
  error?: string
}

interface PendingRequest {
  resolve: (value: unknown) => void
  reject: (reason: Error) => void
  timer: ReturnType<typeof setTimeout>
}

const DEFAULT_TIMEOUT = 30_000

class AgentBridgeImpl {
  private ws: WebSocket | null = null
  private sessionId: string | null = null
  private pending = new Map<string, PendingRequest>()
  private eventListeners = new Set<(event: Record<string, unknown>) => void>()

  initialize(websocket: WebSocket, sessionId: string): void {
    this.ws = websocket
    this.sessionId = sessionId

    websocket.onopen = () => {
      websocket.send(
        JSON.stringify({
          type: 'hello',
          role: 'frontend',
          sessionId,
        }),
      )
    }

    websocket.onmessage = (ev: MessageEvent) => {
      this.handleMessage(ev.data as string)
    }

    websocket.onclose = () => {
      for (const [, req] of this.pending) {
        clearTimeout(req.timer)
        req.reject(new Error('WebSocket closed'))
      }
      this.pending.clear()
    }
  }

  async sendCommand(
    targetSessionId: string,
    actionId: string,
    params: Record<string, unknown>,
    timeoutMs = DEFAULT_TIMEOUT,
  ): Promise<unknown> {
    if (!this.ws) throw new Error('AgentBridge not initialized')

    const correlationId = `corr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(correlationId)
        reject(new Error(`Command timed out after ${timeoutMs}ms`))
      }, timeoutMs)

      this.pending.set(correlationId, { resolve, reject, timer })

      this.ws!.send(
        JSON.stringify({
          type: 'agent:command',
          targetSessionId,
          actionId,
          params,
          correlationId,
        }),
      )
    })
  }

  private handleMessage(raw: string): void {
    try {
      const msg = JSON.parse(raw)

      switch (msg.type) {
        case 'agent:command':
          this.handleCommand(msg)
          break
        case 'agent:result':
          this.handleResult(msg)
          break
        case 'agent:discover':
          this.handleDiscover(msg)
          break
        case 'conversation:block':
        case 'conversation:complete':
        case 'conversation:error':
          this.eventListeners.forEach((fn) => fn(msg))
          break
      }
    } catch (err) {
      // [audit] removed: console.error('[AgentBridge] Parse error:', err)
    }
  }

  private async handleCommand(msg: AgentCommand): Promise<void> {
    try {
      const result = await ActionRegistry.dispatch(msg.actionId, msg.params)
      this.sendResult({ ok: true, data: result }, msg.correlationId)
    } catch (err) {
      this.sendResult(
        {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        },
        msg.correlationId,
      )
    }
  }

  private handleResult(msg: AgentResult): void {
    const pending = this.pending.get(msg.correlationId)
    if (!pending) return

    clearTimeout(pending.timer)
    this.pending.delete(msg.correlationId)

    if (msg.ok) {
      pending.resolve(msg.data)
    } else {
      pending.reject(new Error(msg.error ?? 'Unknown error'))
    }
  }

  private handleDiscover(msg: { correlationId: string }): void {
    const catalog = ActionRegistry.listWithMetadata()
    this.sendResult({ ok: true, data: catalog }, msg.correlationId)
  }

  private sendResult(
    result: Omit<AgentResult, 'type' | 'correlationId'>,
    correlationId: string,
  ): void {
    if (!this.ws) return
    this.ws.send(
      JSON.stringify({
        type: 'agent:result',
        correlationId,
        ...result,
      }),
    )
  }

  onEvent(fn: (event: Record<string, unknown>) => void): () => void {
    this.eventListeners.add(fn)
    return () => this.eventListeners.delete(fn)
  }
}

export const AgentBridge = new AgentBridgeImpl()
