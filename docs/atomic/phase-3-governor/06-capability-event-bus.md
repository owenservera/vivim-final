# Unit 3.6: CapabilityEventBus

**Phase:** 3 | **File:** `src/engines/capability-event-bus.ts`
**Depends:** — (singleton, no deps) | **Produces:** Typed in-process pub/sub
**Source:** `04-merged-engines.md` §7

## Purpose
Typed in-process pub/sub for all inter-engine and engine-to-frontend communication. Transient events — no DB persistence. Singleton per process.

## Interface
```typescript
class CapabilityEventBus {
  private static instance: CapabilityEventBus | null = null;
  private handlers: Map<string, Set<EventHandler>> = new Map();
  private onceHandlers: Map<string, Set<EventHandler>> = new Map();
  private wsSubscriptions: Map<WebSocket, Map<string, Set<string>>> = new Map();

  static getInstance(): CapabilityEventBus {
    if (!CapabilityEventBus.instance) {
      CapabilityEventBus.instance = new CapabilityEventBus();
    }
    return CapabilityEventBus.instance;
  }

  emit<T extends CapabilityEvent>(event: T): void;
  on<T extends CapabilityEvent>(type: string, handler: EventHandler<T>): () => void;
  once<T extends CapabilityEvent>(type: string, handler: EventHandler<T>): () => void;
  subscribe(ws: WebSocket, entityType: string, entityId: string): void;
  unsubscribe(ws: WebSocket, entityType: string, entityId: string): void;
  unsubscribeAll(ws: WebSocket): void;
  removeAllListeners(type?: string): void;
}

type EventHandler<T extends CapabilityEvent = CapabilityEvent> = (event: T) => void;
```

## Core Event Types (v1)
```typescript
type CapabilityEvent =
  | { type: 'capability:executed'; capabilityId: string; providerId: string; traceId: string; ok: boolean; latencyMs: number }
  | { type: 'capability:failed'; capabilityId: string; providerId: string; traceId: string; error: string; recoveryBehavior: string }
  | { type: 'capability:confidence_changed'; capabilityId: string; providerId: string; from: number; to: number }
  | { type: 'capability:selector_drifted'; capabilityId: string; providerId: string; selector: string; missCount: number }
  | { type: 'capability:status_changed'; capabilityId: string; providerId: string; from: string; to: string }
  | { type: 'capability:progress'; step: number; total: number; description: string; moduleId: string; slaveId: string }
  | { type: 'account:login_state'; accountId: string; providerId: string; from: string; to: string }
  | { type: 'account:plan_tier_changed'; accountId: string; providerId: string; from: string; to: string }
  | { type: 'account:created'; accountId: string; providerId: string; email: string }
  | { type: 'account:removed'; accountId: string; providerId: string }
  | { type: 'fleet:slave_status'; slaveId: string; providerId: string; status: SlaveStatus; superState: SuperState }
  | { type: 'fleet:crash_detected'; slaveId: string; providerId: string; consecutiveFailures: number }
  | { type: 'fleet:circuit_changed'; slaveId: string; providerId: string; from: string; to: string }
  | { type: 'conversation:complete'; conversationId: string; message: ConversationMessageRow }
  | { type: 'conversation:error'; conversationId: string; error: string }
  | { type: 'conversation:created'; conversationId: string; providerId: string; accountId: string }
  | { type: 'provider:seeded'; providerId: string; capabilities: number }
  | { type: 'provider:health_changed'; providerId: string; from: string; to: string; score: number }
  | { type: 'config:changed'; engineId: string; actor: string }
  | { type: 'telemetry:cycle_complete'; scheduleName: string; rowsWritten: number; durationMs: number };
```

## Publisher / Subscriber Table
| Publisher | Events Published |
|-----------|-----------------|
| `ChromeGovernor.CDPProxy` | `capability:executed`, `capability:failed`, `capability:progress`, `capability:selector_drifted` |
| `ChromeGovernor.HealthMonitor` | `fleet:slave_status`, `fleet:crash_detected`, `fleet:circuit_changed` |
| `ChromeGovernor.LifecycleManager` | `fleet:slave_status`, `account:created`, `account:removed`, `account:login_state`, `account:plan_tier_changed` |
| `ConversationManager` | `conversation:complete`, `conversation:error` |
| `ConversationStore` | `conversation:created` |
| `StreamParserEngine` | `capability:confidence_changed` |
| `CapabilityEngine` | `capability:selector_drifted` |
| `ProviderRegistrar` | `provider:seeded` |
| `ProviderHealthKernel` | `provider:health_changed` |
| `ConfigManager` | `config:changed` |
| `TelemetryAggregator` | `telemetry:cycle_complete` |

## Tests
- [ ] `getInstance()` returns singleton
- [ ] `emit()` delivers event to all registered handlers
- [ ] `on()` registers handler, returns unsubscribe function
- [ ] `once()` fires handler once then auto-removes
- [ ] `subscribe(ws, entityType, entityId)` registers WebSocket subscription
- [ ] `unsubscribe(ws, entityType, entityId)` removes subscription
- [ ] `unsubscribeAll(ws)` removes all subscriptions for a WebSocket
- [ ] Multiple handlers for same event type all receive the event

## Gate
- `bunx tsc --noEmit` passes
- All tests pass
- Singer, no dependencies — can be created first in boot sequence
