import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { CanvasEventType, getCanvasEventBus } from '@/components/canvas/event-bus'
import { CanvasCommandExecutor } from '@/engines/canvas-command-executor'
import type { AgentCanvasCommand, AgentCanvasPolicy } from '@/shared/agent-canvas'
import { type CanvasState, DEFAULT_POLICY } from '@/shared/agent-canvas'

/** Mock canvas state responder — tracks streams + viewport so executor gets real data. */
function setupMockCanvas() {
  const bus = getCanvasEventBus()
  const state: CanvasState = {
    nodes: [],
    connections: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    streams: [],
  }

  const onGetState = (payload: unknown) => {
    const p = payload as { requestId: string }
    bus.emit(CanvasEventType.CANVAS_STATE_RESPONSE, { ...state, requestId: p.requestId })
  }
  const onSetViewport = (payload: unknown) => {
    const p = payload as { x: number; y: number; zoom: number }
    state.viewport = { x: p.x, y: p.y, zoom: p.zoom }
  }
  const onStartStream = (payload: unknown) => {
    const p = payload as { nodeId: string; capabilityId: string }
    state.streams.push({
      nodeId: p.nodeId,
      capabilityId: p.capabilityId,
      sessionId: `s:${Date.now()}`,
      state: 'streaming',
    })
  }
  const onStopStream = (payload: unknown) => {
    const p = payload as { nodeId: string }
    state.streams = state.streams.filter((s) => s.nodeId !== p.nodeId)
  }

  bus.on(CanvasEventType.CANVAS_GET_STATE, onGetState)
  bus.on(CanvasEventType.AGENT_SET_VIEWPORT, onSetViewport)
  bus.on(CanvasEventType.AGENT_START_STREAM, onStartStream)
  bus.on(CanvasEventType.AGENT_STOP_STREAM, onStopStream)

  return {
    state,
    cleanup: () => {
      bus.off(CanvasEventType.CANVAS_GET_STATE, onGetState)
      bus.off(CanvasEventType.AGENT_SET_VIEWPORT, onSetViewport)
      bus.off(CanvasEventType.AGENT_START_STREAM, onStartStream)
      bus.off(CanvasEventType.AGENT_STOP_STREAM, onStopStream)
    },
  }
}

function createExecutor(overrides: Partial<AgentCanvasPolicy> = {}) {
  const policy = { ...DEFAULT_POLICY, agentId: `agent:test`, workspaceId: 'ws:test', ...overrides }
  return new CanvasCommandExecutor(policy)
}

const cmd = <T extends AgentCanvasCommand['type']>(
  type: T,
  payload: Extract<AgentCanvasCommand, { type: T }>['payload'],
) => ({ type, payload }) as AgentCanvasCommand

let mock: ReturnType<typeof setupMockCanvas>

beforeEach(() => {
  getCanvasEventBus().clear()
  mock = setupMockCanvas()
})

afterEach(() => {
  mock.cleanup()
  getCanvasEventBus().clear()
})

describe('CanvasCommandExecutor - validation', () => {
  it('createNode: validates allowed slot', async () => {
    const executor = createExecutor({ allowedSlots: ['chat.header'] })
    const response = await executor.execute(cmd('canvas.createNode', { slotId: 'chat.thread' }))
    expect(response.type).toBe('canvas.error')
    if (response.type === 'canvas.error') expect(response.payload.code).toBe('SLOT_NOT_ALLOWED')
  })

  it('createNode: validates allowed provider', async () => {
    const executor = createExecutor({ allowedProviders: ['claude'] })
    const response = await executor.execute(
      cmd('canvas.createNode', { slotId: 'chat.thread', providerId: 'chatgpt' }),
    )
    expect(response.type).toBe('canvas.error')
    if (response.type === 'canvas.error') expect(response.payload.code).toBe('PROVIDER_NOT_ALLOWED')
  })

  it('command validation: rejects disallowed command', async () => {
    const restrictedExecutor = createExecutor({ allowedCommands: ['canvas.getState'] })
    const response = await restrictedExecutor.execute(
      cmd('canvas.createNode', { slotId: 'chat.thread' }),
    )
    expect(response.type).toBe('canvas.error')
    if (response.type === 'canvas.error') expect(response.payload.code).toBe('COMMAND_NOT_ALLOWED')
  })

  it('startStream: enforces maxConcurrentStreams limit', async () => {
    const executor = createExecutor({ maxConcurrentStreams: 1 })
    await executor.execute(
      cmd('canvas.startStream', { nodeId: 'node:1', capabilityId: 'send_message' }),
    )
    const response = await executor.execute(
      cmd('canvas.startStream', { nodeId: 'node:2', capabilityId: 'send_message' }),
    )
    expect(response.type).toBe('canvas.error')
    if (response.type === 'canvas.error')
      expect(response.payload.code).toBe('STREAM_LIMIT_EXCEEDED')
  })
})

