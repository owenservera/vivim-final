# P4 Agent-Composable — Design Specification

**Status:** Requires Design Decision  
**Owner:** Product/Engineering  
**Dependencies:** None (architectural)

---

## Problem Statement

The vision (Report 7, P4) states: **"Agent-Composable — Agent Can Rearrange Slots"**

> "Agents should be able to programmatically manipulate the canvas: create nodes, connect them, change layouts, trigger streams, and respond to events. The canvas is not just a display — it's an agent's workspace."

Currently: Agents exist as separate surface (`agents` tab) with `AgentCard` components that can be invoked via API. They have no access to canvas state or operations.

Desired: Agents can issue commands that directly manipulate the LivingCanvas.

---

## Proposed Architecture

### 1. Agent → Canvas Command Protocol

```typescript
// Shared protocol (add to shared/agent-canvas.ts)
export type AgentCanvasCommand =
  | { type: 'canvas.createNode'; payload: { slotId: string; providerId?: string; position?: { x: number; y: number } } }
  | { type: 'canvas.deleteNode'; payload: { nodeId: string } }
  | { type: 'canvas.moveNode'; payload: { nodeId: string; x: number; y: number } }
  | { type: 'canvas.connectNodes'; payload: { from: string; to: string } }
  | { type: 'canvas.disconnectNodes'; payload: { from: string; to: string } }
  | { type: 'canvas.runLayout'; payload: { intent: LayoutIntent } }
  | { type: 'canvas.startStream'; payload: { nodeId: string; capabilityId: string; input?: Record<string, unknown> } }
  | { type: 'canvas.stopStream'; payload: { nodeId: string } }
  | { type: 'canvas.setViewport'; payload: { x: number; y: number; zoom: number } }
  | { type: 'canvas.focusNode'; payload: { nodeId: string } }
  | { type: 'canvas.getState'; payload: { includeConnections?: boolean; includeNodes?: string[] } };

export type AgentCanvasResponse =
  | { type: 'canvas.state'; payload: CanvasState }
  | { type: 'canvas.nodeCreated'; payload: { nodeId: string; slotId: string } }
  | { type: 'canvas.nodeDeleted'; payload: { nodeId: string } }
  | { type: 'canvas.nodesMoved'; payload: Array<{ nodeId: string; x: number; y: number }> }
  | { type: 'canvas.nodesConnected'; payload: { from: string; to: string } }
  | { type: 'canvas.layoutApplied'; payload: { intent: LayoutIntent } }
  | { type: 'canvas.streamStarted'; payload: { nodeId: string; sessionId: string } }
  | { type: 'canvas.error'; payload: { code: string; message: string } };
```

### 2. Command Execution Pipeline

```
Agent (LLM) → Natural Language → /api/agent/canvas/command → CommandParser → CanvasCommandExecutor → LivingCanvas (via EventBus) → Response → Agent
```

**Components needed:**
- `/api/agent/canvas/command` — POST endpoint accepting `{ agentId: string; command: AgentCanvasCommand }`
- `CommandParser` — Validates command, resolves slot IDs to node IDs
- `CanvasCommandExecutor` — Executes against LivingCanvas via EventBus (already exists: `getCanvasEventBus()`)
- `AgentCanvasContext` — Provides agent's canvas sandbox (workspace-scoped)

### 3. Security & Sandboxing

```typescript
interface AgentCanvasPolicy {
  agentId: string;
  workspaceId: string;
  allowedCommands: AgentCanvasCommand['type'][];
  maxNodesPerCommand: number;
  maxConcurrentStreams: number;
  allowedProviders: string[];
  allowedSlots: string[];
  requireConfirmation: AgentCanvasCommand['type'][];
}
```

- Each agent gets a policy (stored in DB, configurable via RbacManager)
- Commands are validated against policy before execution
- Dangerous commands (`deleteNode`, `runLayout`) require confirmation callback
- Audit log via existing `AuditDashboard`

### 4. LivingCanvas Integration Points

```typescript
// In LivingCanvas.tsx - expose via EventBus
const eventBus = getCanvasEventBus();

// Agent commands arrive as CanvasEvent
eventBus.on('agent:command', ({ command, respond }) => {
  const result = await executeCommand(command);
  respond({ type: 'agent:response', payload: result });
});

// LivingCanvas emits events agents can subscribe to
eventBus.emit('canvas:nodeCreated', { nodeId, slotId });
eventBus.emit('canvas:streamEvent', { nodeId, event: StreamEvent });
eventBus.emit('canvas:layoutChanged', { intent, positions });
```

### 5. Natural Language → Command Mapping

```typescript
// In agent's prompt / system prompt
const CANVAS_COMMAND_EXAMPLES = `
When user says "arrange chat nodes in a timeline":
→ { type: 'canvas.runLayout', payload: { intent: 'timeline' } }

When user says "connect the streaming node to the result node":
→ { type: 'canvas.connectNodes', payload: { from: 'chatgpt:chat.streaming', to: 'chatgpt:chat.result' } }

When user says "start streaming the send_message capability":
→ { type: 'canvas.startStream', payload: { nodeId: 'chatgpt:chat.send', capabilityId: 'send_message' } }
`;
```

---

## Implementation Tasks

| Task | File | Effort |
|------|------|--------|
| 1. Define `AgentCanvasCommand` / `AgentCanvasResponse` types | `shared/agent-canvas.ts` | 1h |
| 2. Create `/api/agent/canvas/command` endpoint | `src/app/api/agent/canvas/command/route.ts` | 2h |
| 3. Implement `CanvasCommandExecutor` | `src/engines/canvas-command-executor.ts` | 4h |
| 4. Add policy validation middleware | `src/middleware/agent-canvas-policy.ts` | 2h |
| 5. Wire EventBus in LivingCanvas | `LivingCanvas.tsx` | 2h |
| 6. Add agent policy CRUD to RbacManager | `RbacManager.tsx` | 3h |
| 7. Update agent system prompt with canvas commands | `src/engines/agent-prompts.ts` | 1h |
| 8. E2E tests for agent→canvas flows | `tests/e2e/agent-canvas.spec.ts` | 3h |

**Total: ~18 hours**

---

## Acceptance Criteria

1. Agent can create a node: `POST /api/agent/canvas/command` with `{ type: 'canvas.createNode', payload: { slotId: 'chat.thread' } }` → node appears on canvas
2. Agent can run layout: `{ type: 'canvas.runLayout', payload: { intent: 'timeline' } }` → nodes reorganize
3. Agent can start stream: `{ type: 'canvas.startStream', payload: { nodeId: 'chatgpt:chat.send', capabilityId: 'send_message' } }` → StreamingNodeWrapper shows live output
4. Policy enforcement: Agent without `canvas.deleteNode` permission gets 403
5. Audit log: All commands logged with agentId, timestamp, result
6. Real-time: Agent receives `canvas:streamEvent` events as they happen

---

## Open Questions

1. **Command granularity** — Single atomic commands vs. batch transactions?
2. **Confirmation UX** — Modal in canvas? Toast? Separate approval queue?
3. **Multi-agent** — Can multiple agents operate on same canvas? Conflict resolution?
3. **Rollback** — Undo via CommandStack (already exists) — expose to agents?
4. **Streaming ownership** — Who controls pause/resume/stop? Agent or user?