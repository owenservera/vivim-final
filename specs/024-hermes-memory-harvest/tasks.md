# Tasks: Federated Agent Memory (spec 024, revised)

## M.1 — Errors (done)
- [x] T001 `MemoryError` + `MemoryBackendLimitError` in `src/errors.ts`
- [x] T001b add `MemoryWardenQuotaError` (per-agent write-quota breach)

## M.2 — MemoryBackend interface (done)
- [x] T002 `MemoryBackend` interface
- [x] T003 `BackendInitContext`
- [x] T004 `normalizeToolSchema`
- [x] T005 `RESERVED_TOOL_NAMES`

## M.3 — Background Sync (D6, FIFO)
- [x] T006 `src/engines/memory/background-sync.ts` `BackgroundSyncQueue`
- [x] T007 `submit(fn, kind)` non-blocking, FIFO ordering
- [x] T008 `flush(timeout)` sentinel barrier
- [x] T009 `drain(timeoutMs)` bounded shutdown, report abandoned
- [x] T010 export `_SYNC_DRAIN_TIMEOUT_MS=5000`, `_EXTERNAL_PREFETCH_TIMEOUT_MS=8000`

## M.4 — Streaming Context Scrubber (D5)
- [x] T011 `src/engines/memory/streaming-context-scrubber.ts` `StreamingContextScrubber`
- [x] T012 `feed(delta)` hold partial tags across deltas
- [x] T013 `flush()` discard unterminated span
- [x] T014 `sanitizeContext(text)` one-shot helper

## M.5 — Skill Scaffolding Strip (D10)
- [x] T015 `src/engines/memory/skill-scaffolding.ts` `stripSkillScaffolding(text)`
- [x] T016 recover user instruction; return null for bare skill invocations

## M.6 — NodeBackend (builtin, agent-scoped)
- [x] T017 `src/engines/memory/node-backend.ts` `NodeBackend implements MemoryBackend`
- [x] T018 `syncTurn` → node-store.putNode (cap-store.memory, ownerAgentId scope) + belief/extractor/semantic
- [x] T019 `prefetch` → curated pinned + semantic best-effort, agent-scoped
- [x] T020 `systemPromptBlock` → ''
- [x] T021 `getToolSchemas` → []

## M.7 — MemoryOracle (per-agent)
- [x] T022 `src/engines/memory/memory-oracle.ts` `MemoryOracle`
- [x] T023 `recall(query, k)` → agent-scoped node search
- [x] T024 `consolidate(turn)` → extractor + semantic best-effort
- [x] T025 `prune(opts)` → quality/validUntil eviction
- [x] T026 `snapshot()` → frozen cache-stable block (FR-005)
- [x] T027 `forkFrom(parentAgentId)` → clone parent nodes lineageKind='fork_of'
- [x] T028 `inherit(memoryIds)` → copy child→parent scope

## M.8 — MemoryWarden (per-agent, was "Governor")
- [x] T029 `src/engines/memory/memory-warden.ts` `MemoryWarden`
- [x] T030 gate: skip write if `agentContext !== 'primary'`
- [x] T031 gate: StreamingContextScrubber on streamed context
- [x] T032 provenance metadata on every write
- [x] T033 per-agent write quota → `MemoryWardenQuotaError`
- [x] T034 `mirrorToBelief` → belief-store

## M.9 — MemoryFabric (host)
- [x] T035 `src/engines/memory/memory-fabric.ts` `MemoryFabric`
- [x] T036 `provisionAgentMemory` idempotent + scope + oracle caps + warden binding
- [x] T037 one-external-backend guard per instance
- [x] T038 `dissolveAgentMemory` teardown + unregister caps
- [x] T039 fork/inherit orchestration
- [x] T040 `snapshotForSession` cache-stable injection

## M.10 — Integration hooks
- [x] T041 `src/engines/agent-builder.ts` call `fabric.provisionAgentMemory` in spawnFromBuilder + spawnChild
- [x] T041b `src/server/index.ts` construct `MemoryFabric` + `AgentBuilderEngine(fabric)` at boot; expose on `ServerContext` (`memoryFabric`, `agentBuilder`)
- [x] T042 `src/engines/context-assembly.ts` — added optional `memorySnapshotProvider` ctor param; assemble() injects frozen snapshot as `identity` layer (FR-005). Hook ready; wired when context-assembly is constructed (not yet in boot path).
- [x] T043 `src/engines/capability-bootstrap.ts` — oracle caps registered by fabric (mem:* factory) at provision time
- [ ] T044 `src/engines/memory-engine.ts` — delegate scoped recordMemory to fabric: DEFERRED (memory-engine has no fabric ref; fabric owns its own oracle.consolidate). Left as future work.

## M.11 — Tests + verify
- [x] T045 `tests/unit/engines/memory/fabric.test.ts` (recall/consolidate/prune/fork/inherit/warden/fabric)
- [x] T046 warden covered in fabric.test.ts
- [x] T047 fabric covered in fabric.test.ts
- [x] T048 `bun test tests/unit/engines/memory/` → 10 pass, 0 fail. Module graph transpiles clean via bun build.
