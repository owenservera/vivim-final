# Sanity Check Report — 2026-07-12 (Full Audit)

## Scope: v3 (127 units) + v4 (86 units) + v5 (26 units) atomic spec files cross-referenced against actual source code

---

## OVERALL FINDINGS SUMMARY

| Fork | Total Units | Files Read | Drifts Found | Notes |
|------|-------------|------------|--------------|-------|
| v4 (Phase 1-4) | 86 | 22 (Ph1-4) | 14 | Most drift = spec matches reality (things to build) |
| v5 (all) | 26 | 26 (all) | 0 DRIFT / 26 DNE | Kernel + Oracle entirely new - no source files exist |
| v3 (sampled) | 127 | ~40 (sampled) | 0 DRIFT / ~20 DNE | Most v3 specs describe NEW code not yet built |

**Key finding:** `docs/atomic-v3/`, `docs/atomic-v4/`, `docs/atomic-v5/` are **design specs for features to be built**. They are not documenting existing code. The few existing drifts are where a spec references a class/file/path that *should* exist but doesn't (wrong import paths, missing methods).

---

## FINDING 1: CRITICAL — ProviderStoreImpl path is wrong (v4 spec 1.2)

**File:** `docs/atomic-v4/phase-01-e2e-bootstrap/1.2-seed-pipeline.md`
**Line ~17:**
```
import { ProviderStoreImpl } from '../storage/impl/provider-store-impl.js'
```

**Problem:** The file `src/storage/impl/provider-store-impl.ts` does **NOT exist**. The ProviderStore implementation is at `src/storage/impl/provider-store.ts`, and no `ProviderStoreImpl` class name exists anywhere in the codebase. The project uses `provider-store.ts` (contract) and `impl/provider-store.ts` (implementation).

**Status:** ❗ PENDING — needs resolution. Either the import path is wrong (file is named `provider-store.ts`, class needs checking) or the implementation file needs to be created.

---

## FINDING 2: CRITICAL — Frontend files in wrong directory (v4 spec 2.8)

**File:** `docs/atomic-v4/phase-02-single-turn/2.8-frontend-render.md`
**Spec:** Frontend files should be in `web/sandbox/src/features/conversation-surface.tsx` etc.

**Reality:** Frontend files are in `src/` not `web/`:
- `src/main.tsx` (not `web/sandbox/src/main.tsx`)
- `src/app/sandbox-app.tsx`
- `src/features/capability-catalog.tsx`
- `src/features/capability-harness.tsx`
- `src/features/debug-panel.tsx`

**Status:** ⚠ DRIFT — The `conversation-surface.tsx`, `submit-action.ts` and `composer-typing.ts` from v4 Phase 2 specs do NOT exist yet. Import paths in specs reference `web/sandbox/` but actual files use `src/`. This won't cause errors because they describe new files.

---

## FINDING 3: MAJOR — ExecuteHarnessPlan is a stub (v4 spec 2.2 matches reality)

**File:** `docs/atomic-v4/phase-02-single-turn/2.2-harness-real-exec.md`
**Spec:** Describes `executeHarnessPlan` at `chrome-governor.ts:192` as a stub.

**Reality:** ✅ MATCH — `chrome-governor.ts:200`:
```typescript
return { success: true, stepsCompleted: 0 }  // stub
```
The spec correctly identifies this stub and provides the fix: wire `HarnessRuntime` into CDPProxy or use direct CDP commands.

---

## FINDING 4: MEDIUM — Missing `ensureRunningForAccount` (v4 spec 2.1)

**File:** `docs/atomic-v4/phase-02-single-turn/2.1-slave-id-derivation.md`
**Spec:** Describes adding `ChromeGovernor.ensureRunningForAccount()` method.

**Reality:** ✅ DRIFT (expected — spec describes feature to add). `ensureRunningForAccount` does NOT exist in source. The current `send()` pipeline uses `deriveSlaveId()` followed by `this.governor.ensureRunning(slaveId)` which doesn't auto-spawn.

---

## FINDING 5: MEDIUM — Capture patterns not provider-specific (v4 spec 2.5)

**File:** `docs/atomic-v4/phase-02-single-turn/2.5-network-capture.md`
**Spec:** Describes `CAPTURE_PATTERNS` with provider-specific regexes for chatgpt, claude, gemini.

