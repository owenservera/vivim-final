# Event Bus SOTA & Best Practices — Research Report

*Generated: 2026-07-12 | Sources: 18 | Confidence: High*

## Executive Summary

The event bus is the circulatory system of vivim-final. Research across 18 sources from 2025-2026 reveals a clear SOTA: **typed discriminated unions** as the foundation, **event envelopes** with correlation/causation metadata, **per-handler error isolation** via `Promise.resolve().then().catch()` normalization, **bounded ring buffers** with DB overflow, and **wildcard/glob subscriptions** for cross-cutting concerns. The current `CapabilityEventBus` is functional but lacks error isolation, async handler support, event envelopes, and correlation tracing — all of which are now standard in production systems.

---

## 1. Typed Discriminated Unions (SOTA Foundation)

The 2025-2026 consensus: **discriminated unions are the correct foundation for typed event buses in TypeScript.**

### Pattern

```typescript
type DomainEvent =
  | { kind: 'capability:executed'; capabilityId: string; providerId: string; latencyMs: number }
  | { kind: 'capability:failed'; capabilityId: string; error: string }
  | { kind: 'fleet:crash_detected'; slaveId: string; consecutiveFailures: number }
  // ... every event is a variant with a literal `kind` discriminator

// publish narrows by kind
bus.publish('capability:executed', { capabilityId: 'cap.chat.send', providerId: 'chatgpt', latencyMs: 42 })

// subscribe narrows handler argument
bus.on('capability:executed', (e) => {
  e.capabilityId  // string — not unknown, not optional
  e.latencyMs     // number — compiler guarantees the shape
})
```

**Why this works:**
- `publish("typo", ...)` — compile error (unknown kind)
- `publish("capability:executed", { wrong: "shape" })` — compile error (payload mismatch)
- Inside handler, `e.error` — compile error (wrong variant)

### Source Evidence

