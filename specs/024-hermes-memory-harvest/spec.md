# Spec 024 — Federated Agent Memory (Hermes Harvest, revised)

## Purpose
Port Hermes's agentic `MemoryProvider`/`MemoryManager` into vivim, but **not** as a single
global orchestrator. Instead it becomes a **MemoryFabric** that auto-generates a **per-agent
layered memory subsystem** every time an agent is spawned by `AgentBuilderEngine`. Each agent
gets its own scoped memory graph, a dedicated **MemoryOracle** (recall/consolidate/prune),
and a **MemoryWarden** (write-gating + quota + provenance). Sub-agents fork a frozen
read-only copy of the parent's memory and may selectively inherit.

This composes with the real substrate:
- `AgentBuilderEngine.spawnFromBuilder` / `spawnChild` — single spawn point → hook provisioning.
- `agentic-store` (`getAgent`, `forkRun`, `putBelief`, `putCapability`/`bindCapability`) — used directly, no new store layer.
- `node-store` (ACU + `parentVersion` fork chain, `acuType`, `aclJson`, `conversationId`) — every memory artifact is a `cap-store.memory.*` Node scoped via `conversationId = 'agentMem:<agentId>'`.
- `unified-registry.register(makeCapability(...))` — per-agent MemoryOracle is a capability, natively callable from CLI/UI/MCP/API.

## Functional Requirements
- **FR-001** `MemoryFabric.provisionAgentMemory(agentId, runId, parentAgentId?)` creates the
  per-agent subsystem on spawn (auto by default; `AgentSpec.memoryConfig='none'` opts out).
- **FR-002** Subsystem = `cap-store.memory-agent` scope Node + 3 MemoryOracle capabilities
  (`mem:recall:<agentId>`, `mem:consolidate:<agentId>`, `mem:prune:<agentId>`) bound to the run
  via `bindCapability`, + a MemoryWarden binding.
- **FR-003** `MemoryOracle` owns recall (semantic + pinned curated), consolidation
  (knowledge-extractor + cross-conversation synthesis), and pruning (quality/validUntil) over the
  **agent-scoped** NodeStore only.
- **FR-004** `MemoryWarden` enforces: StreamingContextScrubber on streamed context,
  provenance metadata on every write, execution-context skip (non-primary agentContext), and per-agent
  write quota.
- **FR-005** `snapshotForSession(agentId)` returns a **frozen, cache-stable** memory block
  injected by `ContextAssemblyEngine` (deterministic given agentId+version, no live LLM).
- **FR-006** Fork: `forkRun` + memory fork = clone parent `cap-store.memory.*` Nodes into child scope
  with `lineageKind='fork_of'`, `parentVersion` pointing at parent node, read-only until `mem:inherit`.
- **FR-007** Selective inherit: `mem:inherit` step copies chosen child memories into parent's writable
  scope (one-directional promotion).
- **FR-008** Background FIFO sync (single-worker promise chain, non-blocking submit, bounded drain).
- **FR-009** One-external-backend guard **per fabric instance** (D3): at most one external MemoryBackend
  across all agents.
- **FR-010** Reserved-name drop (FR-012): backend tool schemas colliding with vivim capability slugs
  are dropped at registration.
- **FR-011** `disolveAgentMemory(agentId)` tears down subsystem + unregisters capabilities on agent retire.
- **FR-012** Skill-scaffolding stripping on prefetch (D10): recover user instruction; skip bare skill invocations.
- **FR-013** No DB migration: isolation via `conversationId='agentMem:<agentId>'` + `aclJson.ownerAgentId`
  (reuses ACU fields).

## Success Criteria
- **SC-001** Spawning an agent via `spawnFromBuilder` auto-creates 3 `mem:*` capabilities resolvable on CLI/UI/MCP/API.
- **SC-002** Two agents' memories are isolated (query agent A's oracle returns nothing from agent B).
- **SC-003** Sub-agent fork yields a frozen parent copy; `mem:inherit` promotes chosen memories to parent.
- **SC-004** `StreamingContextScrubber` drops `<memory-context>` spans in streamed deltas.
- **SC-005** Per-agent verifiable: typecheck passes, unit tests for oracle/warden/fabric/fork-inherit green.

## User Stories
- As an agent-builder, I spawn an agent and it natively owns a memory subsystem without extra wiring.
- As an agent, I recall only my own scoped memories; my sub-agents fork my context but don't mutate it.
- As a reviewer, I can audit every memory write via provenance + ACU fields.

## Design Decisons (from audit)
- **D0 (audit):** "MemoryGovernor" → renamed **MemoryWarden** to avoid Governor Canon collision with `ChromeGovernor`.
- **D3:** one-external-backend guard is **per MemoryFabric instance**, not global.
- **D11 (gap fix):** no `ownerAgentId` column exists; isolation uses `conversationId='agentMem:<id>'` + `aclJson`.
- **D12 (gap fix):** re-provisioning a live agent must not double-register capabilities (idempotent `provisionAgentMemory`).