**Reality:** ✅ DRIFT (expected). Current capture pattern at `conversation-manager.ts:240` is generic `/\/api\/conversation\//`. The provider-specific patterns (`CHATGPT_CAPTURE`, `CLAUDE_CAPTURE`, `GEMINI_CAPTURE`) and `captureStream` method don't exist yet.

---

## FINDING 6: MEDIUM — Only assistant message stored, not user (v4 spec 2.7)

**File:** `docs/atomic-v4/phase-02-single-turn/2.7-store-emit.md`
**Spec:** Describes storing both user AND assistant messages.

**Reality:** ✅ DRIFT (expected). Current code at `conversation-manager.ts:252-267` stores only the assistant response. User message is not stored. `messageCount` is incremented by 1 (not 2 for user+assistant).

---

## FINDING 7: MEDIUM — WebSocket sessions not exported (v4 spec 2.7)

**File:** `docs/atomic-v4/phase-02-single-turn/2.7-store-emit.md`
**Spec:** Describes exporting `wsSessions` from `websocket.ts` and adding event forwarders.

**Reality:** ✅ DRIFT (expected). `src/server/websocket.ts:23` exports `handleWebSocket` as a `const`, not individual session maps. `wsSessions` is module-scoped and not exported. The event bus forwarding for `conversation:complete` doesn't exist.

---

## FINDING 8: MEDIUM — Provider-specific constants missing (v4 spec 3.2)

**Files:** `docs/atomic-v4/phase-03-multi-turn/3.2-dom-recovery.md` references `COMPOSER_SELECTORS`, `PROVIDER_URL_PATTERNS`.

**Reality:** ✅ DRIFT (expected). None of these constants exist in source. `src/engines/provider-selectors.ts` doesn't exist either.

---

## FINDING 9: MEDIUM — SelectorHealer missing key methods (v4 spec 3.6)

**File:** `docs/atomic-v4/phase-03-multi-turn/3.6-selector-healing.md`
**Spec:** References `healer.recordHit()`, `healer.proposeSelector()`, `healer.recordMiss()`.

**Reality:** ⚠ PARTIAL DRIFT — `SelectorHealer` class EXISTS at `src/engines/selector-healer.ts:36`, but `recordHit`, `proposeSelector`, `recordMiss` methods are NOT found in the source. The class exists but doesn't have these specific methods yet.

---

## FINDING 10: LOW — Seeds have more files than spec documents (v4 spec 1.2)

**File:** `docs/atomic-v4/phase-01-e2e-bootstrap/1.2-seed-pipeline.md`
**Spec:** Lists 4 seed providers (chatgpt, claude, gemini, system).

**Reality:** `seeds/providers/` contains 8 files:
- chatgpt.json, claude.json, deepseek.json, gemini.json, qwen.json, studio-ai.json, system.json, z-ai.json

`composer_type` and `send_method` fields exist in 6/8 provider JSONs (all except system.json) ✅

---

## FINDING 11: LOW — Conversational send has RECALL/REMEMBER steps not in atomic specs

The actual `ConversationManager.send()` pipeline (lines 147-300) has these steps:
1. [0] RECALL — context assembly from memory (NOT in any v4 Phase 2-3 atomic spec)
2. [1.5] INJECT CONTEXT — attach multi-dimensional state (NOT in atomic specs)
3. [3] LOCK — mutex handled inside ensureRunning (minor)
4. [9] REMEMBER — episodes recorded to MemoryEngine for learning (NOT in atomic specs)

**Status:** ✅ Source is *ahead* of atomic specs in these areas. No drift, just additional implementation not covered by the specs.

---

## FINDING 12: INFO — ContentBlock type exists in multiple places

`ContentBlock` type/interface exists at:
- `src/executor/content-blocks.ts:15` (interface)
- `src/engines/stream-parser.ts:9` (type)
- `src/schema/streaming.ts:4` (type)
- `src/storage/contracts/stream-block-store.ts:4` (type)

**Status:** ✅ Multiple definitions is a code smell but the atomic specs reference `ContentBlock` correctly — it's used throughout the pipeline.

---

## FINDING 13: INFO — StreamingProtocol methods all exist

`StreamingProtocol` at `src/engines/streaming-protocol.ts:31`:
- `startConversation()` ✅
- `captureChunk()` ✅
- `finishConversation()` ✅

