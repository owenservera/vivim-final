# Sanity-Check Reference for Implementors

**Date:** 2026-07-11 | **Scope:** All atomic specs (v3: 127, v4: 86, v5: 26)

This document catalogs all misalignments found between atomic specs and actual source code, organized by severity. Apply these fixes during implementation.

---

## Critical Fixes (Applied to Fork Specs)

These have already been corrected in the fork directories:

| # | File | Line | Issue | Fix Applied |
|---|------|------|-------|-------------|
| 1 | `v4-fork/phase-01-e2e-bootstrap/1.2-seed-pipeline.md` | 17 | `ProviderStoreImpl` import path `../storage/impl/provider-store-impl.js` doesn't exist | Updated to import `ProviderStore` interface from `../storage/contracts/provider-store.js` with note to create implementation |
| 2 | `v4-fork/phase-03-multi-turn/3.6-selector-healing.md` | 32,43 | References `healer.recordHit()` and `healer.proposeSelector()` which don't exist on `SelectorHealer` | Added note that these methods must be added to `SelectorHealer` class |

---

## Source Code Reality (Verify During Implementation)

### Existing Classes (Verified Present)

These classes exist in `src/engines/` and match spec expectations:

| Class | File | Notes |
|-------|------|-------|
| `ChromeGovernor` | `chrome-governor.ts` | Full lifecycle management, CDP proxy |
| `BunCdpClient` | `bun-cdp-client.ts` | Chrome DevTools Protocol client |
| `FleetSupervisor` | `fleet-supervisor.ts` | Multi-profile orchestration |
| `ProfileAllocator` | `profile-allocator.ts` | Profile assignment logic |
| `ProviderRegistrar` | `provider-registrar.ts` | Provider registration and seeding |
| `StreamParserEngine` | `stream-parser-engine.ts` | SSE/streaming response parsing |
| `ConversationManager` | `conversation-manager.ts` | Full send pipeline with RECALL/INJECT/REMEMBER |
| `HarnessRuntime` | `harness-runtime.ts` | Capability execution runtime |
| `CapabilityResolutionEngine` | `capability-resolution-engine.ts` | Capability selection and binding |
| `StreamingProtocol` | `streaming-protocol.ts` | Streaming capture and conversation management |
| `SelectorHealer` | `selector-healer.ts` | LLM-powered selector repair (only `heal()` and `getHistory()`) |
| `ProviderHealthKernel` | `provider-health-kernel.ts` | Provider health monitoring |
| `AgenticLoopEngine` | `agentic-loop-engine.ts` | Multi-step agentic execution |
| `MirrorEngine` | `mirror-engine.ts` | Mirror execution engine |
| `MemoryEngine` | `memory-engine.ts` | Memory storage and retrieval |
| `UnifiedCapabilityRegistry` | `unified-capability-registry.ts` | Capability registration |
| `KnowledgeExtractor` | `knowledge-extractor.ts` | Knowledge extraction from conversations |
| `ContextAssemblyEngine` | `context-assembly-engine.ts` | Context window assembly |
| `ExecutionMemoizer` | `execution-memoizer.ts` | Execution caching |
| `LocalModelAdapter` | `local-model-adapter.ts` | Local model integration |

### Stub Methods (Need Implementation)

| Class | Method | File:Line | Current State |
|-------|--------|-----------|---------------|
| `ChromeGovernor` | `executeHarnessPlan()` | `chrome-governor.ts:200` | `return { success: true, stepsCompleted: 0 }` — stub needs full implementation |

### Missing Methods (Need Addition to Existing Classes)

| Class | Method | File | Notes |
|-------|--------|------|-------|
| `SelectorHealer` | `recordHit()` | `selector-healer.ts` | Must be added — spec 3.6 references it |
| `SelectorHealer` | `proposeSelector()` | `selector-healer.ts` | Must be added — spec 3.6 references it |
| `SelectorHealer` | `recordMiss()` | `selector-healer.ts` | May be needed for negative feedback |

### Missing Constants (Need Creation)

| Constant | Spec Reference | Notes |
|----------|---------------|-------|
| `COMPOSER_SELECTORS` | 2.5, 3.2 | Provider-specific CSS selectors for composer input |
| `CAPTURE_PATTERNS` | 2.5, 3.2 | Response capture patterns per provider |
| `PROVIDER_URLS` | 2.5, 3.2 | Provider endpoint URLs |

### Missing Features (Spec Describes What to Build)

| Feature | Spec Reference | Current State |
|---------|---------------|---------------|
| `ensureRunningForAccount()` | 2.1 | Does NOT exist on `ChromeGovernor` — spec describes feature to add |
| `ProviderStoreImpl` | 1.2 | Only interface exists at `src/storage/contracts/provider-store.ts` — implementation needs creation |
| `ConversationSurface` component | 2.8 | Does NOT exist — spec describes new React component |
| Provider-specific selectors | 2.5, 3.2 | No per-provider selector mappings exist |

### Type Duplication Issue

`ContentBlock` type is defined in 4 locations:
- `src/engines/streaming-protocol.ts`
- `src/server/routes/chat.ts`
- `src/storage/contracts/conversation-store.ts`
- `src/index.ts` (barrel export)

**Recommendation:** Consolidate into single definition in `src/types/content-block.ts` and re-export.

### Provider Seed Completeness

6/8 provider seeds have `composer_type` and `send_method` fields:
- ✅ chatgpt.json, claude.json, gemini.json, deepseek.json, grok.json, copilot.json
- ❌ system.json — missing these fields (may be intentional for system-level provider)

---

## Implementation Checklist

When implementing each atomic spec:

1. **Verify imports** — Check that all referenced files/classes actually exist at the specified paths
2. **Check method signatures** — Ensure methods exist on target classes with expected parameters
3. **Create missing pieces** — If spec references something that doesn't exist, create it as part of the unit
4. **Run typecheck** — After implementation, run `bun run typecheck` to catch any remaining issues
5. **Run tests** — Execute `bun test` to verify the implementation works correctly

---

## Fork Directory Structure

Dev should work ONLY from these directories:

| Fork | Units | Covers |
|------|-------|--------|
| `docs/atomic-v3-fork-canon/` | 127 | v3 gap (kernel, agentic, HTML, workspace, providers, memory) |
| `docs/atomic-v4-fork-canon/` | 86 | v4 Chrome/stealth (E2E, single-turn, multi-turn, providers, frontend, stealth) |
| `docs/atomic-v5-fork-canon/` | 90 | v5 kernel (kernel-core, kernel-oracle, kernel-surfaces) |

**Do NOT modify** the original `docs/atomic-v3/`, `docs/atomic-v4/`, `docs/atomic-v5/` directories.
