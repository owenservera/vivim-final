> **⚠️ SUPERSEDED — See docs/atomic-v4-fork-canon/ (MASTER) for current phase specs.**
> This MDPRD has been migrated to fork-canon.

# MDPRD-00: Kernel Core

**Phase:** 0 — Kernel Core
**Units:** 0.1–0.6
**Status:** DRAFT
**Depends on:** Nothing (must be built first)

## 1. Problem

Every engine, store, capability, and route in vivim-final is built in isolation. There is no
central registry of what exists, no unified tracing, no provenance tracking, and no way to
query the system about itself. When something fails, we must manually trace code paths.
When adding a new engine, we must manually wire it into 4-5 different contexts. There is
no single source of truth for "what is the system's current state."

## 2. Goal

Build the KernelCore — a lightweight, zero-overhead native self-understanding layer that
lives at the bootstrap level of the server. Every engine, store, and route registers with
the kernel at construction time. The kernel provides:

- **Live topology map** (what engines exist, what's wired, what's healthy)
- **Span-based tracing** (every operation creates trace spans with timing/errors)
- **Causal provenance** (what caused what — selector→parser→result chains)
- **Schema tables** (stores tracing data, provenance, topology snapshots)

The kernel is always-on, always-watching, always-queryable. It adds zero overhead when
not queried (lazy evaluation, ring buffer only).

## 3. Non-Goals

- Self-healing logic (Phase 15: Kernel Oracle)
- UI surfaces (Phase 16: Kernel Surfaces)
- MCP/CLI tools (Phase 16: Kernel Surfaces)
- Migration of existing engines (Phase 1+ adds registration hooks)

## 4. Architecture

### 4.1 KernelRegistry (Unit 0.1)

Central registry that every engine calls at construction time.

```typescript
interface EngineDescriptor {
  id: string                    // e.g. "chrome-governor", "conversation-manager"
  kind: 'engine' | 'store' | 'capability' | 'route' | 'surface'
  layer?: string                // e.g. "chrome", "conversation", "core"
  dependencies: string[]        // ids of engines this depends on
  status: 'registered' | 'wired' | 'running' | 'error' | 'stopped'
  config: Record<string, unknown>
  health?: HealthState
  metadata: Record<string, unknown>
  registeredAt: number
  updatedAt: number
}

class KernelRegistry {
  registerEngine(desc: EngineDescriptor): void
  registerStore(desc: StoreDescriptor): void
  registerCapability(desc: CapabilityDescriptor): void
  registerRoute(desc: RouteDescriptor): void

  // Queries
  describe(): SystemTopology
  listEngines(filter?: { layer?: string; kind?: string; status?: string }): EngineDescriptor[]
  getEngine(id: string): EngineDescriptor | null
  getDependencies(id: string): string[]

  // Health
  updateHealth(id: string, health: HealthState): void

  // Lifecycle
  markWired(id: string): void
  markRunning(id: string): void
  markError(id: string, error: string): void
  markStopped(id: string): void
}
```

### 4.2 KernelContext (Unit 0.2)

Unified context object passed to every engine constructor.

```typescript
interface KernelContext {
  kernel: Kernel
  registry: KernelRegistry
  tracer: KernelTracer
  provenance: KernelProvenance
  eventBus: CapabilityEventBus
  config: ConfigManager
  store: KernelStore           // Prisma-backed persistence
  logger: KernelLogger
}
```

Every existing engine constructor gains an optional `KernelContext` parameter.
Engines that receive a KernelContext auto-register; engines that don't are
tracked as "legacy" (registered by the bootstrap).

### 4.3 KernelTracer (Unit 0.3)

Span-based tracing engine. Every significant operation creates a span.

