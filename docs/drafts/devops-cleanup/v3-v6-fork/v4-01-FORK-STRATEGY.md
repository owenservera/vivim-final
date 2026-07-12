# v4 Fork Strategy: CDP/Chrome Execution Path

## Purpose

v4-fork-canon is the **CDP/Chrome execution path** — a standalone track for building a system that controls Chrome browsers via CDP to have conversations with ChatGPT, Claude, and Gemini.

**Key distinction from v3-fork-canon:**
- v3 = capability architecture (provider → capability → session, no CDP dependency)
- v4 = CDP/Chrome execution model (Chrome governor owns browser, no kernel)

v4 does NOT include the kernel, oracle, or surfaces. Those are v5 additions.

## Design Principles

1. **User-journey driven:** Each phase delivers a vertical slice of demonstrable functionality
2. **Zero-breakage E2E:** Frontend login → multi-turn conversation with all 3 providers
3. **Re-programmability:** Configurable policy objects loaded from DB, never hardcoded constants
4. **No kernel dependency:** v4 runs without the kernel layer (v5 adds kernel on top)

## Phase Structure (14 phases, 71 units)

| Phase | Name | Units | Description |
|-------|------|-------|-------------|
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

**Total: 71 units**

## Execution Flow

```
Phase 1 (Bootstrap) → Phase 2 (Single-Turn) → Phase 3 (Multi-Turn) → Phase 4 (Three-Provider)
→ Phase 5 (Frontend Perf) → Phase 6 (Platform) → Phase 7 (Reliability) → Phase 8 (Resources)
→ Phase 9 (Observability) → Phase 10 (Resilience) → Phase 11 (Stealth) → Phase 12 (Fingerprint)
→ Phase 13 (Human Sim) → Phase 14 (Profile/Trace)
```

**Intra-phase dependencies:**
- Phase 1: 1.1→1.2→1.3→1.4→1.5→1.6→1.7 (linear chain)
- Phase 2: 2.1→2.2→2.3→2.4→2.5→2.6→2.7→2.8 (linear chain)
- Phase 3: 3.1→3.2→3.3→3.4→3.5→3.6 (linear chain)
- Phase 4: 4.1→4.2→4.3→4.4→4.5 (linear chain)
- Phase 5: 5.1→5.2→5.3→5.4→5.5→5.6 (linear chain)
- Phase 6: 6.1→6.2→6.3→6.4→6.5→6.6 (linear chain)
- Phase 7: 7.1→7.2→7.3→7.4→7.5→7.6→7.7 (linear chain)
- Phase 8: 8.1→8.2→8.3 (linear chain)
- Phase 9: 9.1→9.2→9.3→9.4→9.5 (linear chain)
- Phase 10: 10.1→10.2→10.3 (linear chain)
- Phase 11: 11.1→11.2→11.3→11.4 (linear chain)
- Phase 12: 12.1→12.2→12.3→12.4 (linear chain)
- Phase 13: 13.1→13.2→13.3 (linear chain)
- Phase 14: 14.1→14.2→14.3→14.4 (linear chain)

## What v4 Does NOT Include

- ❌ Kernel (Phase 0 in v5) — v5 adds this
- ❌ Kernel Oracle (Phase 15 in v5) — v5 adds this
- ❌ Kernel Surfaces (Phase 16 in v5) — v5 adds this
- ❌ Capability system (v3's architecture) — different execution path

## Relationship to Other Forks

- **v3-fork-canon:** Capability system (127 units). Different architecture, no CDP dependency.
- **v5-fork-canon:** v4 + kernel + oracle + surfaces (91 units). v4 is a subset of v5.
