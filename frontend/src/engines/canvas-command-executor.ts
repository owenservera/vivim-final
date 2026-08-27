/**
 * engines/canvas-command-executor.ts
 * --------------------------------------------------------------------
 * Executes AgentCanvasCommand against the LivingCanvas via EventBus.
 * Validates policy, emits events, returns responses.
 */

import { CanvasEventType, getCanvasEventBus } from '@/components/canvas/event-bus'
import { ulid } from '@/lib/ulid'
import type {
  AgentCanvasCommand,
  AgentCanvasPolicy,
  AgentCanvasResponse,
  CanvasState,
} from '@/shared/agent-canvas'

export class CanvasCommandExecutor {
  private policy: AgentCanvasPolicy
  private workspaceId: string
  private agentId: string
  private pendingConfirmations = new Map<
    string,
    {
      command: AgentCanvasCommand
      resolve: (approved: boolean) => void
      timer?: ReturnType<typeof setTimeout>
    }
  >()

  constructor(policy: AgentCanvasPolicy) {
    this.policy = policy
    this.workspaceId = policy.workspaceId
    this.agentId = policy.agentId
  }

  /** Execute a command, returning the response. */
  async execute(command: AgentCanvasCommand): Promise<AgentCanvasResponse> {
    // 1. Validate command allowed
    if (!this.policy.allowedCommands.includes(command.type)) {
      return this.error(
        'COMMAND_NOT_ALLOWED',
        `Command ${command.type} not permitted for this agent`,
      )
    }

    // 2. Check confirmation required
    if (this.policy.requireConfirmation.includes(command.type)) {
      const confirmationId = ulid()
      const approved = await this.requestConfirmation(confirmationId, command)
      if (!approved) {
        return this.error('CONFIRMATION_DENIED', 'User denied confirmation for this command')
      }
    }

    // 3. Route to handler
    try {
      switch (command.type) {
        case 'canvas.createNode':
          return await this.handleCreateNode(command)
        case 'canvas.deleteNode':
          return await this.handleDeleteNode(command)
        case 'canvas.moveNode':
          return await this.handleMoveNode(command)
        case 'canvas.connectNodes':
          return await this.handleConnectNodes(command)
        case 'canvas.disconnectNodes':
          return await this.handleDisconnectNodes(command)
        case 'canvas.runLayout':
          return await this.handleRunLayout(command)
        case 'canvas.startStream':
          return await this.handleStartStream(command)
        case 'canvas.stopStream':
          return await this.handleStopStream(command)
        case 'canvas.setViewport':
          return await this.handleSetViewport(command)
        case 'canvas.focusNode':
          return await this.handleFocusNode(command)
        case 'canvas.getState':
          return await this.handleGetState(command)
        default:
          return this.error('UNKNOWN_COMMAND', 'Unknown command type')
      }
    } catch (err) {
      return this.error('EXECUTION_ERROR', err instanceof Error ? err.message : 'Unknown error')
    }
  }

  /** Request user confirmation via EventBus. */
  private requestConfirmation(
    confirmationId: string,
    command: AgentCanvasCommand,
  ): Promise<boolean> {
    return new Promise((resolve) => {
      // Timeout after 30s
      const timer = setTimeout(() => {
        if (this.pendingConfirmations.has(confirmationId)) {
          this.pendingConfirmations.delete(confirmationId)
          resolve(false)
        }
      }, 30000)

      this.pendingConfirmations.set(confirmationId, { command, resolve, timer })
      const bus = getCanvasEventBus()
      bus.emit(CanvasEventType.AGENT_CONFIRMATION_REQUESTED, {
        confirmationId,
        agentId: this.agentId,
        command,
        timestamp: Date.now(),
      })
    })
  }

  /** Handle confirmation response from UI. */
  handleConfirmationResponse(confirmationId: string, approved: boolean): void {
    const entry = this.pendingConfirmations.get(confirmationId)
    if (entry) {
      if (entry.timer) clearTimeout(entry.timer)
      this.pendingConfirmations.delete(confirmationId)
      entry.resolve(approved)
    }
  }

