import { ActionRegistry } from './registry.js'

export interface WsLike {
  send(data: string): void
  close(): void
  onmessage?: (ev: MessageEvent) => void
}

let ws: WsLike | null = null

export interface AgentCommand {
  actionId: string
  params: Record<string, unknown>
  correlationId: string
}

export interface AgentResult {
  ok: boolean
  data?: unknown
  error?: string
}

export const AgentBridge = {
  initialize(websocket: WsLike, sessionId: string) {
    ws = websocket
    ws.send(JSON.stringify({
      type: 'hello',
      role: 'frontend',
      sessionId,
    }))
  },

  sendResult(result: AgentResult, correlationId: string) {
    if (!ws) return
    ws.send(JSON.stringify({
      type: 'agent:result',
      correlationId,
      ...result,
    }))
  },

  handleAgentCommand(raw: string) {
    try {
      const msg = JSON.parse(raw)
      if (msg.type === 'agent:command') {
        const cmd = msg as AgentCommand
        ActionRegistry.dispatch(cmd.actionId, cmd.params)
          .then(() => {
            this.sendResult({ ok: true }, cmd.correlationId)
          })
          .catch((err) => {
            this.sendResult({ ok: false, error: err.message }, cmd.correlationId)
          })
      } else if (msg.type === 'agent:discover') {
        const catalog = ActionRegistry.listWithMetadata()
        this.sendResult({ ok: true, data: catalog }, msg.correlationId)
      }
    } catch (err) {
      console.error('AgentBridge parse error:', err)
    }
  },
}