**Status:** ✅ v4 spec 3.3 references match reality.

---

## v5 FORK: ENTIRELY NEW (all 26 files = CREATE)

All 26 v5 atomic spec files describe **entirely new architecture** — none of the following source files exist:

| Spec | Defined Interface | Source File | Status |
|------|------------------|-------------|--------|
| 0.1 | KernelRegistry | `src/engines/kernel/kernel-registry.ts` | MISSING |
| 0.2 | KernelContext | `src/engines/kernel/kernel-context.ts` | MISSING |
| 0.3 | KernelTracer | `src/engines/kernel/kernel-tracer.ts` | MISSING |
| 0.4 | KernelProvenance | `src/engines/kernel/kernel-provenance.ts` | MISSING |
| 0.5 | KernelSchema (Prisma) | `prisma/schema.prisma` (add models) | MISSING |
| 0.6 | KernelBootstrap | `src/engines/kernel/kernel.ts` | MISSING |
| 15.1 | OracleQueryEngine | `src/engines/kernel/oracle-query.ts` | MISSING |
| 15.2 | OracleDiagnosticEngine | `src/engines/kernel/oracle-diagnostic.ts` | MISSING |
| 15.3 | OracleActuator | `src/engines/kernel/oracle-actuator.ts` | MISSING |
| 15.4 | OracleEventStream | `src/engines/kernel/oracle-event-stream.ts` | MISSING |
| 16.1 | Kernel REST API | `src/server/routes/kernel-routes.ts` | MISSING |
| 16.2 | Kernel MCP Tools | `src/mcp/kernel-tools.ts` | MISSING |
| 16.3 | Kernel CLI | `src/cli/kernel-cli.ts` | MISSING |
| 16.4 | Kernel Frontend | `web/ui/src/components/oracle/` | MISSING |

**No drifts found** — all v5 specs correctly define new interfaces for files that don't exist yet.

---

## v3 FORK: MOSTLY NEW (~70% CREATE, ~30% EXISTING REFS)

### v3 Classes that EXIST in source code:

| Class | Source | Notes |
|-------|--------|-------|
| `AgenticLoopEngine` | `src/engines/agentic-loop.ts:45` | ✅ |
| `MirrorEngine` | `src/engines/mirror-engine.ts:142` | ✅ |
| `MemoryEngine` | `src/engines/memory-engine.ts:127` | ✅ |
| `UnifiedCapabilityRegistry` | `src/engines/unified-registry.ts:61` | ✅ |
| `KnowledgeExtractor` | `src/engines/knowledge-extractor.ts:52` | ✅ |
| `SelectorHealer` | `src/engines/selector-healer.ts:36` | ✅ (but missing recordHit/proposeSelector/recordMiss) |
| `ContextAssemblyEngine` | `src/engines/context-assembly.ts:253` | ✅ |
| `ExecutionMemoizer` | `src/engines/execution-memoizer.ts:36` | ✅ |
| `LocalModelAdapter` | `src/engines/local-model-adapter.ts` | ✅ |
| `ProviderHealthKernel` | `src/engines/provider-health.ts:70` | ✅ |
| `VersionManager` | `src/engines/version-manager.ts:92` | ✅ |
| `CapabilityEngine` | `src/engines/capability.ts:63` | ✅ |
| `CapabilityMacroEngine` | `src/engines/capability-macro.ts:44` | ✅ |
| `TelemetryAggregator` | `src/engines/telemetry-aggregator.ts:305` | ✅ |
| `RegistrationAuditor` | `src/engines/registration-auditor.ts:76` | ✅ |

### v3 Classes that DO NOT YET EXIST (to be created per atomic specs):

