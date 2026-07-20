# Spec 024: Federated Per-Agent Memory (Hermes Harvest) — Satellite Tracker

> **Source:** `specs/024-hermes-memory-harvest/tasks.md` (T001–T048, full checklist).
> This satellite tracker makes spec 024 selectable/markable via
> `bun run devops --tracker specs/024-hermes-memory-harvest/01-tracker.md <cmd>`
> without forking the master 127-unit tracker.
>
> **States:** `[ ]` pending · `[~]` in_progress · `[x]` done · `[!]` blocked

---

## Phase 14: Federated Per-Agent Memory (8 units — 7 done, 1 deferred)

> **Source:** `specs/024-hermes-memory-harvest/` (spec 024, Hermes memory harvest)
>
> **Note:** Ports Hermes's agentic MemoryProvider/MemoryManager into a federated
> per-agent memory subsystem. `MemoryFabric` auto-provisions `MemoryOracle` +
> `MemoryWarden` per spawned agent with fork/inherit, streaming scrub, and
> background sync. Verified live: `verify-cross-surface` 3548/3548, memory suite
> 49/49. T044 (`memory-engine` delegation) is intentionally deferred — fabric
> owns `oracle.consolidate`.

- [x] 14.1 — Core memory modules (background-sync, streaming-context-scrubber, skill-scaffolding, node-backend, memory-oracle, memory-warden, memory-fabric) → `specs/024-hermes-memory-harvest/tasks.md`
- [x] 14.2 — DB-layer isolation: `NodeBase` + `node-store-impl.toRow` accept `conversationId`/`searchText`; agent scope `agentMem:<agentId>` → `specs/024-hermes-memory-harvest/tasks.md`
- [x] 14.3 — Oracle scoping: `consolidate`/`forkFrom`/`inherit` set `conversationId`/`searchText`/`acl:{sharingPolicy:'agent'}`; `listScoped` filters by `conversationId` → `specs/024-hermes-memory-harvest/tasks.md`
- [x] 14.4 — NodeBackend background sync + skill-scaffolding strip; `shutdown` flushes (FR-008/FR-012) → `specs/024-hermes-memory-harvest/tasks.md`
- [x] 14.5 — MemoryFabric boot wiring in `server/index.ts`: constructs `MemoryFabric` + `AgentBuilderEngine`, exposes on `ServerContext`, provisions `system` agent at boot → `specs/024-hermes-memory-harvest/tasks.md`
- [x] 14.6 — AgentBuilderEngine spawn hooks + ContextAssemblyEngine `memorySnapshotProvider` (FR-005) ready → `specs/024-hermes-memory-harvest/tasks.md`
- [x] 14.7 — Tests: 49/49 memory suite (fabric, oracle, node-backend, background-sync, scrubber, skill-scaffolding) + live `verify-cross-surface` 3548/3548 → `specs/024-hermes-memory-harvest/tasks.md`
- [ ] 14.8 — T044: delegate scoped `recordMemory` from `memory-engine.ts` to fabric — DEFERRED (fabric owns `oracle.consolidate`; out of scope) → `specs/024-hermes-memory-harvest/tasks.md`

---

**Total units:** 8 | **Done:** 7 | **Blocked:** 0 | **Pending:** 1

## Last Updated

2026-07-19
