# v5 Fork Strategy: Kernel-First + CDP + Oracle + Surfaces

## Purpose

v5-fork-canon is the **kernel-first execution path** — a standalone track for building a system with CDP/Chrome control AND kernel self-understanding, self-diagnosis, and self-healing.

**Key distinction from v3-fork-canon and v4-fork-canon:**
- v3 = capability architecture (provider → capability → session, no CDP dependency)
- v4 = CDP/Chrome execution (Chrome governor owns browser, no kernel)
- v5 = v4 + kernel + oracle + surfaces (CDP + self-healing + observability)

v5 is the "full stack" CDP path — it includes everything v4 has PLUS the kernel layer.

## Design Principles

1. **Kernel-first:** Every engine, store, capability, and route registers with the kernel at construction time
2. **Self-understanding:** The system can query itself about its own state
3. **Self-healing:** The system can detect and fix problems automatically
4. **User-journey driven:** Each phase delivers demonstrable functionality (inherited from v4)
5. **Re-programmability:** Configurable policy objects loaded from DB

## Phase Structure (17 phases, 91 units)

| Phase | Name | Units | Description |
|-------|------|-------|-------------|
| 0 | Kernel Core | 10 | Event bus, registry, tracer, provenance, schema, bootstrap |
| 1 | E2E Bootstrap & Login | 7 | Chrome launch, profile setup, login verification |
| 2 | Single-Turn Conversation | 8 | CDP typing, submit, network capture, parse, store, render |
| 3 | Multi-Turn Conversation | 6 | State persistence, DOM recovery, streaming, error recovery |
| 4 | Three-Provider Demo | 5 | ChatGPT/Claude/Gemini E2E verification, provider switching |
| 5 | Frontend Performance | 6 | Optimistic UI, WS debounce, virtual scroll, mirror sync |
| 6 | Platform Foundation | 6 | ActionRegistry, AgentBridge, Capability UI, DevTools |
| 7 | Reliability & Persistence | 7 | Fleet persistence, port reaper, conversation locking, retry |
| 8 | Resource Management | 3 | Idle TTL, DB abstraction, backpressure |
| 9 | Observability | 5 | Structured logging, metrics, error tracking, audit trail |
| 10 | Frontend Resilience | 3 | Error boundary, loading states, keyboard shortcuts |
| 11 | Stealth Core Architecture | 4 | Launch profiles, stealth modules, extension bridge |
| 12 | Fingerprint Spoofing | 4 | Canvas, WebGL, audio, font/screen spoofing |
| 13 | Human Simulation | 3 | Mouse, keyboard, scroll behavior simulation |
| 14 | Profile & Trace Stealth | 4 | Profile warmup, CDP artifact cleanup, network fingerprint |
| 15 | Kernel Oracle | 4 | Queryable self-model, diagnostics, self-healing, event stream |
| 16 | Kernel Surfaces | 6 | REST API, MCP tools, CLI, frontend, server integration |

**Total: 90 units**

## Execution Flow

```
Phase 0 (Kernel Core) → Phase 1 (Bootstrap) → Phase 2 (Single-Turn) → Phase 3 (Multi-Turn)
→ Phase 4 (Three-Provider) → Phase 5 (Frontend Perf) → Phase 6 (Platform)
→ Phase 7 (Reliability) → Phase 8 (Resources) → Phase 9 (Observability)
→ Phase 10 (Resilience) → Phase 11 (Stealth) → Phase 12 (Fingerprint)
→ Phase 13 (Human Sim) → Phase 14 (Profile/Trace) → Phase 15 (Oracle)
→ Phase 16 (Surfaces)
```

**Critical dependency:** Phase 0 MUST be completed before Phase 1. Every subsequent engine registers with KernelContext.

## What v5 Includes (that v4 doesn't)

- ✅ Kernel Core (Phase 0): event bus upgrade, registry, context, tracer, provenance, schema, bootstrap
- ✅ Kernel Oracle (Phase 15): queryable self-model, diagnostics, self-healing, event stream
- ✅ Kernel Surfaces (Phase 16): REST API, MCP tools, CLI, frontend, server integration

## What v5 Does NOT Include

- ❌ Capability system (v3's architecture) — different execution path
- ❌ v3's Phase 1 (stabilization) — v3-specific
- ❌ v3's Phases 3-10 — v3-specific capability system

## Relationship to Other Forks

- **v3-fork-canon:** Capability system (127 units). Different architecture, no CDP dependency.
- **v4-fork-canon:** CDP/Chrome execution (71 units). v5 = v4 + kernel (91 units).
