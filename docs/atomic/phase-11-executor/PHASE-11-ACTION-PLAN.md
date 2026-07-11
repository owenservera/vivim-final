# Phase 11 Action Plan — CDP Architecture Assessment & Remediation

**Created:** 2026-07-11
**Status:** ANALYSIS COMPLETE — AWAITING DECISION
**Scope:** Phase 11 executor files, Phase 14 CDP wiring, duplicate tooling resolution

---

## 1. CDP Architecture — Current State

### 1.1 The Three CDP Layers

```
Layer 3: ChromeGovernor (src/engines/chrome-governor.ts)
  ├── CDPTransport interface (line 137) — abstraction
  ├── CDPProxy class (line 146) — mutex + circuit breaker + event bus
  └── stubCdp object (lines 630-658) — THROWS "implement in Phase 9"

Layer 2: FleetSupervisor (src/executor/fleet-supervisor.ts)
  ├── Chrome lifecycle: spawn, kill, ensureRunning, reap
  ├── Health probes via BunCdpClient
  └── State machine + circuit breaker (duplicate of CDPProxy's)

Layer 1: BunCdpClient (src/executor/cdp.ts)
  └── Raw WebSocket CDP client (273 lines, fully implemented)
```

### 1.2 How ChromeGovernor Currently Uses CDP

```
ChromeGovernor
  ├── imports FleetSupervisor from '../executor/fleet-supervisor.js'  ✓
  ├── fleetSupervisor.spawn() → Chrome lifecycle                      ✓
  ├── fleetSupervisor.kill() → Chrome teardown                        ✓
  ├── fleetSupervisor.ensureRunning() → health check                  ✓
  │
  ├── CDPTransport interface (line 137)                               ✗ NOT WIRED
  ├── CDPProxy class (line 146)                                       ✗ NO TRANSPORT
  └── stubCdp (lines 630-658)                                         ✗ THROWS
```

### 1.3 What Phase 14 Plans to Do

| Unit | File | What It Does |
|------|------|-------------|
| 14.1 | `src/executor/cdp-transport.ts` | Creates `CdpTransportImpl` adapter wrapping `BunCdpClient` |
| 14.2 | `src/engines/chrome-governor.ts` | Removes `stubCdp`, adds `setCdpTransport()`, wires real `CDPProxy` |
| 14.3 | `src/engines/chrome-governor.ts` | Removes trace stubs, wires `TraceLog` |
| 14.4 | `src/engines/chrome-governor.ts` | Removes health stubs, wires `HealthMonitor` |
| 14.5 | `src/engines/conversation-manager.ts` | Removes local stub interfaces, imports real types |
| 14.6 | `src/server/conversation-router.ts` | Wires server to use `ConversationManager` engine |
| 14.7 | `src/engines/harness-runtime.ts` | Wires DOM/network/screenshot context via Governor CDP |
| 14.8 | `src/router/router.ts` | Completes Router + RouterStoreImpl |

### 1.4 The Critical Dependency Chain

```
Phase 14.1 (CdpTransportImpl)
  └── Phase 14.2 (wire into Governor)
        ├── Phase 14.3 (trace stubs → real)
        ├── Phase 14.4 (health stubs → real)
        └── Phase 14.7 (harness context → real)

Phase 14.5 (ConversationManager types)
  └── Phase 14.6 (server wiring)
```

**14.1 is the foundation.** Without it, nothing else in Phase 14 works.

---

## 2. Duplicate Tooling — Confirmed

### 2.1 What's Duplicated