describe('CanvasCommandExecutor - basic execution (smoke)', () => {
  it('createNode: returns nodeCreated for allowed slot', async () => {
    const executor = createExecutor()
    const response = await executor.execute(
      cmd('canvas.createNode', { slotId: 'chat.thread', providerId: 'chatgpt' }),
    )
    expect(response.type).toBe('canvas.nodeCreated')
    if (response.type === 'canvas.nodeCreated') {
      expect(response.payload.slotId).toBe('chat.thread')
      expect(response.payload.providerId).toBe('chatgpt')
    }
  })

  it('deleteNode: returns nodeDeleted', async () => {
    const executor = createExecutor()
    const response = await executor.execute(cmd('canvas.deleteNode', { nodeId: 'node:123' }))
    expect(response.type).toBe('canvas.nodeDeleted')
    if (response.type === 'canvas.nodeDeleted') expect(response.payload.nodeId).toBe('node:123')
  })

  it('moveNode: returns nodesMoved', async () => {
    const executor = createExecutor()
    const response = await executor.execute(
      cmd('canvas.moveNode', { nodeId: 'node:1', x: 500, y: 300 }),
    )
    expect(response.type).toBe('canvas.nodesMoved')
    if (response.type === 'canvas.nodesMoved') {
      expect(response.payload[0].nodeId).toBe('node:1')
      expect(response.payload[0].x).toBe(500)
      expect(response.payload[0].y).toBe(300)
    }
  })

  it('connectNodes: returns nodesConnected', async () => {
    const executor = createExecutor()
    const response = await executor.execute(
      cmd('canvas.connectNodes', { fromNodeId: 'node:1', toNodeId: 'node:2' }),
    )
    expect(response.type).toBe('canvas.nodesConnected')
    if (response.type === 'canvas.nodesConnected') {
      expect(response.payload.fromNodeId).toBe('node:1')
      expect(response.payload.toNodeId).toBe('node:2')
    }
  })

  it('disconnectNodes: returns nodesDisconnected', async () => {
    const executor = createExecutor()
    const response = await executor.execute(
      cmd('canvas.disconnectNodes', { fromNodeId: 'node:1', toNodeId: 'node:2' }),
    )
    expect(response.type).toBe('canvas.nodesDisconnected')
    if (response.type === 'canvas.nodesDisconnected') {
      expect(response.payload.fromNodeId).toBe('node:1')
      expect(response.payload.toNodeId).toBe('node:2')
    }
  })

  it('runLayout: runs grid layout', async () => {
    const executor = createExecutor()
    const response = await executor.execute(cmd('canvas.runLayout', { intent: 'grid' }))
    expect(response.type).toBe('canvas.layoutApplied')
    if (response.type === 'canvas.layoutApplied') expect(response.payload.intent).toBe('grid')
  })

  it('runLayout: runs timeline layout', async () => {
    const executor = createExecutor()
    const response = await executor.execute(cmd('canvas.runLayout', { intent: 'timeline' }))
    expect(response.type).toBe('canvas.layoutApplied')
    if (response.type === 'canvas.layoutApplied') expect(response.payload.intent).toBe('timeline')
  })

  it('runLayout: runs custom layout with params', async () => {
    const executor = createExecutor()
    const response = await executor.execute(
      cmd('canvas.runLayout', { intent: 'custom', params: { direction: 'vertical', spacing: 50 } }),
    )
    expect(response.type).toBe('canvas.layoutApplied')
    if (response.type === 'canvas.layoutApplied') expect(response.payload.intent).toBe('custom')
  })

  it('startStream: starts stream for node', async () => {
    const executor = createExecutor()
    const response = await executor.execute(
      cmd('canvas.startStream', {
        nodeId: 'node:1',
        capabilityId: 'send_message',
        input: { text: 'hello' },
      }),
    )
    expect(response.type).toBe('canvas.streamStarted')
    if (response.type === 'canvas.streamStarted') {
      expect(response.payload.nodeId).toBe('node:1')
      expect(response.payload.sessionId).toBeDefined()
    }
  })

  it('startStream: enforces maxConcurrentStreams limit', async () => {
    const executor = createExecutor({ maxConcurrentStreams: 1 })
    await executor.execute(
      cmd('canvas.startStream', { nodeId: 'node:1', capabilityId: 'send_message' }),
    )
    const response = await executor.execute(
      cmd('canvas.startStream', { nodeId: 'node:2', capabilityId: 'send_message' }),
    )
    expect(response.type).toBe('canvas.error')
    if (response.type === 'canvas.error')
      expect(response.payload.code).toBe('STREAM_LIMIT_EXCEEDED')
  })

  it('stopStream: stops stream', async () => {
    const executor = createExecutor()
    const response = await executor.execute(cmd('canvas.stopStream', { nodeId: 'node:1' }))
    expect(response.type).toBe('canvas.streamStopped')
    if (response.type === 'canvas.streamStopped') expect(response.payload.nodeId).toBe('node:1')
  })

  it('setViewport: sets viewport', async () => {
    const executor = createExecutor()
    const response = await executor.execute(
      cmd('canvas.setViewport', { x: 100, y: 200, zoom: 1.5 }),
    )
    expect(response.type).toBe('canvas.state')
    if (response.type === 'canvas.state') {
      expect(response.payload.viewport?.x).toBe(100)
      expect(response.payload.viewport?.y).toBe(200)
      expect(response.payload.viewport?.zoom).toBe(1.5)
    }
  })

  it('focusNode: returns state', async () => {
    const executor = createExecutor()
    const response = await executor.execute(cmd('canvas.focusNode', { nodeId: 'node:123' }))
    expect(response.type).toBe('canvas.state')
  })

  it('getState: returns canvas state', async () => {
    const executor = createExecutor()
    const response = await executor.execute(
      cmd('canvas.getState', { includeConnections: true, includeNodes: ['node:1'] }),
    )
    expect(response.type).toBe('canvas.state')
    if (response.type === 'canvas.state') {
      expect(response.payload.nodes).toBeDefined()
      expect(response.payload.connections).toBeDefined()
      expect(response.payload.viewport).toBeDefined()
      expect(response.payload.streams).toBeDefined()
    }
  })

  it('command validation: rejects disallowed command', async () => {
    const restrictedExecutor = createExecutor({ allowedCommands: ['canvas.getState'] })
    const response = await restrictedExecutor.execute(
      cmd('canvas.createNode', { slotId: 'chat.thread' }),
    )
    expect(response.type).toBe('canvas.error')
    if (response.type === 'canvas.error') expect(response.payload.code).toBe('COMMAND_NOT_ALLOWED')
  })
})
