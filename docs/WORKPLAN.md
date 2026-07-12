# vivim-final — Master Workplan

**Generated:** 2026-07-12
**Tracker:** `docs/atomic-v3-fork-canon/01-tracker.md` (127 units total — 10 done, 117 pending)
**Scope:** v3-fork-canon (full architecture: v3 108 units + v5 kernel 19 units) + NLCL

> **⛔ DEPRECATED TRACKERS:** `docs/atomic-v3/`, `docs/atomic-v4/`, `docs/atomic-v5/` are superseded.
> **Canonical trackers:** `docs/atomic-v3-fork-canon/`, `docs/atomic-v4-fork-canon/`, `docs/atomic-v5-fork-canon/`

---

## Executive Summary

Build a **consumer-grade, natural-language-controlled AI conversation platform** with:
- **NLCL** — deterministic command parser + pluggable LLM intent resolver (95% no-AI needed)
- **v5 Kernel** — 5-layer self-understanding (registry → tracer → provenance → oracle → actuator)
- **CDP/Chrome** — stealth browser automation for multi-provider AI conversations
- **Surfaces** — REST API, CLI, MCP, frontend all wired through kernel

**Current state:** NLCL complete (30/30 tests pass), Kernel core scaffolded (6 files), 0/90 tracker units marked done. Pre-existing typecheck errors fixed.

---

## Phase Dependency Graph

```
Phase 0 (Kernel Core)
  ├── Phase 1 (E2E Bootstrap & Login)  ← requires kernel wired
  │     ├── Phase 2 (Single-Turn)       ← requires boot + login
  │     │     ├── Phase 3 (Multi-Turn)  ← requires single-turn
  │     │     │     ├── Phase 4 (3-Provider Demo)
  │     │     │     └── Phase 5 (Frontend Perf)
  │     │     └── Phase 6 (Platform Foundation)
  │     └── Phase 7 (Reliability)
  │           └── Phase 8 (Resource Mgmt)
  │                 └── Phase 9 (Observability)
  │                       └── Phase 10 (Frontend Resilience)
  ├── Phase 11-14 (Stealth/Fingerprint/Human/Profile)  ← independent of phases 1-10
  ├── Phase 15 (Kernel Oracle)  ← requires Phase 0 complete
  └── Phase 16 (Kernel Surfaces) ← requires Phase 15
```

---

## Current Status — What Exists vs What's Needed

### Already Built (not in tracker as units)

| Module | Files | Status |
|--------|-------|--------|
| **NLCL Engine** | `src/engines/nlcl/*.ts` (9 files + executors) | Complete, 30/30 tests pass |
| **NLCL REST** | `src/server/nlcl-router.ts` | Complete, wired in server |
| **NLCL CLI** | `src/cli/commands/nlcl.ts` | Complete |
| **NLCL MCP** | `src/mcp/nlcl-tools.ts` | Complete |
| **NLCL Frontend** | `web/ui/src/features/command-bar.tsx` | Complete |
| **Kernel Registry** | `src/engines/kernel/kernel-registry.ts` | Scaffolded |
| **Kernel Tracer** | `src/engines/kernel/kernel-tracer.ts` | Scaffolded |
| **Kernel Provenance** | `src/engines/kernel/kernel-provenance.ts` | Scaffolded |
| **Kernel Context** | `src/engines/kernel/kernel-context.ts` | Scaffolded |
| **Kernel Bootstrap** | `src/engines/kernel/kernel-bootstrap.ts` | Scaffolded |
| **CapabilityEventBus** | `src/engines/capability-event-bus.ts` | Exists (needs upgrade) |
| **ChromeGovernor** | `src/engines/chrome-governor.ts` | Exists (needs CDP wire) |
| **ConversationManager** | `src/engines/conversation-manager.ts` | Exists (needs verification) |
| **UnifiedCapabilityRegistry** | `src/engines/unified-registry.ts` | Exists |
| **HarnessRuntime** | `src/engines/harness-runtime.ts` | Exists (has STUB) |
| **StreamParserEngine** | `src/engines/stream-parser.ts` | Exists (needs verify) |
| **SelectorHealer** | `src/engines/selector-healer.ts` | Exists |