  // ── Command Handlers ─────────────────────────────────────────────────────

  private async handleCreateNode(
    cmd: Extract<AgentCanvasCommand, { type: 'canvas.createNode' }>,
  ): Promise<AgentCanvasResponse> {
    const { slotId, providerId, position, config } = cmd.payload

    // Validate slot allowed
    if (!this.policy.allowedSlots.includes(slotId)) {
      return this.error('SLOT_NOT_ALLOWED', `Slot ${slotId} not permitted for this agent`)
    }

    // Validate provider allowed
    if (providerId && !this.policy.allowedProviders.includes(providerId)) {
      return this.error(
        'PROVIDER_NOT_ALLOWED',
        `Provider ${providerId} not permitted for this agent`,
      )
    }

    const nodeId = `agent:${this.agentId}:${ulid()}`
    const bus = getCanvasEventBus()

    bus.emit(CanvasEventType.AGENT_CREATE_NODE, {
      nodeId,
      slotId,
      providerId,
      position: position ?? { x: 100, y: 100 },
      config: config ?? {},
      agentId: this.agentId,
      workspaceId: this.workspaceId,
    })

    return { type: 'canvas.nodeCreated', payload: { nodeId, slotId, providerId } }
  }

  private async handleDeleteNode(
    cmd: Extract<AgentCanvasCommand, { type: 'canvas.deleteNode' }>,
  ): Promise<AgentCanvasResponse> {
    const { nodeId } = cmd.payload
    const bus = getCanvasEventBus()
    bus.emit(CanvasEventType.AGENT_DELETE_NODE, {
      nodeId,
      agentId: this.agentId,
      workspaceId: this.workspaceId,
    })
    return { type: 'canvas.nodeDeleted', payload: { nodeId } }
  }

  private async handleMoveNode(
    cmd: Extract<AgentCanvasCommand, { type: 'canvas.moveNode' }>,
  ): Promise<AgentCanvasResponse> {
    const { nodeId, x, y } = cmd.payload
    const bus = getCanvasEventBus()
    bus.emit(CanvasEventType.AGENT_MOVE_NODE, {
      nodeId,
      x,
      y,
      agentId: this.agentId,
      workspaceId: this.workspaceId,
    })
    return { type: 'canvas.nodesMoved', payload: [{ nodeId, x, y }] }
  }

  private async handleConnectNodes(
    cmd: Extract<AgentCanvasCommand, { type: 'canvas.connectNodes' }>,
  ): Promise<AgentCanvasResponse> {
    const { fromNodeId, toNodeId } = cmd.payload
    const bus = getCanvasEventBus()
    bus.emit(CanvasEventType.AGENT_CONNECT_NODES, {
      fromNodeId,
      toNodeId,
      agentId: this.agentId,
      workspaceId: this.workspaceId,
    })
    return { type: 'canvas.nodesConnected', payload: { fromNodeId, toNodeId } }
  }

  private async handleDisconnectNodes(
    cmd: Extract<AgentCanvasCommand, { type: 'canvas.disconnectNodes' }>,
  ): Promise<AgentCanvasResponse> {
    const { fromNodeId, toNodeId } = cmd.payload
    const bus = getCanvasEventBus()
    bus.emit(CanvasEventType.AGENT_DISCONNECT_NODES, {
      fromNodeId,
      toNodeId,
      agentId: this.agentId,
      workspaceId: this.workspaceId,
    })
    return { type: 'canvas.nodesDisconnected', payload: { fromNodeId, toNodeId } }
  }

  private async handleRunLayout(
    cmd: Extract<AgentCanvasCommand, { type: 'canvas.runLayout' }>,
  ): Promise<AgentCanvasResponse> {
    const { intent, params } = cmd.payload
    const bus = getCanvasEventBus()
    bus.emit(CanvasEventType.AGENT_RUN_LAYOUT, {
      intent,
      params,
      agentId: this.agentId,
      workspaceId: this.workspaceId,
    })
    return { type: 'canvas.layoutApplied', payload: { intent, positions: {} } }
  }

