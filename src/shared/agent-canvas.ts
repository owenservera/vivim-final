/**
 * shared/agent-canvas.ts
 * --------------------------------------------------------------------
 * Agent ↔ Canvas command protocol (shared between frontend and backend).
 * Pure types + constants — no runtime dependencies.
 *
 * Stub module — the agent canvas co-pilot contract. Agents propose ops
 * against the canvas (AgentCanvasPlan), issue commands (AgentCanvasCommand),
 * and receive responses (AgentCanvasResponse) under a policy
 * (AgentCanvasPolicy). Reconstructed from importer usage
 * (canvas-command-executor, api/agent/canvas/*, AgentOverlay, LivingCanvas).
 */

/** Op status in an AgentCanvasPlan. */
export type AgentCanvasOpStatus = 'pending' | 'accepted' | 'rejected'

/** Action kind for a proposed op. */
export type AgentCanvasOpAction = 'spawn_node' | 'wire' | 'layout' | 'delete' | 'move'

/** Node spec for a spawn_node op. */
export interface AgentCanvasNodeSpec {
  slotId: string
  title: string
  category: string
  layout: { x: number; y: number; w: number; h: number }
}

/** Status of a plan. */
export type AgentCanvasPlanStatus = 'proposed' | 'accepted' | 'rejected'

/** Canvas node spec for createNode commands. */
export interface CanvasNodePosition {
  x: number
  y: number
}

export type AgentCanvasCommand =
  | {
      type: 'canvas.createNode'
      payload: {
        slotId: string
        providerId?: string
        position?: { x: number; y: number }
        config?: Record<string, unknown>
      }
    }
  | { type: 'canvas.deleteNode'; payload: { nodeId: string } }
  | { type: 'canvas.moveNode'; payload: { nodeId: string; x: number; y: number } }
  | { type: 'canvas.connectNodes'; payload: { fromNodeId: string; toNodeId: string } }
  | { type: 'canvas.disconnectNodes'; payload: { fromNodeId: string; toNodeId: string } }
  | {
      type: 'canvas.runLayout'
      payload: {
        intent: 'grid' | 'timeline' | 'radial' | 'hierarchy' | 'force' | 'custom'
        params?: Record<string, unknown>
      }
    }
  | {
      type: 'canvas.startStream'
      payload: { nodeId: string; capabilityId: string; input?: Record<string, unknown> }
    }
  | { type: 'canvas.stopStream'; payload: { nodeId: string } }
  | { type: 'canvas.setViewport'; payload: { x: number; y: number; zoom: number } }
  | { type: 'canvas.focusNode'; payload: { nodeId: string } }
  | { type: 'canvas.getState'; payload: { includeConnections?: boolean; includeNodes?: string[] } }

export type AgentCanvasResponse =
  | { type: 'canvas.state'; payload: CanvasState }
  | { type: 'canvas.nodeCreated'; payload: { nodeId: string; slotId: string; providerId?: string } }
  | { type: 'canvas.nodeDeleted'; payload: { nodeId: string } }
  | { type: 'canvas.nodesMoved'; payload: Array<{ nodeId: string; x: number; y: number }> }
  | { type: 'canvas.nodesConnected'; payload: { fromNodeId: string; toNodeId: string } }
  | { type: 'canvas.nodesDisconnected'; payload: { fromNodeId: string; toNodeId: string } }
  | {
      type: 'canvas.layoutApplied'
      payload: { intent: string; positions: Record<string, { x: number; y: number }> }
    }
  | { type: 'canvas.streamStarted'; payload: { nodeId: string; sessionId: string } }
  | { type: 'canvas.streamStopped'; payload: { nodeId: string } }
  | { type: 'canvas.error'; payload: { code: string; message: string } }

export interface CanvasState {
  nodes: Array<{
    id: string
    slotId: string
    providerId?: string
    position: { x: number; y: number }
    config?: Record<string, unknown>
  }>
  connections: Array<{ from: string; to: string }>
  viewport: { x: number; y: number; zoom: number }
  streams: Array<{ nodeId: string; capabilityId: string; sessionId: string; state: string }>
}

export interface AgentCanvasPolicy {
  agentId: string
  workspaceId: string
  allowedCommands: AgentCanvasCommand['type'][]
  maxNodesPerCommand: number
  maxConcurrentStreams: number
  allowedProviders: string[]
  allowedSlots: string[]
  requireConfirmation: AgentCanvasCommand['type'][]
}

export const DEFAULT_POLICY: Omit<AgentCanvasPolicy, 'agentId' | 'workspaceId'> = {
  allowedCommands: [
    'canvas.createNode',
    'canvas.moveNode',
    'canvas.runLayout',
    'canvas.startStream',
    'canvas.stopStream',
    'canvas.setViewport',
    'canvas.focusNode',
    'canvas.getState',
  ],
  maxNodesPerCommand: 5,
  maxConcurrentStreams: 3,
  allowedProviders: ['chatgpt', 'claude', 'gemini', 'deepseek', 'qwen', 'grok'],
  allowedSlots: [
    'chat.thread',
    'chat.composer',
    'chat.streaming',
    'chat.result',
    'chat.sidebar',
    'chat.header',
  ],
  requireConfirmation: ['canvas.deleteNode', 'canvas.disconnectNodes', 'canvas.runLayout'],
}

export interface AgentCanvasOp {
  id: string
  /** @deprecated use type instead */
  action?: 'spawn_node' | 'wire' | 'move' | 'layout' | 'startStream' | 'stopStream'
  type:
    | 'createNode'
    | 'deleteNode'
    | 'moveNode'
    | 'connectNodes'
    | 'runLayout'
    | 'startStream'
    | 'stopStream'
  /** @deprecated use payload instead */
  nodeSpec?: {
    layout?: { x: number; y: number; w: number; h: number }
    title?: string
    category?: string
    slotId?: string
  }
  payload: Record<string, unknown>
  status: 'pending' | 'accepted' | 'rejected'
  createdAt: number
}

export interface AgentCanvasPlan {
  id: string
  traceId: string
  agentId: string
  workspaceId: string
  ops: AgentCanvasOp[]
  /** @deprecated use status instead */
  prompt?: string
  status: 'proposed' | 'accepted' | 'rejected' | 'partial'
  createdAt: number
}

/** A canvas node snapshot (in CanvasState.nodes). */
export interface CanvasNodeSnapshot {
  id: string
  slotId: string
  providerId?: string
  x: number
  y: number
}

/** A canvas connection snapshot. */
export interface CanvasConnectionSnapshot {
  id: string
  fromNodeId: string
  toNodeId: string
}

/** A live stream snapshot. */
export interface CanvasStreamSnapshot {
  nodeId: string
  sessionId: string
  capabilityId: string
}