---

## Phase 0: Kernel Core (9 units) — **IN PROGRESS**

> All subsequent phases depend on this. Every engine must register with the kernel.

### Status

| Unit | Name | State | What Needs Doing |
|------|------|-------|-----------------|
| 0.0 | CapabilityEventBus Upgrade | `[ ]` pending | Add error isolation, message envelopes, wildcard subscriptions, dead-letter queue. Surgical edit of existing bus. |
| 0.1 | KernelRegistry | `[~]` exists | File exists. Verify: engine registration, store registration, capability registration, route registration, `describe()` returns correct topology. Fix any stubs. |
| 0.2 | KernelContext | `[~]` exists | File exists. Verify: `KernelContext` interface provides access to all kernel subsystems. Fix any missing fields. |
| 0.3 | KernelTracer | `[~]` exists | File exists. Verify: span creation, span lifecycle (start→end), span metadata, error recording. Add store persistence if stub. |
| 0.4 | KernelProvenance | `[~]` exists | File exists. Verify: causal chain recording, `getChain()`, `getByEngine()`, `getByKind()`. Add ring buffer if stub. |
| 0.5 | Prisma Schema Migration | `[ ]` pending | Add 4 kernel tables to `prisma/schema.prisma`: `KernelSpan`, `KernelProvenanceEntry`, `KernelSnapshot`, `KernelAuditEntry`. Run `bunx prisma migrate dev`. |
| 0.6 | KernelBootstrap | `[~]` exists | File exists. Verify: creates kernel, registers engines/stores/capabilities/routes, NLCL as first-class citizen. Wire into `createServerWithEngines()`. |
| 0.6a | Server Bootstrap Refactor | `[ ]` pending | Refactor `createServerWithEngines()` to call `bootstrapKernel()` as primary wiring. NLCL + Governor + ConversationManager get injected via bootstrap. |
| 0.7 | Test Infrastructure | `[ ]` pending | Consolidate test mocks: `MockKernelRegistry`, `MockKernelTracer`, `MockKernelProvenance`, `MockKernelStore`. Set 80% coverage target for kernel modules. |

### Immediate Next Steps

1. **Verify kernel scaffolds** — run `bun run typecheck` to confirm kernel-context, kernel-provenance, kernel-bootstrap compile
2. **Fix kernel stubs** — any methods that are `return null` or `throw new Error('not implemented')` → implement
3. **Wire `bootstrapKernel()`** into `createServerWithEngines()` in `src/server/index.ts`
4. **Run 0.0** — upgrade CapabilityEventBus (error isolation + DLQ)
5. **Run 0.5** — Prisma schema migration for kernel tables
6. **Run 0.7** — test infrastructure consolidation

---

## Phase 1: E2E Bootstrap & Login (7 units)

> Get a Chrome instance visible with a real provider profile.

| Unit | Name | State | Dependency | What Needs Doing |
|------|------|-------|------------|-----------------|
| 1.1 | Wire CDP Transport | `[~]` exists | Phase 0 | Call `governor.setCdpTransport()` during bootstrap. Verify CDP WebSocket connection works. |
| 1.2 | Seed Pipeline | `[~]` exists | Phase 0 | Verify `seeds/providers/` loads chatgpt/claude/gemini at boot. Fix any missing seed data. |
| 1.3 | Setup Wizard Flow | `[ ]` pending | 1.1, 1.2 | Build workspace + profile path selection UI flow. First-run experience. |
| 1.4 | Visible Chrome Login | `[~]` exists | 1.1 | `FleetSupervisor` exists. Launch with correct user-data-dir profile. Show visible browser. |
| 1.5 | Login State Verify | `[ ]` pending | 1.4 | CDP-based check: read DOM element presence to confirm logged-in state. |
| 1.6 | Persist Account | `[~]` exists | 1.5 | `ProviderStore` exists. Save account with profile path + port after successful login. |
| 1.7 | Headless Profile Reuse | `[~]` exists | 1.6 | `FleetSupervisor` exists. After login, spawn headless slave reusing saved profile. |