```typescript
interface TraceSpan {
  id: string
  traceId: string
  parentId: string | null
  name: string
  startTime: number
  endTime?: number
  duration?: number            // computed
  status: 'ok' | 'error' | 'timeout'
  error?: string
  attrs: Record<string, unknown>  // providerId, slaveId, etc.
}

class KernelTracer {
  // Create span from function
  span<T>(name: string, parent: string | null, fn: () => Promise<T>, attrs?: Record<string, unknown>): Promise<T>

  // Manual span lifecycle
  start(name: string, parent: string | null, attrs?: Record<string, unknown>): string
  end(spanId: string, extra?: Record<string, unknown>): Promise<void>
  error(spanId: string, error: Error): Promise<void>

  // Queries
  getTrace(traceId: string): TraceSpan[]
  getRecentSpans(limit?: number): TraceSpan[]
  getSpansByEngine(engineId: string, limit?: number): TraceSpan[]
}
```

**Ring buffer:** 500 spans in memory. Overflow persists to DB.

### 4.4 KernelProvenance (Unit 0.4)

Causal chain recording — what caused what.

```typescript
interface CausalNode {
  id: string
  traceId: string
  parentId: string | null
  kind: 'selector' | 'parser' | 'result' | 'action' | 'error' | 'decision'
  engineId: string
  description: string
  input: unknown
  output: unknown
  duration?: number
  timestamp: number
}

class KernelProvenance {
  record(node: Omit<CausalNode, 'id' | 'timestamp'>): string
  getChain(traceId: string): CausalNode[]
  queryFailure(traceId: string): CausalChain
  queryByEngine(engineId: string, limit?: number): CausalNode[]
  queryByKind(kind: string, limit?: number): CausalNode[]
}
```

### 4.5 KernelSchema (Unit 0.5)

DB tables for kernel data.

```sql
-- Trace spans (ring buffer overflow + persistence)
CREATE TABLE kernel_spans (
  id TEXT PRIMARY KEY,
  trace_id TEXT NOT NULL,
  parent_id TEXT,
  name TEXT NOT NULL,
  start_time INTEGER NOT NULL,
  end_time INTEGER,
  duration INTEGER,
  status TEXT NOT NULL DEFAULT 'ok',
  error TEXT,
  attrs TEXT,  -- JSON
  engine_id TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Provenance nodes
CREATE TABLE kernel_provenance (
  id TEXT PRIMARY KEY,
  trace_id TEXT NOT NULL,
  parent_id TEXT,
  kind TEXT NOT NULL,
  engine_id TEXT NOT NULL,
  description TEXT NOT NULL,
  input TEXT,   -- JSON
  output TEXT,  -- JSON
  duration INTEGER,
  timestamp INTEGER NOT NULL
);

-- Topology snapshots (periodic)
CREATE TABLE kernel_topology (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot TEXT NOT NULL,  -- JSON: full SystemTopology
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- System events (ring buffer overflow)
CREATE TABLE kernel_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  engine_id TEXT,
  data TEXT,  -- JSON
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
```

Store contract: `src/storage/contracts/kernel-store.ts`

### 4.6 KernelBootstrap (Unit 0.6)

Wire the kernel into `createServerWithEngines()`.

```typescript
// In src/server/index.ts — bootstrap sequence:
// 1. Create Kernel instance (before any engines)
// 2. Create KernelContext with registry, tracer, provenance, config, store, logger
// 3. Pass KernelContext to every engine constructor
// 4. Each engine self-registers in its constructor
// 5. After all engines created: kernel.registry.describe() → topology snapshot
// 6. Start periodic topology snapshots (every 60s)
```

## 5. Dependencies

- Prisma (schema migration)
- Existing engines (no changes yet — registration hooks added per-engine later)
- CapabilityEventBus (for kernel event broadcasting)

## 6. Success Criteria

- [ ] `kernel.registry.describe()` returns accurate topology of all registered engines
- [ ] `kernel.tracer.span('test', null, async () => { ... })` creates and persists a span
- [ ] `kernel.provenance.record(...)` creates causal chain
- [ ] Topology snapshot writes to DB every 60s
- [ ] All 4 tables created via Prisma migration
- [ ] Unit tests: >80% coverage on all 6 kernel components
- [ ] Integration tests: kernel bootstrap with mock engines

