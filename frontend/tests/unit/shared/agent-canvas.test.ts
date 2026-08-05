import { describe, it, expect } from 'bun:test';
import type {
  AgentCanvasCommand,
  AgentCanvasResponse,
  AgentCanvasPolicy,
  AgentCanvasOp,
  AgentCanvasPlan,
  CanvasState,
} from '@/shared/agent-canvas';
import { DEFAULT_POLICY } from '@/shared/agent-canvas';

describe('agent-canvas types', () => {
  describe('AgentCanvasCommand', () => {
    it('should accept all valid command types', () => {
      const commands: AgentCanvasCommand[] = [
        { type: 'canvas.createNode', payload: { slotId: 'chat.thread', providerId: 'chatgpt', position: { x: 100, y: 100 } } },
        { type: 'canvas.deleteNode', payload: { nodeId: 'node:123' } },
        { type: 'canvas.moveNode', payload: { nodeId: 'node:123', x: 200, y: 200 } },
        { type: 'canvas.connectNodes', payload: { fromNodeId: 'node:1', toNodeId: 'node:2' } },
        { type: 'canvas.disconnectNodes', payload: { fromNodeId: 'node:1', toNodeId: 'node:2' } },
        { type: 'canvas.runLayout', payload: { intent: 'grid' } },
        { type: 'canvas.runLayout', payload: { intent: 'timeline' } },
        { type: 'canvas.runLayout', payload: { intent: 'radial' } },
        { type: 'canvas.runLayout', payload: { intent: 'hierarchy' } },
        { type: 'canvas.runLayout', payload: { intent: 'force' } },
        { type: 'canvas.runLayout', payload: { intent: 'custom', params: { foo: 'bar' } } },
        { type: 'canvas.startStream', payload: { nodeId: 'node:1', capabilityId: 'send_message', input: { text: 'hello' } } },
        { type: 'canvas.stopStream', payload: { nodeId: 'node:1' } },
        { type: 'canvas.setViewport', payload: { x: 0, y: 0, zoom: 1.5 } },
        { type: 'canvas.focusNode', payload: { nodeId: 'node:1' } },
        { type: 'canvas.getState', payload: { includeConnections: true, includeNodes: ['node:1'] } },
      ];

      expect(commands.length).toBe(16);
    });

    it('should infer correct payload types per command', () => {
      const createNode: AgentCanvasCommand = { type: 'canvas.createNode', payload: { slotId: 'chat.thread' } };
      expect(createNode.type).toBe('canvas.createNode');
      expect(createNode.payload.slotId).toBe('chat.thread');

      const runLayout: AgentCanvasCommand = { type: 'canvas.runLayout', payload: { intent: 'timeline', params: { direction: 'horizontal' } } };
      expect(runLayout.payload.intent).toBe('timeline');
      expect(runLayout.payload.params?.direction).toBe('horizontal');
    });
  });

  describe('AgentCanvasResponse', () => {
    it('should accept all valid response types', () => {
      const responses: AgentCanvasResponse[] = [
        { type: 'canvas.state', payload: { nodes: [], connections: [], viewport: { x: 0, y: 0, zoom: 1 }, streams: [] } },
        { type: 'canvas.nodeCreated', payload: { nodeId: 'node:1', slotId: 'chat.thread', providerId: 'chatgpt' } },
        { type: 'canvas.nodeDeleted', payload: { nodeId: 'node:1' } },
        { type: 'canvas.nodesMoved', payload: [{ nodeId: 'node:1', x: 100, y: 100 }] },
        { type: 'canvas.nodesConnected', payload: { fromNodeId: 'node:1', toNodeId: 'node:2' } },
        { type: 'canvas.nodesDisconnected', payload: { fromNodeId: 'node:1', toNodeId: 'node:2' } },
        { type: 'canvas.layoutApplied', payload: { intent: 'grid', positions: { 'node:1': { x: 0, y: 0 } } } },
        { type: 'canvas.streamStarted', payload: { nodeId: 'node:1', sessionId: 'stream:123' } },
        { type: 'canvas.streamStopped', payload: { nodeId: 'node:1' } },
        { type: 'canvas.error', payload: { code: 'NOT_ALLOWED', message: 'Command not permitted' } },
      ];

      expect(responses.length).toBe(10);
    });
  });

  describe('AgentCanvasPolicy', () => {
    it('should have correct default policy', () => {
      expect(DEFAULT_POLICY.allowedCommands).toContain('canvas.createNode');
      expect(DEFAULT_POLICY.allowedCommands).toContain('canvas.moveNode');
      expect(DEFAULT_POLICY.allowedCommands).toContain('canvas.runLayout');
      expect(DEFAULT_POLICY.allowedCommands).toContain('canvas.startStream');
      expect(DEFAULT_POLICY.allowedCommands).toContain('canvas.stopStream');
      expect(DEFAULT_POLICY.allowedCommands).toContain('canvas.setViewport');
      expect(DEFAULT_POLICY.allowedCommands).toContain('canvas.focusNode');
      expect(DEFAULT_POLICY.allowedCommands).toContain('canvas.getState');
      expect(DEFAULT_POLICY.allowedCommands).toContain('canvas.deleteNode');
      expect(DEFAULT_POLICY.allowedCommands).toContain('canvas.disconnectNodes');

      expect(DEFAULT_POLICY.requireConfirmation).toHaveLength(0);

      expect(DEFAULT_POLICY.maxNodesPerCommand).toBe(5);
      expect(DEFAULT_POLICY.maxConcurrentStreams).toBe(3);
      expect(DEFAULT_POLICY.allowedProviders).toContain('chatgpt');
      expect(DEFAULT_POLICY.allowedProviders).toContain('claude');
      expect(DEFAULT_POLICY.allowedProviders).toContain('gemini');
      expect(DEFAULT_POLICY.allowedSlots).toContain('chat.thread');
      expect(DEFAULT_POLICY.allowedSlots).toContain('chat.composer');
    });

    it('should allow custom policy overrides', () => {
      const customPolicy: AgentCanvasPolicy = {
        ...DEFAULT_POLICY,
        agentId: 'agent:test',
        workspaceId: 'ws:test',
        allowedCommands: [...DEFAULT_POLICY.allowedCommands, 'canvas.deleteNode'],
        maxConcurrentStreams: 5,
        allowedSlots: [...DEFAULT_POLICY.allowedSlots, 'chat.result'],
      };

      expect(customPolicy.allowedCommands).toContain('canvas.deleteNode');
      expect(customPolicy.maxConcurrentStreams).toBe(5);
      expect(customPolicy.allowedSlots).toContain('chat.result');
    });
  });

  describe('AgentCanvasOp', () => {
    it('should accept all valid op types', () => {
      const ops: AgentCanvasOp[] = [
        { id: 'op:1', type: 'createNode', payload: { slotId: 'chat.thread' }, status: 'pending', createdAt: Date.now() },
        { id: 'op:2', type: 'deleteNode', payload: { nodeId: 'node:1' }, status: 'pending', createdAt: Date.now() },
        { id: 'op:3', type: 'moveNode', payload: { nodeId: 'node:1', x: 100, y: 100 }, status: 'pending', createdAt: Date.now() },
        { id: 'op:4', type: 'connectNodes', payload: { fromNodeId: 'node:1', toNodeId: 'node:2' }, status: 'pending', createdAt: Date.now() },
        { id: 'op:5', type: 'runLayout', payload: { intent: 'grid' }, status: 'pending', createdAt: Date.now() },
        { id: 'op:6', type: 'startStream', payload: { nodeId: 'node:1', capabilityId: 'send_message' }, status: 'pending', createdAt: Date.now() },
        { id: 'op:7', type: 'stopStream', payload: { nodeId: 'node:1' }, status: 'pending', createdAt: Date.now() },
      ];

      expect(ops.length).toBe(7);
    });

    it('should support deprecated action field', () => {
      const op: AgentCanvasOp = {
        id: 'op:1',
        type: 'createNode',
        action: 'spawn_node',
        nodeSpec: { slotId: 'chat.thread', layout: { x: 0, y: 0, w: 200, h: 200 }, title: 'Test' },
        payload: { slotId: 'chat.thread' },
        status: 'pending',
        createdAt: Date.now(),
      };

      expect(op.action).toBe('spawn_node');
      expect(op.nodeSpec?.title).toBe('Test');
    });

    it('should support all status values', () => {
      const statuses: AgentCanvasOp['status'][] = ['pending', 'accepted', 'rejected'];
      statuses.forEach((status) => {
        const op: AgentCanvasOp = {
          id: 'op:1',
          type: 'createNode',
          payload: {},
          status,
          createdAt: Date.now(),
        };
        expect(op.status).toBe(status);
      });
    });
  });

  describe('AgentCanvasPlan', () => {
    it('should create valid plan with ops', () => {
      const plan: AgentCanvasPlan = {
        id: 'plan:123',
        traceId: 'trace:456',
        agentId: 'agent:test',
        workspaceId: 'ws:test',
        ops: [
          { id: 'op:1', type: 'createNode', payload: { slotId: 'chat.thread' }, status: 'pending', createdAt: Date.now() },
          { id: 'op:2', type: 'runLayout', payload: { intent: 'grid' }, status: 'pending', createdAt: Date.now() },
        ],
        prompt: 'Create a research layout',
        status: 'proposed',
        createdAt: Date.now(),
      };

      expect(plan.id).toBe('plan:123');
      expect(plan.traceId).toBe('trace:456');
      expect(plan.ops.length).toBe(2);
      expect(plan.status).toBe('proposed');
    });

    it('should support all plan statuses', () => {
      const statuses: AgentCanvasPlan['status'][] = ['proposed', 'accepted', 'rejected', 'partial'];
      statuses.forEach((status) => {
        const plan: AgentCanvasPlan = {
          id: 'plan:1',
          traceId: 'trace:1',
          agentId: 'agent:1',
          workspaceId: 'ws:1',
          ops: [],
          status,
          createdAt: Date.now(),
        };
        expect(plan.status).toBe(status);
      });
    });
  });

  describe('CanvasState', () => {
    it('should serialize correctly', () => {
      const state: CanvasState = {
        nodes: [
          { id: 'node:1', slotId: 'chat.thread', providerId: 'chatgpt', position: { x: 100, y: 100 }, config: { title: 'Test' } },
        ],
        connections: [{ from: 'node:1', to: 'node:2' }],
        viewport: { x: 0, y: 0, zoom: 1 },
        streams: [{ nodeId: 'node:1', capabilityId: 'send_message', sessionId: 'stream:1', state: 'streaming' }],
      };

      const json = JSON.stringify(state);
      const parsed = JSON.parse(json);
      expect(parsed.nodes.length).toBe(1);
      expect(parsed.streams[0].state).toBe('streaming');
    });
  });
});