- "A typed bus is one of those patterns where the cost is paid up front and the payoff compounds. Once `publish` and `subscribe` exist on the same union, every new event is one entry in `DomainEvent`, one publisher line, however many subscribers want it, and zero meetings about 'what fields does that event carry again.' The compiler is the documentation." ([DEV Community — Build a Type-Safe Event Bus, May 2026](https://dev.to/gabrielanhaia/build-a-type-safe-event-bus-in-typescript-2b81))

- "The discriminated union does the rest. Inside the handler you `switch (e.kind)` and the checker narrows each case to the right payload, with `assertNever` at the bottom for the same exhaustiveness guarantee." ([DEV Community — Typed EventBus, Mar 2026](https://dev.to/young_gao/building-a-type-safe-event-bus-in-typescript-decouple-your-microservices-3mm3))

- Herald library (0.3 KB gzipped) provides full TypeScript inference with `createBus<AppEvents>()` — typed `emit`, `on`, `once`, `wait`, `events` async generator. ([Vielzeug — Herald](https://vielzeug.dev/herald/))

### Vivim Gap

Current bus uses `type: string` with a union, but `emit()` accepts `EngineEvent` without narrowing by kind. The `on()` handler receives `EventHandler<T>` but the generic doesn't flow from the discriminated union. **Recommendation:** Adopt the `publish(kind, payload)` / `subscribe(kind, handler)` dual-generic pattern.

---

## 2. Event Envelope Pattern (Metadata Layer)

SOTA events are not bare payloads — they're wrapped in an **envelope** with tracing metadata.

### Pattern

```typescript
interface EventEnvelope<T = unknown> {
  event: T
  metadata: {
    eventId: string          // unique ID for dedup
    timestamp: number
    source: string           // which engine emitted this
    correlationId?: string   // links events in a workflow
    causationId?: string     // what event caused this one
  }
}
```

### Why This Matters

- **Correlation:** Link `capability:failed` → `fleet:crash_detected` → `capability:executed` (retry) in a single trace
- **Dedup:** `eventId` prevents double-processing
- **Source tracking:** Know which engine emitted which event
- **Replay:** Envelope metadata enables event sourcing and time-travel debugging

### Source Evidence

- "Every event has taskId, executionId (where applicable), timestamp. Zod schema for runtime validation." ([nexus-agents Issue #912](https://github.com/williamzujkowski/nexus-agents/issues/912))

- "The `metadata` field is not decoration — it's the mechanism that turns a fire-and-forget broadcast into a traceable, auditable, replayable event system." ([OneUptime — Event Bus with RxJS](https://oneuptime.com/blog/post/2026-01-25-event-bus-typescript-rxjs/view))

- Confluent's agentic event-driven architecture requires every event to carry correlation IDs for closed-loop feedback systems. ([Confluent — Agentic Event-Driven Systems](https://www.confluent.io/blog/autonomous-agentic-event-driven-systems-architecture/))

### Vivim Gap

Current events have no `eventId`, no `correlationId`, no `causationId`, no `source` field. The `traceId` field exists on some events but not all. **Recommendation:** Wrap all events in an envelope with full metadata.

---

## 3. Per-Handler Error Isolation (Critical)

**The single most important production improvement.** One handler throwing must not kill other handlers.

### Pattern (SOTA 2026)

```typescript
async publish<K extends EventKind>(kind: K, event: EventOf<K>): Promise<void> {
  const handlers = this.handlers[kind] ?? []
  const tasks: Promise<void>[] = []

  for (const h of handlers) {
    tasks.push(
      Promise.resolve()
        .then(() => h(event))
        .catch((err) => {
          console.error(`[bus] ${kind} handler failed`, err)
          // Handler failure does NOT affect other handlers
        })
    )
  }

  await Promise.allSettled(tasks)
}
```

**The trick:** `Promise.resolve().then(() => h(event)).catch(...)` normalizes both sync throws and async rejections into the same isolation path. The naive `try/catch` only catches sync throws — async rejections become unhandled.

### Source Evidence

- "The naive shape (`try { void run(); } catch (err) { ... }`) only catches synchronous throws. A handler that returns a rejected promise slips past the `try/catch` and lands as an unhandled rejection because `void` discards the promise. Wrapping in `Promise.resolve().then(run).catch(...)` normalises both shapes." ([DEV Community — Type-Safe Event Bus, May 2026](https://dev.to/gabrielanhaia/build-a-type-safe-event-bus-in-typescript-2b81))

- "Both sync `throw` and async `Promise` rejections are routed through `onError`." ([typed-event-bus](https://github.com/p-vbordei/typed-event-bus))

- "A subscriber that throws on a particular event must not prevent the other subscribers from receiving the same event. The publisher gets back a list of failures and decides what to do with them." ([Stéphane Erard — Event Bus](https://serard.dev/content/blog/ts-ddd/10-event-bus.html))

### Vivim Gap

Current `emit()` calls handlers synchronously with no error isolation:
```typescript
// CURRENT (line 148-150)
for (const handler of handlers) {
  handler(event)  // ← if this throws, all subsequent handlers are skipped
}
```
**This is a production bug.** A failing telemetry handler would kill the conversation handler. **Recommendation:** Wrap in `Promise.resolve().then().catch()` with per-handler isolation.

---

## 4. Fire-and-Forget vs Awaitable Publish

SOTA buses offer two publish modes:

| Mode | Use Case | Behavior |
|------|----------|----------|
| `publish()` | Production hot path | Fire-and-forget, returns immediately |
| `publishAndWait()` | Tests, shutdown, critical paths | Awaits all handlers, returns failures |

### Source Evidence

- "The defaults that work for most domain-event traffic: `publish` is fire-and-forget at the call site, handlers run concurrently inside `publish`, errors in one handler do not affect others, and a separate awaitable variant exists for tests and shutdown." ([DEV Community — May 2026](https://dev.to/gabrielanhaia/build-a-type-safe-event-bus-in-typescript-2b81))

- `typed-event-bus`: "`emit()` returns a promise that resolves after all async listeners settle. Useful when you want to await side-effects (e.g. in tests)." ([typed-event-bus](https://github.com/p-vbordei/typed-event-bus))

### Vivim Gap

Current `emit()` is synchronous fire-and-forget only. No awaitable variant for tests. **Recommendation:** Add `publishAndWait()` for test determinism and graceful shutdown.

---

## 5. Wildcard / Glob Subscriptions

For cross-cutting concerns (audit, metrics, tracing, logging), wildcard subscriptions are standard.

### Pattern

```typescript
// Exact match
bus.on('capability:executed', handler)

// Wildcard — single segment
bus.on('capability:*', handler)  // matches all capability events

// Glob — any depth
bus.on('*', handler)  // catch-all for all events

// Hierarchical topics
bus.on('fleet.**', handler)  // matches fleet:slave_status, fleet:crash_detected, fleet:circuit_changed
```

### Source Evidence

- `eventbus-ts`: "Subscribers can match topics with glob wildcards (`*`, `**`, `?`) instead of binding to a single event name. Topic semantics scale up to large message-style buses without per-event boilerplate." ([eventbus-ts](https://github.com/nripankadas07/eventbus-ts))

- Herald: "`onAny()` wildcard listener for bus-wide observability (logging, analytics, tracing)." ([Herald](https://vielzeug.dev/herald/))

- "Some subscribers want every event. Audit logs. Outbox writers. Metrics counters. A catch-all subscriber is a function `(e: DomainEvent) => void`." ([DEV Community — May 2026](https://dev.to/gabrielanhaia/build-a-type-safe-event-bus-in-typescript-2b81))

### Vivim Gap

Current bus has no wildcard support. To listen to all `capability:*` events, you must subscribe to each variant individually. **Recommendation:** Add wildcard subscription for cross-cutting concerns.

---

## 6. Bounded Ring Buffer with DB Overflow

For in-process event buses, bounded memory is mandatory.

### Pattern

```
Ring Buffer (500-1000 events in memory)
  ↓ overflow
Batch persist to SQLite/PostgreSQL
  ↓ query
Merge ring buffer + DB results for queries
```

### Source Evidence

- "Bounded circular buffer (max 10k events). Buffer evicts oldest events when full." ([nexus-agents](https://github.com/williamzujkowski/nexus-agents/issues/912))

- "AsyncQueue uses circular buffer with power-of-2 sizing — O(1) operations vs O(n) array.shift()." ([async-queue-js](https://github.com/o2alexanderfedin/async-queue-js/))

- "If you need backpressure (a handler slower than the publish rate, an unbounded queue you cannot afford), the bus is the wrong tool. That problem belongs in a real broker." ([DEV Community — May 2026](https://dev.to/gabrielanhaia/build-a-type-safe-event-bus-in-typescript-2b81))

### Vivim Gap

Current bus uses `recent: EngineEvent[]` with `shift()` on overflow — O(n) per eviction. No DB overflow. **Recommendation:** Use circular buffer with head/tail pointers (O(1)) and batch-persist to `kernel_events` table on overflow.

---

## 7. Snapshot Semantics During Dispatch

When a handler modifies the subscription set during dispatch, the behavior must be deterministic.

### Pattern

```typescript
// Snapshot subscription map BEFORE invoking handlers
const snapshot = [...this.handlers.get(kind)]

for (const handler of snapshot) {
  // Even if a handler unsubscribes, snapshot is unaffected
  await handler(event)
}
```

### Source Evidence

- "`publish` takes a snapshot of the subscription map before invoking handlers. If a handler modifies the subscription set: newly added subscribers do not receive the in-flight event; subscribers removed during dispatch do not receive the in-flight event." ([eventbus-ts](https://github.com/nripankadas07/eventbus-ts))

### Vivim Gap

Current bus iterates the live `handlers` Set — if a handler calls `removeAllListeners()` during dispatch, subsequent handlers in the same batch are skipped. **Recommendation:** Snapshot before dispatch.

---

## 8. Dead Letter Queue (DLQ)

For events that fail all retries, a DLQ prevents data loss.

### Pattern

```typescript
interface DLQEntry {
  event: EngineEvent
  error: Error
  attempts: number
  timestamp: number
}

class EventBus {
  private dlq: DLQEntry[] = []

  // After N failed attempts, move to DLQ
  private moveToDLQ(event: EngineEvent, error: Error, attempts: number) {
    this.dlq.push({ event, error, attempts, timestamp: Date.now() })
  }

  // Retry DLQ entries
  async retryDLQ(): Promise<void> { ... }
}
```

### Source Evidence

- "When handlers fail, push to a dead letter queue and retry later." ([DEV Community — Mar 2026](https://dev.to/young_gao/building-a-type-safe-event-bus-in-typescript-decouple-your-microservices-3mm3))

- "Subscribe with dead letter queue for failed events — dlqHandler receives the event and error." ([OneUptime — RxJS Event Bus](https://oneuptime.com/blog/post/2026-01-25-event-bus-typescript-rxjs/view))

### Vivim Gap

No DLQ exists. Failed events are silently dropped. **Recommendation:** Add DLQ with configurable retry count and manual retry capability.

---

## 9. AI Agent Event Architecture (2025-2026)

The emerging consensus for AI agent systems:

### Hybrid Pattern

| Communication | Pattern | Example |
|---------------|---------|---------|
| Within agent (tool calls) | Request-response (synchronous) | MCP `tools/call` |
| Between agents | Event-driven (pub/sub) | A2A protocol |
| Long-running workflows | Durable execution + events | Temporal + Kafka |

### Closed-Loop Control

```
Event Ingestion → Context Enrichment → Agent Reasoning → Decision Emission
       ↑                                                        ↓
   Outcome Event ← Action Execution ← Policy Validation ← Command Event
```

### Source Evidence

- "Use request-response for tool calls within a single agent's reasoning loop (MCP tool invocations are synchronous by design), and EDA for everything else — agent-to-agent communication, cross-system integration, and long-running workflows." ([Zylos Research — EDA for AI Agent Systems, Mar 2026](https://zylos.ai/research/2026-03-02-event-driven-architecture-ai-agent-systems/))

- "The production architecture emerging in the industry: Kafka as the durable backbone, A2A for inter-agent delegation, MCP for tool access." ([Zylos Research](https://zylos.ai/research/2026-03-02-event-driven-architecture-ai-agent-systems/))

- "Every agent follows the same contract: subscribe → reason → publish. Agents do not share logic, state, or control flow." ([Confluent — Agentic Event-Driven Systems](https://www.confluent.io/blog/autonomous-agentic-event-driven-systems-architecture/))

### Vivim Relevance

The CapabilityEventBus is the in-process EDA backbone. The kernel (Phase 0) adds the tracing/provenance layer. The oracle (Phase 15) adds the closed-loop feedback. This aligns with the 2026 consensus.

---

## 10. Key Takeaways for vivim-final

### Must-Have (Production Critical)

1. **Per-handler error isolation** — wrap every handler in `Promise.resolve().then().catch()`. Current code has a production bug where one throw kills all handlers.

2. **Event envelope with metadata** — wrap all events in `{ event, metadata: { eventId, timestamp, source, correlationId, causationId } }`. This enables kernel tracing and provenance.

3. **Async handler support** — handlers should return `void | Promise<void>`. Bus should handle both sync and async transparently.

4. **Snapshot dispatch** — copy handler set before iterating to prevent mutation-during-dispatch bugs.

### Should-Have (SOTA Alignment)

5. **Wildcard subscriptions** — `on('capability:*', handler)` for cross-cutting concerns (audit, metrics, tracing).

6. **Bounded ring buffer with DB overflow** — O(1) circular buffer, batch-persist to `kernel_events` table.

7. **`publishAndWait()` variant** — awaitable publish for tests and graceful shutdown.

8. **Dead Letter Queue** — events that fail all retries go to DLQ for manual inspection.

### Nice-to-Have (Future)

9. **Middleware pipeline** — intercept events before handlers run (for validation, logging, rate limiting).

10. **Event replay** — re-emit historical events from the ring buffer or DB for testing and debugging.

---

## Sources

1. [DEV Community — Build a Type-Safe Event Bus in TypeScript](https://dev.to/gabrielanhaia/build-a-type-safe-event-bus-in-typescript-2b81) — Discriminated unions, `assertNever`, error isolation patterns (May 2026)
2. [DEV Community — Building a Type-Safe Event Bus (Microservices)](https://dev.to/young_gao/building-a-type-safe-event-bus-in-typescript-decouple-your-microservices-3mm3) — Cross-service with Redis, DLQ (Mar 2026)
3. [p-vbordei/typed-event-bus](https://github.com/p-vbordei/typed-event-bus) — Tiny typed bus, `onAny`, `waitFor`, error isolation
4. [sckv/typed-bus](https://github.com/sckv/typed-bus) — io-ts based, transport abstraction, orphan events
5. [Stéphane Erard — EventDef and Typed EventBus](https://serard.dev/content/blog/typed-events-fsm/02-eventdef-and-typed-bus.html) — Phantom types, `TEmits`/`TListens` separation, topology scanner
6. [Herald — Typed Event Bus](https://vielzeug.dev/herald/) — 0.3KB, `wait`, `events` async generator, AbortSignal, middleware
7. [OneUptime — Event Bus with RxJS](https://oneuptime.com/blog/post/2026-01-25-event-bus-typescript-rxjs/view) — ReplaySubject, bufferTime, backpressure, error handling
8. [nripankadas07/eventbus-ts](https://github.com/nripankadas07/eventbus-ts) — Glob wildcards, topic hierarchy, snapshot dispatch
9. [event-driven.io — In-Memory Message Bus](https://event-driven.io/en/inmemory_message_bus_in_typescript/) — Command vs event separation, outbox pattern
10. [nexus-agents Issue #912](https://github.com/williamzujkowski/nexus-agents/issues/912) — Bounded circular buffer, artifact store, provenance
11. [async-queue-js](https://github.com/o2alexanderfedin/async-queue-js/) — 10M ops/sec async queue, backpressure, circular buffer
12. [BoundlessDB](https://registry.npmjs.org/boundlessdb) — DCB event store, SQLite/PostgreSQL, consistency keys
13. [node-event-storage](https://github.com/albe/node-event-storage/) — Embedded event store, optimistic concurrency, DCB, consumers
14. [Zylos Research — EDA for AI Agent Systems](https://zylos.ai/research/2026-03-02-event-driven-architecture-ai-agent-systems/) — Pub/sub, event sourcing, A2A+MCP architecture (Mar 2026)
15. [Zylos Research — Agent Workflow Orchestration Patterns](https://zylos.ai/research/2026-04-14-agent-workflow-orchestration-patterns) — DAG vs EDA vs Actor, Temporal, LangGraph (Apr 2026)
16. [Confluent — Agentic Event-Driven Systems](https://www.confluent.io/blog/autonomous-agentic-event-driven-systems-architecture/) — 8-layer architecture, closed-loop control (May 2026)
17. [Hooksbase — EDA for AI Agents](https://www.hooksbase.com/blog/event-driven-architecture-for-ai-agents) — Event notification vs event-carried state transfer (Apr 2026)
18. [arXiv — Autonomous Event-Driven Multi-Agent Orchestration](https://arxiv.org/abs/2606.20058v1) — Scale dominates complexity, Task Manager for continuous operation (Jun 2026)

## Methodology

Searched 12 queries across web and news. Analyzed 18 sources. Sub-questions investigated:
- Typed event bus patterns for TypeScript (2025-2026)
- Ring buffer and bounded memory patterns
- Error isolation and backpressure in event systems
- Event envelope and metadata patterns
- AI agent event-driven architecture
- Wildcard/glob subscription patterns
- Dead letter queue implementations