| Component | In Executor | In Engine | Overlap |
|-----------|-------------|-----------|---------|
| CDP Client | `executor/cdp.ts` (BunCdpClient) | `chrome-governor.ts` stubCdp | Executor has REAL, Engine has STUB |
| Chrome Launch | `executor/launcher.ts` | `chrome-governor.ts` via FleetSupervisor | Engine wraps Executor (correct) |
| Port Reaping | `executor/port-reaper.ts` | `chrome-governor.ts` via FleetSupervisor | Engine wraps Executor (correct) |
| Fleet Mgmt | `executor/fleet-supervisor.ts` | `chrome-governor.ts` FleetSupervisor field | Engine wraps Executor (correct) |
| Health Probes | `executor/fleet-supervisor.ts` | `chrome-governor.ts` HealthMonitor (lines 319-476) | DUPLICATE — both do health checks |
| Circuit Breaker | `executor/fleet-supervisor.ts` | `chrome-governor.ts` CDPProxy (line 146) | DUPLICATE — both have circuit breakers |

### 2.2 The Honest Assessment

**Your theory is correct.** Phase 11 was pulled from cap-store without checking:
1. `chrome-governor.ts` already had `HealthMonitor` (lines 319-476) with circuit breaker logic
2. `chrome-governor.ts` already had `CDPProxy` (lines 146-227) with circuit breaker logic
3. `fleet-supervisor.ts` has its OWN health probe + circuit breaker implementation

**Result:** Two parallel health monitoring systems, two parallel circuit breaker implementations.

### 2.3 What's Actually Needed

The executor files are NOT redundant — they provide the LOW-LEVEL primitives that the engine wraps. The issue is:

```
CORRECT dependency: Engine → Executor (wraps)
ACTUAL state: Engine has DUPLICATE implementations of executor logic
```

---

## 3. Phase 11 Files — Status & Action

### 3.1 Files That Are Correct (Keep As-Is)

| File | Status | Reason |
|------|--------|--------|
| `src/executor/cdp.ts` | ✅ CORRECT | BunCdpClient is the real CDP transport, no duplicate |
| `src/executor/launcher.ts` | ✅ CORRECT | Chrome binary discovery + spawn, no duplicate in engine |
| `src/executor/profile-allocator.ts` | ✅ CORRECT | Profile directory management, no duplicate |
| `src/executor/port-reaper.ts` | ✅ CORRECT | Port cleanup on crash, no duplicate in engine |
| `src/executor/slave-write.ts` | ✅ CORRECT | CDP write operations, wraps BunCdpClient |
| `src/executor/slave-read.ts` | ✅ CORRECT | CDP read operations, wraps BunCdpClient |

### 3.2 Files That Need Decision

| File | Status | Issue | Action Required |
|------|--------|-------|-----------------|
| `src/executor/fleet-supervisor.ts` | ⚠️ OVERLAP | Has health probes + circuit breaker that duplicate ChromeGovernor's HealthMonitor | DECIDE: Remove health/circuit from executor? Or remove from engine? |
| `src/executor/conversation-driver.ts` | ❌ MISSING | Not created yet | DECIDE: Is this needed? Or does ConversationManager handle this? |
| `src/executor/stream-capture.ts` | ❌ MISSING | Not created yet | DECIDE: Is this needed? Or does StreamBlockStore handle this? |
| `src/executor/network-capture.ts` | ❌ MISSING | Not created yet | DECIDE: Is this needed? Or does ObservationTap handle this? |
| `src/executor/index.ts` | ❌ MISSING | Barrel export not created | CREATE: Simple re-export file |

### 3.3 Files That Are Redundant (After Phase 14)

| File | Status | Reason |
|------|--------|--------|
| `src/engines/chrome-governor.ts` stubCdp | 🔴 REDUNDANT | Phase 14.2 removes this entirely |
| `src/engines/chrome-governor.ts` trace stubs | 🔴 REDUNDANT | Phase 14.3 removes this entirely |
| `src/engines/chrome-governor.ts` health stubs | 🔴 REDUNDANT | Phase 14.4 removes this entirely |
| `src/engines/conversation-manager.ts` local interfaces | 🔴 REDUNDANT | Phase 14.5 removes this entirely |

---

## 4. Decision Matrix

### Decision 1: FleetSupervisor Health/Circuit Overlap