---

## Phase 2: Single-Turn Conversation (8 units)

> User sends one message, gets one response from a provider via CDP.

| Unit | Name | State | Dependency | What Needs Doing |
|------|------|-------|------------|-----------------|
| 2.1 | Fix slaveId Derivation | `[~]` exists | 1.7 | `FleetSupervisor` naming mismatch. Align slaveId format across fleet + governor. |
| 2.2 | Real Harness Execute | `[~]` exists | 2.1 | `HarnessRuntime.executeHarnessPlan` is STUB. Implement real CDP dispatch. |
| 2.3 | Composer Typing | `[ ]` pending | 2.2 | CDP `Runtime.evaluate` to type into provider-specific textarea/contenteditable. |
| 2.4 | Submit Action | `[ ]` pending | 2.3 | CDP click on provider-specific submit button. Handle Enter key submission. |
| 2.5 | Network Capture | `[ ]` pending | 2.4 | `Network.requestWillBeSent` + `Fetch.requestPaused` to intercept streaming API response. |
| 2.6 | Parser Extract | `[~]` exists | 2.5 | `stream-parser.ts` exists. Verify SSE/streaming body → `ContentBlock[]` extraction. |
| 2.7 | Store + Emit | `[~]` exists | 2.6 | `conversation-manager.ts` exists. Verify message + blocks stored, events emitted. |
| 2.8 | Frontend Render | `[ ]` pending | 2.7 | Render single response in conversation surface. Markdown rendering. |

---

## Phase 3: Multi-Turn Conversation (6 units)

> Sustained conversation with state, streaming, error recovery.

| Unit | Name | State | Dependency | What Needs Doing |
|------|------|-------|------------|-----------------|
| 3.1 | State Persistence | `[~]` exists | 2.8 | Verify `conversation-manager.ts` persists across turns. Check DB writes. |
| 3.2 | DOM Recovery | `[ ]` pending | 3.1 | Handle page reload + SPA navigation. Re-locate selectors after DOM changes. |
| 3.3 | Streaming WS | `[~]` exists | 3.2 | Progressive block delivery over WebSocket. Verify server→client stream. |
| 3.4 | Frontend Streaming | `[ ]` pending | 3.3 | Live streaming updates in message list. Token-by-token rendering. |
| 3.5 | Error Recovery | `[~]` exists | 3.3 | `FleetSupervisor` circuit breaker. Verify: slave crash → retry → fallback. |
| 3.6 | Selector Healing | `[~]` exists | 3.2 | `selector-healer.ts` exists. Verify: auto-detect broken selectors → repair. |

---

## Phase 4: Three-Provider Demo (5 units)

> ChatGPT + Claude + Gemini all working, switchable.

| Unit | Name | State | Dependency | What Needs Doing |
|------|------|-------|------------|-----------------|
| 4.1 | ChatGPT E2E | `[ ]` pending | 3.1 | ChatGPT-specific selectors + parser. End-to-end: type → submit → capture → render. |
| 4.2 | Claude E2E | `[ ]` pending | 3.1 | Claude-specific selectors + parser. Same E2E flow. |
| 4.3 | Gemini E2E | `[ ]` pending | 3.1 | Gemini-specific selectors + parser. Same E2E flow. |
| 4.4 | Provider Switch | `[ ]` pending | 4.1-4.3 | Frontend UI to switch between providers mid-conversation. |
| 4.5 | Health Monitor | `[~]` exists | 4.1-4.3 | `provider-health.ts` exists. Verify 6-signal scoring works for all three. |

---

## Phase 5: Frontend Performance (6 units)

> Responsive, fast, non-blocking UI.

