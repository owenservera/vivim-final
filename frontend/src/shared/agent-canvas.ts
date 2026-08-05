/**
 * shared/agent-canvas.ts
 * --------------------------------------------------------------------
 * Agent ↔ Canvas command protocol.
 * Agents issue structured commands; canvas executes via EventBus.
 */

export type AgentCanvasCommand =
  | { type: 'canvas.createNode'; payload: { slotId: string; providerId?: string; position?: { x: number; y: number }; config?: Record<string, unknown> } }
  | { type: 'canvas.deleteNode'; payload: { nodeId: string } }
  | { type: 'canvas.moveNode'; payload: { nodeId: string; x: number; y: number } }
  | { type: 'canvas.connectNodes'; payload: { fromNodeId: string; toNodeId: string } }
  | { type: 'canvas.disconnectNodes'; payload: { fromNodeId: string; toNodeId: string } }
  | { type: 'canvas.runLayout'; payload: { intent: 'grid' | 'timeline' | 'radial' | 'hierarchy' | 'force' | 'custom'; params?: Record<string, unknown> } }
  | { type: 'canvas.startStream'; payload: { nodeId: string; capabilityId: string; input?: Record<string, unknown> } }
  | { type: 'canvas.stopStream'; payload: { nodeId: string } }
  | { type: 'canvas.setViewport'; payload: { x: number; y: number; zoom: number } }
  | { type: 'canvas.focusNode'; payload: { nodeId: string } }
  | { type: 'canvas.getState'; payload: { includeConnections?: boolean; includeNodes?: string[] } };

export type AgentCanvasResponse =
  | { type: 'canvas.state'; payload: CanvasState }
  | { type: 'canvas.nodeCreated'; payload: { nodeId: string; slotId: string; providerId?: string } }
  | { type: 'canvas.nodeDeleted'; payload: { nodeId: string } }
  | { type: 'canvas.nodesMoved'; payload: Array<{ nodeId: string; x: number; y: number }> }
  | { type: 'canvas.nodesConnected'; payload: { fromNodeId: string; toNodeId: string } }
  | { type: 'canvas.nodesDisconnected'; payload: { fromNodeId: string; toNodeId: string } }
  | { type: 'canvas.layoutApplied'; payload: { intent: string; positions: Record<string, { x: number; y: number }> } }
  | { type: 'canvas.streamStarted'; payload: { nodeId: string; sessionId: string } }
  | { type: 'canvas.streamStopped'; payload: { nodeId: string } }
  | { type: 'canvas.error'; payload: { code: string; message: string } };

export interface CanvasState {
  nodes: Array<{
    id: string;
    slotId: string;
    providerId?: string;
    position: { x: number; y: number };
    config?: Record<string, unknown>;
  }>;
  connections: Array<{ from: string; to: string }>;
  viewport: { x: number; y: number; zoom: number };
  streams: Array<{ nodeId: string; capabilityId: string; sessionId: string; state: string }>;
}

export interface AgentCanvasPolicy {
  agentId: string;
  workspaceId: string;
  allowedCommands: AgentCanvasCommand['type'][];
  maxNodesPerCommand: number;
  maxConcurrentStreams: number;
  allowedProviders: string[];
  allowedSlots: string[];
  requireConfirmation: AgentCanvasCommand['type'][];
}

export const DEFAULT_POLICY: Omit<AgentCanvasPolicy, 'agentId' | 'workspaceId'> = {
  allowedCommands: [
    'canvas.createNode',
    'canvas.deleteNode',
    'canvas.moveNode',
    'canvas.connectNodes',
    'canvas.disconnectNodes',
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
  requireConfirmation: [],
};

export interface AgentCanvasOp {
  id: string;
  /** @deprecated use type instead */
  action?: 'spawn_node' | 'wire' | 'move' | 'layout' | 'startStream' | 'stopStream';
  type: 'createNode' | 'deleteNode' | 'moveNode' | 'connectNodes' | 'runLayout' | 'startStream' | 'stopStream';
  /** @deprecated use payload instead */
  nodeSpec?: { layout?: { x: number; y: number; w: number; h: number }; title?: string; category?: string; slotId?: string };
  payload: Record<string, unknown>;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: number;
}

export interface AgentCanvasPlan {
  id: string;
  traceId: string;
  agentId: string;
  workspaceId: string;
  ops: AgentCanvasOp[];
  /** @deprecated use status instead */
  prompt?: string;
  status: 'proposed' | 'accepted' | 'rejected' | 'partial';
  createdAt: number;
}
