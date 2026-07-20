# Plan: Federated Agent Memory (spec 024, revised)

## Files touched
- `src/errors.ts` — `MemoryError`, `MemoryBackendLimitError` (done), add `MemoryWardenQuotaError`.
- `src/engines/memory/memory-backend.ts` — `MemoryBackend` interface (done).
- `src/engines/memory/background-sync.ts` — **new** FIFO queue (T-BG).
- `src/engines/memory/streaming-context-scrubber.ts` — **new** (T-SCR).
- `src/engines/memory/skill-scaffolding.ts` — **new** (T-SKILL).
- `src/engines/memory/node-backend.ts` — **new** builtin backend scoped to `conversationId='agentMem:<agentId>'`.
- `src/engines/memory/memory-oracle.ts` — **new** per-agent oracle (recall/consolidate/prune) over scoped node-store + extractor + semantic + synthesis.
- `src/engines/memory/memory-warden.ts` — **new** per-agent write-gating/quota/provenance.
- `src/engines/memory/memory-fabric.ts` — **new** host: `provisionAgentMemory`, `disolveAgentMemory`, fork/inherit, one-external guard.
- `src/engines/agent-builder.ts` — hook `fabric.provisionAgentMemory` in `spawnFromBuilder` + `spawnChild`.
- `src/engines/context-assembly.ts` — inject agent-scoped frozen snapshot (cache-stable).
- `src/engines/memory-engine.ts` — delegate `recordMemory` to fabric when agent-scoped.
- `src/engines/capability-bootstrap.ts` — register `mem:*` capability factory.

## Invariants honored
- **Store Contracts:** oracle/warden depend on `src/storage/contracts/*` (node-store, knowledge-extractor-store, semantic-search-store, memory-curated-store) + `belief-store` engine; never `impl/`.
- **Governor Canon:** renamed to MemoryWarden — no collision with `ChromeGovernor`.
- **DB single-source:** isolation via `conversationId`/`aclJson` (no migration).
- **One entry point:** oracle surfaces as UnifiedCapability (all surfaces).

## Implementation order
1. errors (done) → 2. memory-backend (done) → 3. background-sync → 4. scrubber → 5. skill-scaffolding → 6. node-backend → 7. memory-oracle → 8. memory-warden → 9. memory-fabric → 10. agent-builder hook → 11. context-assembly + bootstrap → 12. tests → 13. typecheck.

## Verification
- `bun test tests/unit/engines/memory/` — oracle recall, warden gating, fabric provisioning, fork/inherit, one-external guard.
- `bun run typecheck`.
- `bun run devops verify-cross-surface` for `mem:*` capabilities.