| Unit | Name | State | What Needs Doing |
|------|------|-------|-----------------|
| 5.1 | Optimistic UI | `[ ]` | Instant message echo on send (before server confirms). |
| 5.2 | WS Debounce | `[ ]` | Batch streaming block updates (reduce re-renders). |
| 5.3 | Virtual Scroll | `[ ]` | Long conversation virtualization (react-window or similar). |
| 5.4 | Mirror Sync | `[ ]` | UI⇄Chrome bidirectional state synchronization. |
| 5.5 | Latency Budget | `[ ]` | Per-stage timing enforcement (parse <50ms, render <100ms). |
| 5.6 | Mutation Safety | `[ ]` | Audit webapp mutations for safety (no accidental data loss). |

---

## Phase 6: Platform Foundation (6 units)

> Generic capability UI, DevTools, provider management.

| Unit | Name | State | What Needs Doing |
|------|------|-------|-----------------|
| 6.1 | ActionRegistry | `[ ]` | Full typed action catalog with Zod schemas. |
| 6.2 | AgentBridge | `[ ]` | WebSocket command routing + result relay. |
| 6.3 | Capability UI | `[ ]` | Generic contract-driven capability renderer. |
| 6.4 | DevTools | `[ ]` | Debug panel + capability harness. |
| 6.5 | Provider Mgmt UI | `[ ]` | Add/remove/switch providers. |
| 6.6 | Workspace Settings | `[ ]` | Profile paths, fleet config, ports. |

---

## Phase 7: Reliability & Persistence (7 units)

> Production-grade reliability.

| Unit | Name | State | What Needs Doing |
|------|------|-------|-----------------|
| 7.1 | Fleet Persistence | `[ ]` | Survive server restart. |
| 7.2 | Adopt on Restart | `[ ]` | PortReaper: reconnect instead of kill. |
| 7.3 | Conversation Lock | `[ ]` | Configurable lock policy. |
| 7.4 | Double-Send | `[ ]` | Idempotency keys. |
| 7.5 | Graceful Shutdown | `[ ]` | SIGTERM → clean Chrome exit. |
| 7.6 | SQLite WAL | `[ ]` | Pragma tuning + WAL mode. |
| 7.7 | Retry Policy | `[ ]` | Configurable retry engine. |

---

## Phase 8: Resource Management (3 units)

> Efficient resource usage.

| Unit | Name | State | What Needs Doing |
|------|------|-------|-----------------|
| 8.1 | Idle TTL | `[ ]` | Configurable slave eviction. |
| 8.2 | DB Abstraction | `[ ]` | Multi-strategy store layer. |
| 8.3 | Backpressure | `[ ]` | Request queueing + policy. |

---

## Phase 9: Observability (5 units)

> See everything happening.

| Unit | Name | State | What Needs Doing |
|------|------|-------|-----------------|
| 9.1 | Structured Logging | `[ ]` | Pluggable transports (console, file, OTLP). |
| 9.2 | Metrics Export | `[ ]` | Prometheus/OTLP pipeline. |
| 9.3 | Error Tracking | `[ ]` | Centralized error capture. |
| 9.4 | Audit Trail | `[ ]` | All user + system actions logged. |
| 9.5 | Latency SLA | `[ ]` | Per-endpoint latency monitoring + alerting. |

---

## Phase 10: Frontend Resilience (3 units)

> Bulletproof frontend.

| Unit | Name | State | What Needs Doing |
|------|------|-------|-----------------|
| 10.1 | Error Boundary | `[ ]` | React error boundary + crash recovery. |
| 10.2 | Loading States | `[ ]` | Skeleton/placeholder for all async surfaces. |
| 10.3 | Keyboard Shortcuts | `[ ]` | Command palette (Ctrl+K). |

---

## Phase 11: Stealth Core Architecture (4 units)

> Anti-detection browser automation.

