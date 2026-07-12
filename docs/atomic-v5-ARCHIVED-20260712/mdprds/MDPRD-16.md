> **⚠️ SUPERSEDED — See docs/atomic-v4-fork-canon/ (MASTER) for current phase specs.**
> This MDPRD has been migrated to fork-canon.

# MDPRD-16: Kernel Surfaces

**Phase:** 16 — Kernel Surfaces
**Units:** 16.1–16.4
**Status:** DRAFT
**Depends on:** Phase 0 (Kernel Core), Phase 15 (Kernel Oracle)

## 1. Problem

The kernel (Phase 0) and oracle (Phase 15) provide rich self-understanding data.
But there is no way for humans or external tools to access it. The system's
self-knowledge is locked inside the process.

## 2. Goal

Expose the kernel and oracle through all interaction surfaces — REST API, MCP tools,
CLI commands, and a frontend dashboard. Every surface provides the same information
with surface-appropriate ergonomics.

### 2.1 Kernel REST API (Unit 16.1)

HTTP routes for kernel data.

```
GET  /api/kernel/topology              → SystemTopology (full registry dump)
GET  /api/kernel/health                → HealthSnapshot (aggregate health)
GET  /api/kernel/engines               → EngineDescriptor[]
GET  /api/kernel/engines/:id           → EngineDescriptor
GET  /api/kernel/trace/:traceId        → TraceSpan[]
GET  /api/kernel/provenance/:traceId   → CausalNode[]
GET  /api/kernel/spans?limit=N         → TraceSpan[] (recent)
GET  /api/kernel/config/:engineId      → engine config
PUT  /api/kernel/config/:engineId      → update engine config
POST /api/kernel/diagnose              → DiagnosticIssue[]
POST /api/kernel/diagnose/:engineId    → DiagnosticIssue[] (single engine)
POST /api/kernel/heal                  → HealAction
POST /api/kernel/heal/:issueId         → HealAction (specific issue)
GET  /api/kernel/oracle?q=...          → QueryResult
GET  /api/kernel/events?limit=N        → OracleEvent[]
```

**Implementation:**
- New file: `src/server/routes/kernel-routes.ts`
- Registered in `createServerWithEngines()` after kernel bootstrap
- All routes read from KernelRegistry/Tracer/Provenance (no DB queries per request)
- WebSocket subscription for `/ws/kernel` (real-time oracle events)

### 2.2 Kernel MCP Tools (Unit 16.2)

MCP tools for the system to query itself.

```typescript
// Registered in src/mcp/server.ts
kernelTools: [
  {
    name: 'system.describe',
    description: 'Describe the full system topology — engines, stores, capabilities, routes, wiring',
    handler: () => kernel.registry.describe()
  },
  {
    name: 'system.health',
    description: 'Get aggregate health snapshot of all engines',
    handler: () => kernel.oracle.health()
  },
  {
    name: 'system.diagnose',
    description: 'Scan for problems — stubs, broken wires, missing deps, health issues',
    handler: () => kernel.oracle.diagnose()
  },
  {
    name: 'system.explain',
    description: 'Explain why something happened — trace causal chain',
    handler: (traceId: string) => kernel.oracle.explain(traceId)
  },
  {
    name: 'system.heal',
    description: 'Trigger corrective action for a detected problem',
    handler: (issueId: string) => kernel.oracle.heal(issueId)
  },
  {
    name: 'system.config',
    description: 'Get or set engine configuration',
    handler: (engineId: string, config?: Record<string, unknown>) => {
      if (config) return kernel.config.updateScoped(engineId, config)
      return kernel.config.readScoped(engineId)
    }
  },
  {
    name: 'system.trace',
    description: 'Get trace spans for a specific trace ID',
    handler: (traceId: string) => kernel.tracer.getTrace(traceId)
  }
]
```

### 2.3 Kernel CLI (Unit 16.3)

CLI commands for kernel operations.

```bash
# System overview
bun run kernel status              → system topology + health summary
bun run kernel status --engine X   → single engine details

# Diagnostics
bun run kernel diagnose            → scan all engines for issues
bun run kernel diagnose --engine X → scan single engine

# Tracing
bun run kernel trace <traceId>     → show trace tree (spans with timing)
bun run kernel trace --recent N    → show N most recent traces

# Provenance
bun run kernel provenance <traceId> → show causal chain
bun run kernel provenance --engine X → show provenance for engine

# Config
bun run kernel config <engineId>       → show engine config
bun run kernel config <engineId> --set 'key=value' → update config

# Oracle
bun run kernel oracle 'why did chatgpt fail?' → query oracle
bun run kernel oracle --heal <issueId>        → trigger heal

# Events
bun run kernel events --last N     → show N most recent kernel events
```

**Implementation:**
- Extend `devops/cli.ts` with kernel subcommands
- Each command maps to kernel/oracle API calls
- Formatted output with tables, colors, and tree views

### 2.4 Kernel Frontend Surface (Unit 16.4)

React component for the Oracle dashboard in the VIVIM UI.

```typescript
// web/ui/src/components/oracle/OracleDashboard.tsx
// - System topology visualization (engine nodes + dependency edges)
// - Health summary (traffic light per engine)
// - Diagnostic issues list (severity-filtered)
// - Trace viewer (select trace → see span tree)
// - Provenance viewer (select trace → see causal chain)
// - Config editor (select engine → edit config)
// - Real-time event stream (WebSocket subscription)

// Routes:
// /oracle                    → OracleDashboard
// /oracle/topology           → TopologyView
// /oracle/diagnostics        → DiagnosticsView
// /oracle/traces             → TraceExplorer
// /oracle/config/:engineId   → ConfigEditor
```

**Components:**
- `OracleDashboard.tsx` — main layout with sidebar navigation
- `TopologyView.tsx` — force-directed graph of engines + dependencies
- `DiagnosticsView.tsx` — filterable issue list with severity badges
- `TraceExplorer.tsx` — trace list + span tree visualization
- `ProvenanceView.tsx` — causal chain visualization
- `ConfigEditor.tsx` — JSON editor for engine config
- `EventStream.tsx` — real-time event log
- `HealthBadge.tsx` — traffic light health indicator

## 3. Non-Goals

- Advanced analytics (charts, trends) — future phase
- Autonomous learning UI — future phase
- Mobile app — out of scope

## 4. Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Kernel Surfaces                    │
├──────────┬──────────┬──────────┬───────────────────┤
│ REST API │ MCP Tools│   CLI    │   Frontend UI     │
│ (16.1)   │ (16.2)   │ (16.3)  │   (16.4)         │
├──────────┴──────────┴──────────┴───────────────────┤
│              KernelOracle (Phase 15)                │
├────────────────────────────────────────────────────┤
│              KernelCore (Phase 0)                   │
└────────────────────────────────────────────────────┘
```

All surfaces read from the same KernelCore + KernelOracle — consistent data everywhere.

## 5. Dependencies

- Phase 0: KernelCore
- Phase 15: KernelOracle
- Existing: Server (routes), MCP server (tools), CLI (commands), Frontend (React)

## 6. Success Criteria

- [ ] `GET /api/kernel/topology` returns full system topology
- [ ] `system.describe` MCP tool returns topology
- [ ] `bun run kernel status` prints formatted topology
- [ ] OracleDashboard renders in frontend at /oracle
- [ ] Diagnostic issues display with severity badges
- [ ] Trace explorer shows span trees
- [ ] Real-time events stream to frontend via WebSocket
- [ ] All surfaces show consistent data
- [ ] Unit tests: >80% coverage on routes, MCP tools, CLI commands
- [ ] E2E tests: kernel surfaces display correct data