  private async handleStartStream(
    cmd: Extract<AgentCanvasCommand, { type: 'canvas.startStream' }>,
  ): Promise<AgentCanvasResponse> {
    const { nodeId, capabilityId, input } = cmd.payload

    // Check concurrent stream limit
    const bus = getCanvasEventBus()
    const state = await this.getCurrentState()
    const activeStreams = state.streams.length
    if (activeStreams >= this.policy.maxConcurrentStreams) {
      return this.error(
        'STREAM_LIMIT_EXCEEDED',
        `Max ${this.policy.maxConcurrentStreams} concurrent streams allowed`,
      )
    }

    bus.emit(CanvasEventType.AGENT_START_STREAM, {
      nodeId,
      capabilityId,
      input,
      agentId: this.agentId,
      workspaceId: this.workspaceId,
    })
    const sessionId = `stream:${ulid()}`
    return { type: 'canvas.streamStarted', payload: { nodeId, sessionId } }
  }

  private async handleStopStream(
    cmd: Extract<AgentCanvasCommand, { type: 'canvas.stopStream' }>,
  ): Promise<AgentCanvasResponse> {
    const { nodeId } = cmd.payload
    const bus = getCanvasEventBus()
    bus.emit(CanvasEventType.AGENT_STOP_STREAM, {
      nodeId,
      agentId: this.agentId,
      workspaceId: this.workspaceId,
    })
    return { type: 'canvas.streamStopped', payload: { nodeId } }
  }

  private async handleSetViewport(
    cmd: Extract<AgentCanvasCommand, { type: 'canvas.setViewport' }>,
  ): Promise<AgentCanvasResponse> {
    const { x, y, zoom } = cmd.payload
    const bus = getCanvasEventBus()
    bus.emit(CanvasEventType.AGENT_SET_VIEWPORT, {
      x,
      y,
      zoom,
      agentId: this.agentId,
      workspaceId: this.workspaceId,
    })
    return { type: 'canvas.state', payload: await this.getCurrentState() }
  }

  private async handleFocusNode(
    cmd: Extract<AgentCanvasCommand, { type: 'canvas.focusNode' }>,
  ): Promise<AgentCanvasResponse> {
    const { nodeId } = cmd.payload
    const bus = getCanvasEventBus()
    bus.emit(CanvasEventType.AGENT_FOCUS_NODE, {
      nodeId,
      agentId: this.agentId,
      workspaceId: this.workspaceId,
    })
    return { type: 'canvas.state', payload: await this.getCurrentState() }
  }

  private async handleGetState(
    _cmd: Extract<AgentCanvasCommand, { type: 'canvas.getState' }>,
  ): Promise<AgentCanvasResponse> {
    return { type: 'canvas.state', payload: await this.getCurrentState() }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  private async getCurrentState(): Promise<CanvasState> {
    return new Promise((resolve) => {
      const bus = getCanvasEventBus()
      const handler = (state: unknown) => {
        bus.off(CanvasEventType.CANVAS_STATE_RESPONSE, handler)
        resolve(state as CanvasState)
      }
      bus.on(CanvasEventType.CANVAS_STATE_RESPONSE, handler)
      bus.emit(CanvasEventType.CANVAS_GET_STATE, {
        workspaceId: this.workspaceId,
        requestId: ulid(),
      })
      // Timeout fallback
      setTimeout(() => {
        bus.off(CanvasEventType.CANVAS_STATE_RESPONSE, handler)
        resolve({ nodes: [], connections: [], viewport: { x: 0, y: 0, zoom: 1 }, streams: [] })
      }, 1000)
    })
  }

  private error(code: string, message: string): AgentCanvasResponse {
    return { type: 'canvas.error', payload: { code, message } }
  }
}

/** Create executor from policy. */
export function createCanvasCommandExecutor(policy: AgentCanvasPolicy): CanvasCommandExecutor {
  return new CanvasCommandExecutor(policy)
}