**Option A: Remove from Executor (Recommended)**
- `fleet-supervisor.ts` keeps: spawn, kill, ensureRunning, reap
- `fleet-supervisor.ts` removes: healthProbe, circuitBreaker logic
- `chrome-governor.ts` HealthMonitor becomes the single source of truth
- **Risk:** FleetSupervisor's autoRestart depends on health checks

**Option B: Remove from Engine**
- `chrome-governor.ts` HealthMonitor removed
- `fleet-supervisor.ts` becomes the single health authority
- **Risk:** Engine loses visibility into health state

**Option C: Keep Both (Current State)**
- Two parallel systems, confusing but functional
- **Risk:** Maintenance burden, inconsistent state

### Decision 2: Missing Executor Files (11.8-11.10)

**Option A: Skip (Recommended)**
- `conversation-driver.ts` → ConversationManager handles this (Phase 3.6)
- `stream-capture.ts` → StreamBlockStore handles this (Phase 3.8)
- `network-capture.ts` → ObservationTap handles this (Phase 7.2)
- These were in cap-store but don't fit vivim-final's architecture

**Option B: Create Anyway**
- Create minimal wrappers that delegate to engine implementations
- **Risk:** More code to maintain, unclear value

### Decision 3: Execution Order

**Option A: Phase 14 First (Recommended)**
1. Phase 14.1 → CdpTransportImpl (foundation)
2. Phase 14.2 → Wire into Governor (critical fix)
3. Phase 14.3-14.4 → Remove remaining stubs
4. Phase 11.12-11.13 → Becomes REDUNDANT (skip)
5. Phase 11.14 → Slave Setup Script (still needed)

**Option B: Phase 11 First**
1. Phase 11.12 → ChromeGovernor boot stubs
2. Phase 11.13 → MirrorEngine action stubs
3. Phase 14.1 → CdpTransportImpl
4. Phase 14.2 → Wire into Governor
5. **Risk:** Phase 11.12-11.13 work gets thrown away when Phase 14.2 runs

---

## 5. Recommended Action Plan

### Phase 1: CDP Foundation (Do First)

```
14.1  CdpTransportImpl              ← CREATES src/executor/cdp-transport.ts
     │   Wraps BunCdpClient into CDPTransport interface
     │   This is the ONLY adapter between executor and engine
     │
14.2  Governor CDP Real              ← MODIFIES src/engines/chrome-governor.ts
     │   Removes stubCdp (lines 630-658)
     │   Adds setCdpTransport() method
     │   Wires CDPProxy to real transport
     │
14.3  Governor Trace Real            ← MODIFIES src/engines/chrome-governor.ts
     │   Removes trace stubs (lines 662-672)
     │   Wires TraceLog
     │
14.4  Governor Health Real           ← MODIFIES src/engines/chrome-governor.ts
     │   Removes health stubs (lines 676-686)
     │   Wires HealthMonitor
     │
14.7  HarnessRuntime Context         ← MODIFIES src/engines/harness-runtime.ts
     │   Wires DOM/network/screenshot via Governor CDP
```

### Phase 2: Type Alignment (Do Second)

```
14.5  ConversationManager Fix        ← MODIFIES src/engines/conversation-manager.ts
     │   Removes local stub interfaces
     │   Imports real types
     │
14.6  Server Wiring                  ← MODIFIES src/server/conversation-router.ts
     │   Wires server to use engines
```

### Phase 3: Resolve Duplicates (Do Third)

```
DECISION: FleetSupervisor health/circuit overlap
  → If Option A: Refactor fleet-supervisor.ts to remove health/circuit
  → If Option B: Refactor chrome-governor.ts to remove HealthMonitor
  → If Option C: Document both, move on

DECISION: Missing executor files (11.8-11.10)
  → If Option A: Mark as SKIPPED in tracker, update notes
  → If Option B: Create minimal delegating wrappers
```

### Phase 4: Cleanup (Do Last)

