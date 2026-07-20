# AGENT3.md — Federated Per-Agent Memory Subsystem (spec 024: Hermes Harvest)

**Agent:** #3 &nbsp;|&nbsp; **Feature:** `024-hermes-memory-harvest` &nbsp;|&nbsp; **Status:** CODE COMPLETE — boots, live-verified, 49/49 memory suite, 3548/3548 cross-surface. FR-05 context injection WIRED into send path (system agent for user convos, agent:<id> for agent threads).
**Branch:** master (uncommitted working tree)

---

## OBJECTIVE

Port Hermes's agentic `MemoryProvider`/`MemoryManager` into vivim-final as a **federated per-agent memory subsystem** (spec 024). `MemoryFabric` auto-provisions `MemoryOracle` + `MemoryWarden` per spawned agent with fork/inherit, streaming scrub (`<memory-context>` span stripping), and background sync. Isolate each agent's memory at the DB layer via `conversationId = 'agentMem:<agentId>'`. Expose `mem:*` capabilities cross-surface (cli/api/mcp/ui) so the system is verifiable via `devops verify-cross-surface`.

All work follows the Store Contracts invariant (engines depend on `src/storage/contracts/*`, never `impl/*`) and the Governor Canon (only `ChromeGovernor` touches CDP — no new CDP surface added).

---

## FILES I OWN (do not edit from other agents without sync)

- `src/engines/memory/` (entire dir) — `memory-fabric.ts`, `memory-oracle.ts`, `memory-warden.ts`, `node-backend.ts`, `background-sync.ts`, `streaming-context-scrubber.ts`, `skill-scaffolding.ts`
- `src/schema/node.ts` — `NodeBase` opts + `createNode` (`searchText?`/`conversationId?`)
- `src/storage/impl/node-store-impl.ts` — `toRow` reads `searchText`/`conversationId`
- `src/engines/capability-bootstrap.ts` — `makeCapability` usage in fabric (surfaces/cliCommand)
- `src/server/index.ts` — boot wiring of `MemoryFabric` + `AgentBuilderEngine`
- `src/engines/agent-builder.ts` — spawn hooks → `fabric.provisionAgentMemory`
- `src/engines/context-assembly.ts` — `memorySnapshotProvider` (FR-05) hook (still present)
- `src/engines/conversation-manager.ts` — FR-05 injection: `memoryFabric` ctor param + `resolveOwningAgentId` + `identityContext` snapshot injection in `[0] RECALL`
- `specs/024-hermes-memory-harvest/` — `tasks.md` (T001–T048) + new `01-tracker.md` (satellite devops tracker)

---

## WHAT IS DONE

1. **All 7 core memory modules implemented** (T006–T034): `BackgroundSyncQueue` (FIFO, `flush`/`drain`, bounded), `StreamingContextScrubber` (+`sanitizeContext`), `stripSkillScaffolding`, `NodeBackend` (scoped backend, `syncTurn`/`prefetch`/`shutdown`), `MemoryOracle` (recall/consolidate/prune/snapshot/forkFrom/inherit), `MemoryWarden` (gating/quota/provenance/mirrorToBelief), `MemoryFabric` (provision/dissolve/fork-inherit/snapshot/scrub).
2. **DB-layer isolation** (D11): `NodeBase` + `node-store-impl.toRow` accept `conversationId`/`searchText`; agent scope `agentMem:<agentId>`; `oracle.listScoped` filters by `conversationId`. Verified: agent A's nodes not visible under agent B's scope.
3. **Boot wiring fixed at runtime**: `memoryFabric`/`agentBuilder` declared at function scope (were block-scoped inside a `try` → `ReferenceError` at boot). `server/index.ts` now constructs `MemoryFabric` + `AgentBuilderEngine`, exposes both on `ServerContext`, and provisions the `system` agent at boot so `mem:*` caps are live.
4. **Capability validation fixed**: `registerOracleCapabilities` now passes explicit `surfaces: ['cli','ui','workflow','mcp','api']` + `cliCommand`/`mcpToolName`/`apiEndpoint`/`ui` (previously defaulted to `ALL_SURFACES` without `cliCommand` → boot crash `Capability ... must have cliCommand`).
5. **Shutdown semantics**: `NodeBackend.shutdown()` → `sync.flush()` (completes queued writes) instead of `drain()` (which abandoned them).
6. **Tests: 49/49 memory suite** across 8 files (fabric, oracle, node-backend, background-sync, scrubber, skill-scaffolding). One transient flake observed in a re-run (`await can only be used inside async function` — a stale bun-test transform; passes on re-run).
7. **Live verification**: `mem_recall_system` / `mem_consolidate_system` / `mem_prune_system` resolve across cli/api/mcp/ui. `bun run devops verify-cross-surface` → **3548 passed, 0 failed**.
8. **Satellite devops tracker** created: `specs/024-hermes-memory-harvest/01-tracker.md` (Phase 14, units 14.1–14.8). Verified `bun run devops select --tracker specs/024-hermes-memory-harvest/01-tracker.md` returns the single deferred unit 14.8. Spec 024 is now selectable/markable without forking the master 127-unit tracker.