| Class | Spec Reference | Status |
|-------|---------------|--------|
| `IntentDecomposer` | v3 2.1/2.2/2.3 | CREATE |
| `IntentClarifier` | v3 2.3 | CREATE |
| `CapabilityComposer` | v3 2.4/2.5/2.6 | CREATE |
| `SandboxRunner` | v3 2.13 | CREATE |
| `ProvenanceRecorder` | v3 2.14 | CREATE |
| `ProvenanceQuery` | v3 2.15 | CREATE |
| `LiveCapabilityRegistry` | v3 2.7/2.8/2.9/2.10 | CREATE |
| `AgenticConversationLoop` | v3 2.11 | CREATE |
| `CanvasRegistry` | v3 3.1 | CREATE |
| `CanvasSpawner` | v3 3.3 | CREATE |
| `CanvasBinder` | v3 3.4 | CREATE |
| `CanvasMirror` | v3 3.5/3.6 | CREATE |
| `CanvasWsHub` | v3 3.11 | CREATE |
| `WorkspaceManager` | v3 4.1 | CREATE |
| `WorkspacePresets` | v3 4.2 | CREATE |
| `EmbeddingProvider` | v3 6.1 | CREATE |
| `MuxDispatcher` | v3 1.9 | CREATE |
| `TemplateSynthesizer` | v3 6.x | CREATE |

**Note:** v3 specs reference many engine classes that DO exist (62 total engine classes in `src/engines/`). The missing ones are specifically the agentic-core, canvas, and workspace modules from Phases 2-4, plus memory/knowledge Phase 6, and autonomous orchestration Phase 7.

---

## EXISTING ENGINE CATALOG (62 engines in src/engines/)

For cross-reference with atomic specs, here is the complete list of source engine classes:

`AdaptiveWorkspaceEngine`, `AgenticLoopEngine`, `AirGapEngine`, `AutonomousExecutionEngine`, `CapabilityEventBus`, `CapabilityMacroEngine`, `CapabilityResolutionEngine`, `CapabilityShapeRegistry`, `CapabilityEngine`, `CDPProxy`, `TraceLog`, `HealthMonitor`, `ChromeGovernor`, `ConfigManager`, `ContextAssemblyEngine`, `ConversationManager`, `ConversationOrganizer`, `CostOptimizer`, `CrossConversationSynthesizer`, `EncryptionEngine`, `ExecutionMemoizer`, `ExecutionPolicyEngine`, `ExportEngine`, `HarnessCheckpointEngine`, `PromptAugmenter`, `ResponseExtractor`, `ActionRouter`, `HarnessProtocolEngine`, `HarnessRuntime`, `KnowledgeExtractor`, `KnowledgeIngestionEngine`, `LocalModelAdapter`, `ManifestInferenceEngine`, `McpClientAdapter`, `McpServerAdapter`, `MemoryEngine`, `MirrorEngine`, `ObservationTap`, `PluginHotReload`, `PluginManagerImpl`, `ProviderDiscoveryEngine`, `ProviderHealthKernel`, `ProviderMuxEngine`, `ProviderRegistrar`, `RegistrationAuditor`, `SelectorHealer`, `SemanticGroundingEngine`, `SemanticSearchEngine`, `SessionCheckpointEngine`, `SituationDetector`, `StateTransitionEngine`, `StreamBlockStore`, `StreamParserEngine`, `StreamingProtocol`, `SyncEngine`, `TelemetryAggregator`, `TelemetryAudit`, `ToolUseProtocolImpl`, `TransferAccelerator`, `UnifiedCapabilityRegistry`, `VersionManager`, `WorkflowCompiler`, `WorkflowEngine`

---

## OVERALL VERDICT

| Classification | Count | Meaning |
|---------------|-------|---------|
| ✅ MATCH | ~45 | Interface/class exists as described in spec |
| ✓ DRIFT (expected) | ~10 | Spec describes feature to add — source doesn't have it yet |
| ⚠ PARTIAL DRIFT | 1 | `SelectorHealer` exists but missing methods |
| ❗ PENDING | 1 | `ProviderStoreImpl` path unknown |
| 💡 AHEAD | 3 | Source has features not in specs (RECALL, REMEMBER, CONTEXT INJECT) |

**The atomic specs are faithful design documents for features yet to be built.** They accurately describe what needs to be implemented. No critical design contradictions found.

---

## NEXT ACTIONS

1. Resolve Finding 1: Determine correct `ProviderStoreImpl` path or create it
2. Continue implementation per v4 → v5 → v3 phase order
3. Watch for import path drift in new files (frontend imports referencing `web/` vs `src/`)
4. Consider updating `SelectorHealer` with `recordHit`/`proposeSelector`/`recordMiss` methods (v4 spec 3.6)

---

## REPORT LOCATION

This report: `docs/drafts/sanity-check-report.md`
