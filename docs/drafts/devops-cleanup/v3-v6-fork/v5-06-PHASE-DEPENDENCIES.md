# v5 Phase Dependencies

## Intra-Phase Chains

### Phase 0: Kernel Core
```
0.0 → 0.1 → 0.2 → 0.3 → 0.4 → 0.5 → 0.6 → 0.6a → 0.7
```
- 0.0 Event bus upgrade (foundation for all events)
- 0.1 KernelRegistry (what exists)
- 0.2 KernelContext (unified context)
- 0.3 KernelTracer (span tracing)
- 0.4 KernelProvenance (causal chains)
- 0.5 Prisma schema (kernel tables)
- 0.6 KernelBootstrap (wire into server)
- 0.6a Server refactor (kernel-first)
- 0.7 Test infrastructure

### Phase 1: E2E Bootstrap & Login
```
1.1 → 1.2 → 1.3 → 1.4 → 1.5 → 1.6 → 1.7
```
(Linear chain — same as v4)

### Phase 2: Single-Turn Conversation
```
2.1 → 2.2 → 2.3 → 2.4 → 2.5 → 2.6 → 2.7 → 2.8
```
(Linear chain — same as v4)

### Phase 3: Multi-Turn Conversation
```
3.1 → 3.2 → 3.3 → 3.4 → 3.5 → 3.6
```
(Linear chain — same as v4)

### Phase 4: Three-Provider Demo
```
4.1 → 4.2 → 4.3 → 4.4 → 4.5
```
(Linear chain — same as v4)

### Phase 5: Frontend Performance
```
5.1 → 5.2 → 5.3 → 5.4 → 5.5 → 5.6
```
(Linear chain — same as v4)

### Phase 6: Platform Foundation
```
6.1 → 6.2 → 6.3 → 6.4 → 6.5 → 6.6
```
(Linear chain — same as v4)

### Phase 7: Reliability & Persistence
```
7.1 → 7.2 → 7.3 → 7.4 → 7.5 → 7.6 → 7.7
```
(Linear chain — same as v4)

### Phase 8: Resource Management
```
8.1 → 8.2 → 8.3
```
(Linear chain — same as v4)

### Phase 9: Observability
```
9.1 → 9.2 → 9.3 → 9.4 → 9.5
```
(Linear chain — same as v4)

### Phase 10: Frontend Resilience
```
10.1 → 10.2 → 10.3
```
(Linear chain — same as v4)

### Phase 11: Stealth Core
```
11.1 → 11.2 → 11.3 → 11.4
```
(Linear chain — same as v4)

### Phase 12: Fingerprint Spoofing
```
12.1 → 12.2 → 12.3 → 12.4
```
(Linear chain — same as v4)

### Phase 13: Human Simulation
```
13.1 → 13.2 → 13.3
```
(Linear chain — same as v4)

### Phase 14: Profile & Trace
```
14.1 → 14.2 → 14.3 → 14.4
```
(Linear chain — same as v4)

### Phase 15: Kernel Oracle
```
15.1 → 15.2 → 15.3 → 15.4
```
- 15.1 OracleQuery (foundation)
- 15.2 OracleDiagnostic
- 15.3 OracleActuator
- 15.4 OracleEventStream

### Phase 16: Kernel Surfaces
```
16.1 → 16.2 → 16.3 → 16.4 → 16.5 → 16.6
```
- 16.1 REST API
- 16.2 MCP Tools
- 16.3 CLI
- 16.4 Frontend
- 16.5 MCP Server integration
- 16.6 CLI commands

## Inter-Phase Dependencies

```
Phase 0 (Kernel) → Phase 1 (Bootstrap) → Phase 2 (Single-Turn) → Phase 3 (Multi-Turn)
→ Phase 4 (Three-Provider) → Phase 5 (Frontend Perf) → Phase 6 (Platform)
→ Phase 7 (Reliability) → Phase 8 (Resources) → Phase 9 (Observability)
→ Phase 10 (Resilience) → Phase 11 (Stealth) → Phase 12 (Fingerprint)
→ Phase 13 (Human Sim) → Phase 14 (Profile/Trace) → Phase 15 (Oracle)
→ Phase 16 (Surfaces)
```

**Critical dependency:** Phase 0 MUST be completed before Phase 1. Every subsequent engine registers with KernelContext.
