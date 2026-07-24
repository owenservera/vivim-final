import { describe, it, expect, beforeEach } from 'bun:test';
import { EventBus } from '@/components/canvas/event-bus';
import { CanvasEventType } from '@/components/canvas/event-bus';
import type { AgentCreateNodePayload, AgentDeleteNodePayload } from '@/components/canvas/event-bus';

describe('EventBus - agent events', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
  });

  it('should subscribe and emit agent:createNode events', () => {
    const received: AgentCreateNodePayload[] = [];
    const unsubscribe = bus.on(CanvasEventType.AGENT_CREATE_NODE, (payload) => {
      received.push(payload as AgentCreateNodePayload);
    });

    const payload: AgentCreateNodePayload = {
      nodeId: 'node:1',
      slotId: 'chat.thread',
      providerId: 'chatgpt',
      position: { x: 100, y: 100 },
      config: { title: 'Test' },
      agentId: 'agent:1',
      workspaceId: 'ws:1',
    };

    bus.emit(CanvasEventType.AGENT_CREATE_NODE, payload);

    expect(received.length).toBe(1);
    expect(received[0].nodeId).toBe('node:1');
    expect(received[0].slotId).toBe('chat.thread');

    unsubscribe();
  });

  it('should handle multiple subscribers', () => {
    const received1: AgentCreateNodePayload[] = [];
    const received2: AgentCreateNodePayload[] = [];

    bus.on(CanvasEventType.AGENT_CREATE_NODE, (p) => received1.push(p as AgentCreateNodePayload));
    bus.on(CanvasEventType.AGENT_CREATE_NODE, (p) => received2.push(p as AgentCreateNodePayload));

    bus.emit(CanvasEventType.AGENT_CREATE_NODE, {
      nodeId: 'node:1',
      slotId: 'chat.thread',
      agentId: 'agent:1',
      workspaceId: 'ws:1',
    });

    expect(received1.length).toBe(1);
    expect(received2.length).toBe(1);
  });

  it('should unsubscribe correctly', () => {
    const received: AgentCreateNodePayload[] = [];
    const unsubscribe = bus.on(CanvasEventType.AGENT_CREATE_NODE, (p) => received.push(p as AgentCreateNodePayload));

    bus.emit(CanvasEventType.AGENT_CREATE_NODE, {
      nodeId: 'node:1',
      slotId: 'chat.thread',
      agentId: 'agent:1',
      workspaceId: 'ws:1',
    });

    expect(received.length).toBe(1);

    unsubscribe();

    bus.emit(CanvasEventType.AGENT_CREATE_NODE, {
      nodeId: 'node:2',
      slotId: 'chat.thread',
      agentId: 'agent:1',
      workspaceId: 'ws:1',
    });

    expect(received.length).toBe(1);
  });

  it('should handle agent:deleteNode events', () => {
    const received: AgentDeleteNodePayload[] = [];
    bus.on(CanvasEventType.AGENT_DELETE_NODE, (p) => received.push(p as AgentDeleteNodePayload));

    bus.emit(CanvasEventType.AGENT_DELETE_NODE, {
      nodeId: 'node:1',
      agentId: 'agent:1',
      workspaceId: 'ws:1',
    });

    expect(received.length).toBe(1);
    expect(received[0].nodeId).toBe('node:1');
  });

  it('should handle once() subscriptions', () => {
    const received: AgentCreateNodePayload[] = [];
    bus.once(CanvasEventType.AGENT_CREATE_NODE, (p) => received.push(p as AgentCreateNodePayload));

    bus.emit(CanvasEventType.AGENT_CREATE_NODE, { nodeId: 'n1', slotId: 's1', agentId: 'a1', workspaceId: 'w1' });
    bus.emit(CanvasEventType.AGENT_CREATE_NODE, { nodeId: 'n2', slotId: 's2', agentId: 'a1', workspaceId: 'w1' });

    expect(received.length).toBe(1);
    expect(received[0].nodeId).toBe('n1');
  });
});

describe('CanvasEventType constants', () => {
  it('should have all agent event types', () => {
    expect(CanvasEventType.AGENT_CREATE_NODE).toBe('agent:createNode');
    expect(CanvasEventType.AGENT_DELETE_NODE).toBe('agent:deleteNode');
    expect(CanvasEventType.AGENT_MOVE_NODE).toBe('agent:moveNode');
    expect(CanvasEventType.AGENT_CONNECT_NODES).toBe('agent:connectNodes');
    expect(CanvasEventType.AGENT_DISCONNECT_NODES).toBe('agent:disconnectNodes');
    expect(CanvasEventType.AGENT_RUN_LAYOUT).toBe('agent:runLayout');
    expect(CanvasEventType.AGENT_START_STREAM).toBe('agent:startStream');
    expect(CanvasEventType.AGENT_STOP_STREAM).toBe('agent:stopStream');
    expect(CanvasEventType.AGENT_SET_VIEWPORT).toBe('agent:setViewport');
    expect(CanvasEventType.AGENT_FOCUS_NODE).toBe('agent:focusNode');
    expect(CanvasEventType.AGENT_COMMAND).toBe('agent:command');
    expect(CanvasEventType.AGENT_CONFIRMATION_REQUESTED).toBe('agent:confirmationRequested');
    expect(CanvasEventType.AGENT_CONFIRMATION_RESPONSE).toBe('agent:confirmationResponse');
    expect(CanvasEventType.CANVAS_GET_STATE).toBe('canvas:getState');
    expect(CanvasEventType.CANVAS_STATE_RESPONSE).toBe('canvas:stateResponse');
  });
});