| Unit | Name | State | What Needs Doing |
|------|------|-------|-----------------|
| 11.1 | LaunchProfileEngine | `[ ]` | Multi-mode launch strategy (headless, headed, stealth). |
| 11.2 | StealthModuleEngine | `[ ]` | Registry + CDP injection pipeline for stealth modules. |
| 11.3 | StealthProfile Store | `[ ]` | Per-provider profile config from DB. |
| 11.4 | ExtensionBridgeEngine | `[ ]` | Browser extension interaction mode. |

---

## Phase 12: Fingerprint Spoofing (4 units)

> Defeat browser fingerprinting.

| Unit | Name | State | What Needs Doing |
|------|------|-------|-----------------|
| 12.1 | CanvasNoiseEngine | `[ ]` | Canvas fingerprint perturbation. |
| 12.2 | WebGlSpoofEngine | `[ ]` | GPU renderer + vendor spoofing. |
| 12.3 | AudioContextEngine | `[ ]` | Audio fingerprint perturbation. |
| 12.4 | FontScreenEngine | `[ ]` | Font list + screen resolution spoofing. |

---

## Phase 13: Human Simulation (3 units)

> Look human, not bot.

| Unit | Name | State | What Needs Doing |
|------|------|-------|-----------------|
| 13.1 | HumanMouseEngine | `[ ]` | Bezier-curve mouse movement. |
| 13.2 | HumanKeyboardEngine | `[ ]` | Variable rhythm typing. |
| 13.3 | HumanScrollEngine | `[ ]` | Natural scroll velocity curves. |

---

## Phase 14: Profile & Trace Stealth (4 units)

> Clean up all traces.

| Unit | Name | State | What Needs Doing |
|------|------|-------|-----------------|
| 14.1 | ProfileWarmupEngine | `[ ]` | History/cookie/trust building. |
| 14.2 | CDPArtifactCleaner | `[ ]` | Remove CDP traces from page. |
| 14.3 | NetworkFingerprintEngine | `[ ]` | TLS + HTTP header preservation. |
| 14.4 | BehavioralPatternEngine | `[ ]` | Request timing + interaction rhythm. |

---

## Phase 15: Kernel Oracle (4 units)

> Self-awareness: ask the system about itself.

| Unit | Name | State | What Needs Doing |
|------|------|-------|-----------------|
| 15.1 | OracleQueryEngine | `[ ]` | Structured queries about system state. |
| 15.2 | OracleDiagnosticEngine | `[ ]` | Detect stubs, broken wires, missing deps. |
| 15.3 | OracleActuator | `[ ]` | Self-healing actions (restart, heal, reconfig). |
| 15.4 | OracleEventStream | `[ ]` | Real-time system state over WebSocket. |

---

## Phase 16: Kernel Surfaces (6 units)

> Expose kernel to all surfaces.

| Unit | Name | State | What Needs Doing |
|------|------|-------|-----------------|
| 16.1 | Kernel REST API | `[ ]` | `/api/kernel/*` routes. |
| 16.2 | Kernel MCP Tools | `[ ]` | `system.describe/diagnose/heal/explain`. |
| 16.3 | Kernel CLI | `[ ]` | `vivim kernel status/diagnose/trace`. |
| 16.4 | Kernel Frontend | `[ ]` | OracleDashboard in UI. |
| 16.5 | MCP Server Integration | `[ ]` | Register kernel tools in MCP server. |
| 16.6 | CLI Kernel Commands | `[ ]` | `bun run kernel status/diagnose/trace`. |

---

## Execution Strategy

### Immediate (this session)

1. Run `bun run typecheck` — verify kernel files compile
2. Run 0.1–0.4 verification — confirm kernel registry/tracer/provenance are real, not stubs
3. Run 0.0 — upgrade CapabilityEventBus (error isolation + DLQ)
4. Run 0.5 — Prisma schema migration
5. Run 0.6a — wire `bootstrapKernel()` into `createServerWithEngines()`
6. Run 0.7 — test infrastructure

### Short-term (next sessions)

