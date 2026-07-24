/**
 * components/canvas/event-bus.ts
 * --------------------------------------------------------------------
 * Generic typed pub/sub for canvas UI events. Supports agent-canvas commands.
 */

export type EventHandler<T = unknown> = (payload: T) => void;

export class EventBus {
  private handlers = new Map<string, Set<EventHandler>>();

  on<T>(type: string, handler: EventHandler<T>): () => void {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    set.add(handler as EventHandler);
    return () => {
      set?.delete(handler as EventHandler);
    };
  }

  once<T>(type: string, handler: EventHandler<T>): () => void {
    const wrap: EventHandler = (payload: unknown) => {
      (handler as EventHandler<unknown>)(payload);
      this.off(type, wrap);
    };
    return this.on(type, wrap);
  }

  off(type: string, handler: EventHandler): void {
    this.handlers.get(type)?.delete(handler);
  }

  emit<T>(type: string, payload?: T): void {
    const set = this.handlers.get(type);
    if (!set) return;
    for (const handler of set) {
      try {
        handler(payload as unknown);
      } catch (err) {
        console.error('[EventBus] handler error', err);
      }
    }
  }

  clear(): void {
    this.handlers.clear();
  }
}

// Singleton
let _bus: EventBus | null = null;
export function getCanvasEventBus(): EventBus {
  if (!_bus) _bus = new EventBus();
  return _bus;
}

// ── Agent-Canvas Event Types ────────────────────────────────────────────────

export const CanvasEventType = {
  // ... existing events
  AGENT_CREATE_NODE: 'agent:createNode',
  AGENT_DELETE_NODE: 'agent:deleteNode',
  AGENT_MOVE_NODE: 'agent:moveNode',
  AGENT_CONNECT_NODES: 'agent:connectNodes',
  AGENT_DISCONNECT_NODES: 'agent:disconnectNodes',
  AGENT_RUN_LAYOUT: 'agent:runLayout',
  AGENT_START_STREAM: 'agent:startStream',
  AGENT_STOP_STREAM: 'agent:stopStream',
  AGENT_SET_VIEWPORT: 'agent:setViewport',
  AGENT_FOCUS_NODE: 'agent:focusNode',
  AGENT_CONFIRMATION_REQUESTED: 'agent:confirmationRequested',
  AGENT_CONFIRMATION_RESPONSE: 'agent:confirmationResponse',
  AGENT_COMMAND: 'agent:command', // Generic command from agent
  CANVAS_GET_STATE: 'canvas:getState',
  CANVAS_STATE_RESPONSE: 'canvas:stateResponse',
} as const;

export type CanvasEventType = (typeof CanvasEventType)[keyof typeof CanvasEventType];

export interface CanvasEvent<T = unknown> {
  type: CanvasEventType;
  payload: T;
}

// Payload types for agent commands
export interface AgentCreateNodePayload {
  nodeId: string;
  slotId: string;
  providerId?: string;
  position?: { x: number; y: number };
  config?: Record<string, unknown>;
  agentId: string;
  workspaceId: string;
}

export interface AgentDeleteNodePayload {
  nodeId: string;
  agentId: string;
  workspaceId: string;
}

export interface AgentMoveNodePayload {
  nodeId: string;
  x: number;
  y: number;
  agentId: string;
  workspaceId: string;
}

export interface AgentConnectNodesPayload {
  fromNodeId: string;
  toNodeId: string;
  agentId: string;
  workspaceId: string;
}

export interface AgentDisconnectNodesPayload {
  fromNodeId: string;
  toNodeId: string;
  agentId: string;
  workspaceId: string;
}

export interface AgentRunLayoutPayload {
  intent: string;
  params?: Record<string, unknown>;
  agentId: string;
  workspaceId: string;
}

export interface AgentStartStreamPayload {
  nodeId: string;
  capabilityId: string;
  input?: Record<string, unknown>;
  agentId: string;
  workspaceId: string;
}

export interface AgentStopStreamPayload {
  nodeId: string;
  agentId: string;
  workspaceId: string;
}

export interface AgentSetViewportPayload {
  x: number;
  y: number;
  zoom: number;
  agentId: string;
  workspaceId: string;
}

export interface AgentFocusNodePayload {
  nodeId: string;
  agentId: string;
  workspaceId: string;
}

export interface AgentConfirmationRequestedPayload {
  confirmationId: string;
  agentId: string;
  command: AgentCanvasCommand;
  timestamp: number;
}

export interface AgentConfirmationResponsePayload {
  confirmationId: string;
  approved: boolean;
}

export interface CanvasGetStatePayload {
  workspaceId: string;
  requestId: string;
}

export interface CanvasStateResponsePayload {
  nodes: CanvasNodeState[];
  connections: CanvasConnectionState[];
  viewport: { x: number; y: number; zoom: number };
  streams: CanvasStreamState[];
}

// Canvas state types
export interface CanvasNodeState {
  id: string;
  slotId: string;
  providerId?: string;
  position: { x: number; y: number };
  config: Record<string, unknown>;
  status: 'idle' | 'streaming' | 'error';
}

export interface CanvasConnectionState {
  from: string;
  to: string;
  type: 'data' | 'control';
}

export interface CanvasStreamState {
  nodeId: string;
  capabilityId: string;
  sessionId: string;
  status: 'connecting' | 'streaming' | 'paused' | 'complete' | 'error';
}

// Agent command/response types (mirrored from canvas-command-executor)
export interface AgentCanvasCommand {
  type: string;
  payload: unknown;
}

export interface AgentCanvasResponse {
  type: string;
  payload: unknown;
}

// Policy type
export interface AgentCanvasPolicy {
  agentId: string;
  workspaceId: string;
  allowedCommands: string[];
  maxNodesPerCommand: number;
  maxConcurrentStreams: number;
  allowedProviders: string[];
  allowedSlots: string[];
  requireConfirmation: string[];
}