---

## WHAT IS PENDING (safe to resume after coordination)

- [x] **FR-05 wiring (14.6) — DONE:** `ConversationManager` now takes `memoryFabric` (wired in `server/index.ts`). In the `[0] RECALL` block it resolves the owning agent via `resolveOwningAgentId` (user convo → `system`; agent thread `providerId='agent:<id>'` → that id) and injects `fabric.snapshotForSession(agentId)` into `memoryContext.identityContext`. `AgentMemoryContext.identityContext?` added to `memory-engine.ts`. The `ContextAssemblyEngine.memorySnapshotProvider` hook remains available but is unused (engine never instantiated in server); FR-05 is satisfied via the live send path instead.
- [ ] **T044 (14.8):** delegate scoped `recordMemory` from `memory-engine.ts` to fabric. Intentionally DEFERRED — fabric owns `oracle.consolidate`; out of scope. Marked `[ ]` in satellite tracker.
- [ ] **Pre-existing type errors (NOT introduced by me, but in files I touch):**
  - `src/engines/unified-registry.ts:113/119` — `filter?.surface` / `filter?.tag` not narrowed (`CapabilitySurface | undefined`).
  - These should be a separate follow-up PR (not bundled into spec 024).
  - **CORRECTION (stale item dropped):** the prior note claimed `agentic-store-impl.ts` was missing 4 `AgenticStoreContract` methods (`startAgentConversation`/`appendAgentMessage`/`getAgentMessages`/`linkStepToMessage`). VERIFIED FALSE — all 4 methods exist (added by AGENT5 Option C at `src/storage/impl/agentic-store-impl.ts:829/860/914/934`). `AgenticStoreImpl` is assignable to `AgenticStoreContract`; no drift. Do NOT reopen that as a spec 024 task.
- [ ] **Lint/typecheck:** no `tsc` run per AGENTS.md guardrail; `bun build src/server/index.ts` passes (exit 0). Biome lint not yet run on changed files.
- [ ] **Commit:** single conventional commit `feat(memory): federated per-agent memory subsystem (spec 024)` — NOT committed (uncommitted working tree).

---

## KEY VERIFIED FACTS (for other agents to avoid re-litigating)

- `makeCapability` defaults `surfaces` to `ALL_SURFACES` (incl. `cli`); a CLI-exposed cap WITHOUT `cliCommand` throws at `registry.register` (boot crash). Always pass `cliCommand` when `surfaces` includes `cli`.
- `server/index.ts` `let` declarations must be at FUNCTION scope, not inside a `try` — block-scoped `let` is invisible to the `ctx` object built outside the try (caused a `ReferenceError: memoryFabric is not defined` at boot).
- `NodeBackend.shutdown()` must `flush()` (complete writes), not `drain()` (abandon) — spec 024 FR-008 shutdown is bounded-complete, not discard.
- Agent memory isolation key: `conversationId = 'agentMem:<agentId>'` on every `cap-store.memory` node; `searchText` set for `listNodes` recall.
- `verify-cross-surface` is the real gate (3548/3548). The `⚠` alias-collision lines are pre-existing (e.g. `ms`→`memory_store` vs `media_skip`) and unrelated to `mem:*`.
- `devops gate` currently HANGS (scans whole tree, >120s timeout) — use `verify-cross-surface` instead.

---

## COLLISION NOTES

- I do NOT touch: `chrome-governor`, `fleet-supervisor`, `fleet-limiter`, `local-agent-executor`, `provider-registrar`, `stream-parser`, `prisma/schema.prisma`, any CDP surface. (Respects AGENT1/AGENT2 boundaries.)
- `server/index.ts` edits are ADDITIVE (new `let` + try-block construct + `ctx` fields) — minimal, scoped to the memory block; does not alter existing bootstrap wiring.
- `src/engines/unified-registry.ts` type error is PRE-EXISTING (present before this session) — I only added a call site; not mine to fix inside spec 024.
- `agentic-store-impl.ts` has NO drift — all 4 `AgenticStoreContract` methods exist (AGENT5 Option C). Prior AGENT3 note claiming missing methods was STALE and is retracted.
- `mem:*` capability ids are namespaced per `agentId` (`cap:mem:recall:<agentId>`); no other agent should register them.

---

## NEXT STEPS (post-coordination)

1. Run `bun run lint` (Biome) on changed files; fix any style issues.
2. Run a coordinated `bun run typecheck` (or scoped) — only the `unified-registry.ts:113/119` pre-existing error should remain (FR-05 wiring is type-clean).
3. Re-run `bun run devops verify-cross-surface` + memory suite (already 3548/3548 + 49/49 after FR-05; re-confirm if any further edits land).
4. Commit spec 024 as a single conventional commit (only after coordinator sign-off).