7. Phase 1 — E2E bootstrap, visible Chrome login
8. Phase 2 — single-turn conversation working

### Medium-term

9. Phase 3-4 — multi-turn + three-provider demo
10. Phase 5-6 — frontend perf + platform foundation
11. Phase 11-14 — stealth/fingerprint/human (parallel to 1-10)

### Long-term

12. Phase 7-10 — reliability + resource mgmt + observability + resilience
13. Phase 15-16 — kernel oracle + kernel surfaces

---

## Key Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Kernel stubs not real | Phases 15-16 fail | Verify + implement 0.1-0.4 before proceeding |
| CDP transport flaky | Phases 1-4 blocked | Test with real Chrome early, have mock fallback |
| Provider selectors break | Phases 3-4 blocked | Selector healer exists (3.6), keep patterns updated |
| NLCL not wired to kernel | Comms layer disconnected | 0.6a wires bootstrapKernel into server |
| Prisma migration conflicts | Phase 0 delayed | Run migration early, test rollback |

---

## File Inventory

### NLCL Module (complete)
```
src/engines/nlcl/
  types.ts              — CommandPattern, ParsedIntent, CommandResult, NLCContext
  command-registry.ts   — Pattern store with intent/category indexes
  nl-parser.ts          — Deterministic regex + keyword scoring
  intent-resolver.ts    — Deterministic/LocalLLM/ProviderLLM/Hybrid resolvers
  intent-router.ts      — Routes by executor, composite commands
  nlcl-engine.ts        — Main orchestrator: parse→route→execute
  catalog.ts            — 30+ consumer command patterns
  index.ts              — Barrel exports
  executors/
    file.ts             — open/list/search/create/read
    browser.ts          — navigate/search/extract/screenshot/open
    provider-llm.ts     — ask/summarize/translate/explain/rewrite/code
    email.ts            — send/compose via mailto or MailAdapter
    app.ts              — launch native apps per platform
    system.ts           — health/providers/fleet/capabilities/version/workspace
    conversation.ts     — create/list/send/switch/messages
    capability.ts       — delegate to UnifiedCapabilityRegistry
    index.ts            — Barrel exports
```

### Kernel Module (scaffolded)
```
src/engines/kernel/
  kernel-registry.ts    — Engine/store/capability/route registration
  kernel-tracer.ts      — Span-based tracing
  kernel-provenance.ts  — Causal chain recording
  kernel-context.ts     — KernelContext + KernelImpl + ConsoleKernelLogger
  kernel-bootstrap.ts   — bootstrapKernel() — wires everything
  index.ts              — Barrel exports
```

### Surfaces (complete)
```
src/server/nlcl-router.ts      — REST API (/api/nlcl/*)
src/cli/commands/nlcl.ts        — CLI (vivim nl "...")
src/mcp/nlcl-tools.ts          — MCP tools (nl_command, nl_list_commands, nl_help)
web/ui/src/features/command-bar.tsx — Frontend CommandBar component
```

### Server (wired)
```
src/server/index.ts             — createServer() + createServerWithEngines()
                                 NLCL instantiated in both
                                 bootstrapKernel() exists but not yet primary wiring
```

---

## Success Criteria

- [ ] `bun run typecheck` — zero errors
- [ ] `bun test` — all tests pass (currently 30/30 NLCL)
- [ ] Phase 0 complete — all 9 kernel units done
- [ ] Phase 1 complete — Chrome visible, logged into one provider
- [ ] Phase 2 complete — single-turn conversation works
- [ ] Phase 3 complete — multi-turn with streaming
- [ ] Phase 4 complete — three providers switchable
- [ ] NLCL: "open my resume" → file opens
- [ ] NLCL: "go to cnn and summarize the news" → browser navigate + LLM summarize
- [ ] NLCL: "switch to claude" → provider switches
- [ ] Kernel: `vivim kernel status` → shows all registered engines
- [ ] Kernel: oracle can query system state
- [ ] Stealth: providers cannot detect automation
