> **⚠️ SUPERSEDED — See docs/atomic-v4-fork-canon/ (MASTER) for current phase specs.**
> This MDPRD has been migrated to fork-canon.

# MDPRD-15: Kernel Oracle

**Phase:** 15 — Kernel Oracle
**Units:** 15.1–15.4
**Status:** DRAFT
**Depends on:** Phase 0 (Kernel Core), Phase 1 (E2E Bootstrap), Phase 6 (Platform Foundation)

## 1. Problem

The kernel (Phase 0) provides raw data — spans, provenance, topology. But raw data is
not understanding. There is no way to ask "why did this fail?", "what's broken?",
"how do I fix this?" and get an actionable answer. The system cannot explain itself
to operators or to itself.

## 2. Goal

Build the KernelOracle — a queryable self-model that can answer questions about the
system's state, diagnose problems, suggest fixes, and trigger self-healing. The oracle
is the system's "brain" — it watches the kernel data, detects patterns, and provides
actionable intelligence.

### 2.1 OracleQueryEngine (Unit 15.1)

Structured queries about system state.

```typescript
interface SystemQuery {
  type: 'topology' | 'health' | 'trace' | 'provenance' | 'config' | 'capability' | 'all'
  filter?: Record<string, unknown>
  limit?: number
}

interface QueryResult {
  query: SystemQuery
  answer: unknown
  confidence: number           // 0-1: how confident is the oracle
  suggestions: string[]        // actionable suggestions
  timestamp: number
}

class OracleQueryEngine {
  query(q: SystemQuery): Promise<QueryResult>
  describe(): Promise<TopologyDescription>
  health(): Promise<HealthSnapshot>
  explain(target: string): Promise<Explanation>
  capabilitySummary(): Promise<CapabilitySummary>
}
```

### 2.2 OracleDiagnosticEngine (Unit 15.2)

Detect problems — stubs, broken wires, missing deps, stalled engines, health degradation.

```typescript
interface DiagnosticIssue {
  id: string
  severity: 'critical' | 'warning' | 'info'
  category: 'stub' | 'broken-wire' | 'missing-dep' | 'stalled' | 'health-degraded' | 'config-missing' | 'schema-mismatch'
  engineId: string
  description: string
  evidence: string[]           // what data supports this diagnosis
  suggestedFix: string
  autoFixable: boolean
  detectedAt: number
}

class OracleDiagnosticEngine {
  scan(): Promise<DiagnosticIssue[]>
  scanEngine(engineId: string): Promise<DiagnosticIssue[]>
  getIssue(id: string): Promise<DiagnosticIssue | null>
  getIssuesBySeverity(severity: string): Promise<DiagnosticIssue[]>
  getIssuesByEngine(engineId: string): Promise<DiagnosticIssue[]>

  // Deep diagnostics
  checkStubs(): Promise<DiagnosticIssue[]>
  checkWiring(): Promise<DiagnosticIssue[]>
  checkHealth(): Promise<DiagnosticIssue[]>
  checkSchema(): Promise<DiagnosticIssue[]>
}
```

**Diagnostic checks:**
1. **Stub check:** Scan engine methods for `throw new Error('not implemented')` or `// TODO`
2. **Wire check:** Verify all declared dependencies exist and are running
3. **Health check:** Identify engines with degraded health or error status
4. **Schema check:** Verify DB tables match expected Prisma schema
5. **Config check:** Identify engines with missing required config

### 2.3 OracleActuator (Unit 15.3)

Self-healing actions — detect problems, fix them automatically.

```typescript
interface HealAction {
  id: string
  issueId: string              // links to DiagnosticIssue
  kind: 'restart-engine' | 'reconfigure' | 'clear-cache' | 'reset-circuit' | 'reconnect' | 'notify'
  engineId: string
  description: string
  parameters: Record<string, unknown>
  status: 'pending' | 'executing' | 'completed' | 'failed'
  result?: string
  executedAt?: number
}

class OracleActuator {
  heal(issueId: string): Promise<HealAction>
  getActions(limit?: number): Promise<HealAction[]>
  getAction(id: string): Promise<HealAction | null>
  undo(actionId: string): Promise<void>

  // Auto-healing policies
  getAutoHealPolicy(): Promise<AutoHealPolicy>
  setAutoHealPolicy(policy: AutoHealPolicy): Promise<void>
}
```

**Auto-heal policies (configurable from DB):**
- `stalledEngineRestart`: auto-restart engines stuck in error for >5min
- `circuitBreakerReset`: auto-reset circuit breakers after cooldown
- `configFallback`: use default config when required config missing
- `notify`: always notify operator (never auto-fix) for critical issues

### 2.4 OracleEventStream (Unit 15.4)

Real-time system state over WebSocket.

```typescript
interface OracleEvent {
  kind: 'health-changed' | 'issue-detected' | 'issue-resolved' | 'heal-started' | 'heal-completed' | 'heal-failed' | 'topology-changed'
  engineId?: string
  data: unknown
  timestamp: number
}

class OracleEventStream {
  subscribe(callback: (event: OracleEvent) => void): () => void
  getRecentEvents(limit?: number): OracleEvent[]

  // Periodic scans
  startPeriodicScan(intervalMs?: number): void
  stopPeriodicScan(): void
}
```

## 3. Non-Goals

- UI surfaces (Phase 16)
- MCP/CLI tools (Phase 16)
- Autonomous learning (future phase)

## 4. Architecture

The Oracle sits on top of the Kernel (Phase 0):

```
                    ┌─────────────────────┐
                    │    KernelOracle      │
                    │  (OracleQueryEngine) │
                    │  (OracleDiagnostic)  │
                    │  (OracleActuator)    │
                    │  (OracleEventStream) │
                    └─────────┬───────────┘
                              │ reads
                    ┌─────────▼───────────┐
                    │    KernelCore        │
                    │  Registry + Tracer   │
                    │  Provenance + Store  │
                    └─────────┬───────────┘
                              │ reads
                    ┌─────────▼───────────┐
                    │  All Engines         │
                    │  (self-registered)   │
                    └─────────────────────┘
```

## 5. Dependencies

- Phase 0: KernelCore (registry, tracer, provenance, store)
- Phase 1: At least one engine bootstrapped
- Phase 6: DevTools surface for oracle display

## 6. Success Criteria

- [ ] `oracle.query({ type: 'topology' })` returns full system topology
- [ ] `oracle.diagnose()` detects known stubs (e.g., `executeHarnessPlan`)
- [ ] `oracle.heal(issueId)` triggers corrective action for auto-fixable issues
- [ ] Oracle event stream broadcasts health changes over WebSocket
- [ ] Periodic scan runs every 60s and detects new issues
- [ ] Auto-heal policy configurable from DB
- [ ] Unit tests: >80% coverage on all 4 oracle components
- [ ] Integration tests: oracle detects broken engine and triggers heal