```
11.12  ChromeGovernor Boot Stubs     ← BECOMES REDUNDANT after 14.2-14.4
       → Mark as SKIPPED, note "superseded by Phase 14"

11.13  MirrorEngine Action Stubs     ← STILL NEEDED (Phase 21.2.3-21.2.4)
       → Implement after Phase 14 foundation is solid

11.14  Slave Setup Script            ← STILL NEEDED
       → Implement independently

11.11  Executor Barrel               ← CREATE src/executor/index.ts
       → Simple re-export of public API
```

---

## 6. Files Modified By This Plan

### Files to CREATE
- `src/executor/cdp-transport.ts` (Phase 14.1)
- `src/executor/index.ts` (Phase 11.11 — barrel export)

### Files to MODIFY
- `src/engines/chrome-governor.ts` (Phase 14.2, 14.3, 14.4)
- `src/engines/conversation-manager.ts` (Phase 14.5)
- `src/engines/harness-runtime.ts` (Phase 14.7)
- `src/server/conversation-router.ts` (Phase 14.6)
- `src/router/router.ts` (Phase 14.8)

### Files to DECIDE ON
- `src/executor/fleet-supervisor.ts` — health/circuit overlap
- `src/executor/conversation-driver.ts` — skip or create?
- `src/executor/stream-capture.ts` — skip or create?
- `src/executor/network-capture.ts` — skip or create?

### Files to MARK REDUNDANT
- Phase 11.12 (ChromeGovernor Boot Stubs) — superseded by Phase 14.2-14.4

---

## 7. Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Phase 14.1 not done blocks everything | CRITICAL | Do 14.1 first, verify typecheck passes |
| FleetSupervisor refactor breaks autoRestart | HIGH | Test health probe integration after refactor |
| Missing executor files needed elsewhere | MEDIUM | Grep for imports of missing files before skipping |
| Phase 11.12-11.13 work wasted | LOW | They're small — 2-3 methods each, minimal effort |

---

## 8. Next Steps

1. **DECIDE** on FleetSupervisor health/circuit overlap (Option A/B/C)
2. **DECIDE** on missing executor files (Option A/B)
3. **IMPLEMENT** Phase 14.1 (CdpTransportImpl) — foundation
4. **VERIFY** typecheck passes after 14.1
5. **IMPLEMENT** Phase 14.2 (wire into Governor)
6. **VERIFY** stubCdp is removed, no "implement in Phase 9" references
7. **CONTINUE** with 14.3-14.8
8. **CLEANUP** Phase 11 tracker entries

---

## Appendix A: CDP Method Usage Map

| CDP Method | Used By | Through |
|------------|---------|---------|
| `Browser.getVersion` | HealthMonitor.probe() | CDPProxy → CDPTransport → BunCdpClient |
| `Runtime.evaluate` | HarnessRuntime.createRealContext() | CDPProxy → CDPTransport → BunCdpClient |
| `DOM.querySelector` | HarnessRuntime.query() | CDPProxy → CDPTransport → BunCdpClient |
| `DOM.querySelectorAll` | HarnessRuntime.queryAll() | CDPProxy → CDPTransport → BunCdpClient |
| `DOM.describeNode` | HarnessRuntime.query()/queryAll() | CDPProxy → CDPTransport → BunCdpClient |
| `Page.captureScreenshot` | CDPProxy.captureScreenshot() | CDPTransport → BunCdpClient |
| `Network.enable` | CdpTransportImpl.capture() | BunCdpClient |
| `Network.getResponseBody` | CdpTransportImpl.capture() | BunCdpClient |

## Appendix B: Stub Elimination Tracker

| Stub Location | Lines | Eliminated By | Status |
|---------------|-------|---------------|--------|
| chrome-governor.ts stubCdp | 630-658 | Phase 14.2 | PENDING |
| chrome-governor.ts trace stubs | 662-672 | Phase 14.3 | PENDING |
| chrome-governor.ts health stubs | 676-686 | Phase 14.4 | PENDING |
| conversation-manager.ts local interfaces | 38-85 | Phase 14.5 | PENDING |
| harness-runtime.ts context stubs | 80-87 | Phase 14.7 | PENDING |
| router.ts listRequests/getEvents | 182-187 | Phase 14.8 | PENDING |
