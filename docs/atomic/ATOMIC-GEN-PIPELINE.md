# Atomic File Generation Pipeline

> **Status:** ACTIVE | **Created:** 2026-07-11
> **Purpose:** Prescriptive guide for generating atomic task files across phases 14-20.
> **Read this file FIRST when resuming any atomic generation work.**

---

## CRITICAL RULE: Source-First Generation

**Before creating ANY atomic file, you MUST read its source upgrade .md file.**

This is non-negotiable. The upgrade docs contain the full TypeScript interfaces, store contracts, execution flows, and test specs that the atomic files reference. Without reading the source, the atomic file will be wrong.

### Source File Map

| Phase | Primary Source | Secondary Source |
|-------|---------------|-----------------|
| 14 | upgrade-02-architecture.md §Modified Engines | upgrade-04-engines.md §Modified Engines |
| 15 | upgrade-05-memory-intelligence.md | upgrade-02-architecture.md §1-4, upgrade-03-schema.md §Phase 15 |
| 16 | upgrade-06-muxing-routing.md | upgrade-02-architecture.md §5, upgrade-03-schema.md §Phase 16 |
| 17 | upgrade-05-memory-intelligence.md | upgrade-02-architecture.md §6-7, upgrade-03-schema.md §Phase 17 |
| 18 | upgrade-07-composable-interface.md | upgrade-02-architecture.md §8, upgrade-03-schema.md §Phase 18 |
| 19 | upgrade-08-autonomous-execution.md | upgrade-02-architecture.md §9-10, upgrade-03-schema.md §Phase 19 |
| 20 | upgrade-09-sovereign-data.md | upgrade-02-architecture.md §11-14, upgrade-03-schema.md §Phase 20 |

### Context Management Protocol

1. **Before starting a phase:** Read the primary source doc for that phase. This consumes context.
2. **Write 2-3 atomic files.** Then context is near full.
3. **Autocompact will fire.** After compaction, re-read THIS pipeline file to know where you left off.
4. **Do NOT re-read the full upgrade doc.** You only need the specific section for the next unit. Use `grep` to find the section.
5. **Each atomic file is self-contained.** Once written, it contains all info needed for implementation. The upgrade doc is only needed during generation.

---

## Atomic File Template

Every atomic file MUST follow this exact structure:

```markdown
# Unit X.Y: <Name>

**Phase:** N | **File:** `<target-file-path>`
**Depends:** <dep-list> | **Source:** <upgrade-doc-filename> §<section>

## Purpose
<1-3 sentences describing what this unit implements.>

## Interface
```typescript
// Full TypeScript interface as specified in the upgrade doc
```

## Store Contract
```typescript
// Store interface this engine depends on (if applicable)
```

## Execution Flow
<Step-by-step flow as specified in upgrade-04-engines.md or the relevant doc section>

## Tests
- <test case 1>
- <test case 2>
- <test case 3>

## Gate
- `bun run typecheck` passes
```

### Convention Rules

1. **Filename:** `X.Y-kebab-case-name.md` (e.g., `16.5-cost-optimizer.md`)
2. **Directory:** `docs/atomic/phase-N-phase-name/` (e.g., `phase-16-invisible-router/`)
3. **Source line:** ALWAYS cite the specific upgrade doc and section: `upgrade-06-muxing-routing.md §ProviderMuxEngine`
4. **Depends:** Use unit IDs (e.g., `16.1 ProviderMuxEngine`), not engine names
5. **Interface section:** Copy the FULL TypeScript interface from the upgrade doc. Do not abbreviate.
6. **Store contract:** Include if the engine depends on a store. Omit for schema/server/wiring units.
7. **Tests:** Minimum 3 test cases per unit. Use the test specs from upgrade-04-engines.md.
8. **Gate:** Always `bun run typecheck` passes. For schema units, also include migration success.
9. **No invented abstractions.** Only include what the upgrade docs specify.

---

## Disk Status — What Exists

### COMPLETE (all files on disk):

| Phase | Dir | Files | Status |
|-------|-----|-------|--------|
| 14 | `phase-14-wire-stubs/` | 14.1-14.8 | **8/8 DONE** |
| 15 | `phase-15-sovereign-intelligence/` | 15.1-15.12 | **12/12 DONE** |
| 16 | `phase-16-invisible-router/` | 16.1-16.8 | **8/8 DONE** |
| 17 | `phase-17-context-agent/` | 17.1-17.6 | **6/6 DONE** |
| 18 | `phase-18-composable-interface/` | 18.1-18.10 | **10/10 DONE** |
| 19 | `phase-19-autonomous-execution/` | 19.1-19.8 | **8/8 DONE** |

### INCOMPLETE (missing files):

| Phase | Dir | Missing | Status |
|-------|-----|---------|--------|
| 20 | `phase-20-sovereign-data/` | 20.5, 20.6, 20.7, 20.8 | **4/8 REMAINING** |

### Phase 20 Missing Files — Content Source

These 4 files were designed but never written to disk:

| Unit | Name | Source Doc | Key Content |
|------|------|-----------|-------------|
| 20.5 | Local Model Integration | upgrade-09-sovereign-data.md §AirGapEngine | `src/engines/local-model-adapter.ts`, Ollama/llama.cpp adapter, extends AirGapEngine |
| 20.6 | SyncEngine | upgrade-09-sovereign-data.md §SyncEngine | `src/engines/sync.ts`, E2E-encrypted multi-device sync, pair/sync/revoke |
| 20.7 | Telemetry Audit | upgrade-09-sovereign-data.md §Telemetry Audit | `src/engines/telemetry-audit.ts`, network call recording, zero-cloud proof |
| 20.8 | Schema + Store: Sovereign Tables | upgrade-03-schema.md §Phase 20 | `prisma/schema.prisma`, SyncLog + SyncPeer models, migration |

**For each missing file:** Read the relevant section from upgrade-09-sovereign-data.md or upgrade-03-schema.md, then write the atomic file using the template.

---

## DevOps Tracking Updates — Checklist

After ALL atomic files are on disk, update these files:

| # | File | What to Add | Section |
|---|------|------------|---------|
| 1 | `docs/atomic/01-tracker.md` | Phase 14-20 unit entries with `[ ]` checkboxes | Add after Phase 13 section |
| 2 | `docs/atomic/00-master-plan.md` | Phase 14-20 dependency graph and unit listings | Add to "Upgrade Units" section |
| 3 | `docs/goals/GOALS.md` | O-010 through O-016 objectives for upgrade phases | Add to Goals section |
| 4 | `docs/roadmap/INVARIANTS.md` | Invariants for encryption, air-gap, HITL approval | Add to Boundary Conditions |
| 5 | `docs/atomic/PROGRESS.md` | Log entries for Phase 14-20 completions | Add timestamped entries |
| 6 | `docs/atomic/99-glossary.md` | New engine terms (EncryptionEngine, AirGapEngine, etc.) | Add to Glossary |

---

## Resume Protocol

When resuming work after context compaction:

1. **Read this file** (`ATOMIC-GEN-PIPELINE.md`) — you are here now
2. **Check disk status** — `Get-ChildItem docs/atomic/phase-*` to see what exists
3. **Identify gap** — compare disk vs the "Disk Status" section above
4. **For each missing file:** Read only the specific section from the upgrade doc (use grep), then write
5. **After all atomic files done:** Execute the DevOps Tracking Updates checklist
6. **Delete this file** — it is a bootstrap artifact, not part of the permanent docs

---

## Unit-to-File Quick Reference

### Phase 14 (8 units) — Wire Stubs → Real CDP
| Unit | File | Target |
|------|------|--------|
| 14.1 | 14.1-cdp-transport.md | `src/executor/cdp-transport.ts` |
| 14.2 | 14.2-governor-cdp-real.md | `src/engines/chrome-governor.ts` |
| 14.3 | 14.3-governor-trace-real.md | `src/engines/chrome-governor.ts` |
| 14.4 | 14.4-governor-health-real.md | `src/engines/chrome-governor.ts` |
| 14.5 | 14.5-conv-manager-eventbus-fix.md | `src/engines/conversation-manager.ts` |
| 14.6 | 14.6-server-conv-manager-wiring.md | `src/server/conversation-router.ts` |
| 14.7 | 14.7-harness-runtime-real-context.md | `src/engines/harness-runtime.ts` |
| 14.8 | 14.8-router-complete.md | `src/router/router.ts` |

### Phase 15 (12 units) — Sovereign Intelligence
| Unit | File | Target |
|------|------|--------|
| 15.1 | 15.1-knowledge-ingestion-engine.md | `src/engines/knowledge-ingestion.ts` |
| 15.2 | 15.2-chatgpt-import-parser.md | `src/engines/parsers/chatgpt-import.ts` |
| 15.3 | 15.3-claude-import-parser.md | `src/engines/parsers/claude-import.ts` |
| 15.4 | 15.4-gemini-import-parser.md | `src/engines/parsers/gemini-import.ts` |
| 15.5 | 15.5-knowledge-extractor.md | `src/engines/knowledge-extractor.ts` |
| 15.6 | 15.6-semantic-search-engine.md | `src/engines/semantic-search.ts` |
| 15.7 | 15.7-cross-conversation-synthesizer.md | `src/engines/cross-conversation-synthesis.ts` |
| 15.8 | 15.8-memory-engine-ulid-expansion.md | `src/engines/memory-engine.ts` |
| 15.9 | 15.9-schema-memory-intelligence.md | `prisma/schema.prisma` |
| 15.10 | 15.10-store-impls-knowledge.md | `src/storage/impl/` |
| 15.11 | 15.11-server-routes-knowledge.md | `src/server/knowledge-router.ts` |
| 15.12 | 15.12-full-export-engine.md | `src/engines/export.ts` |

### Phase 16 (8 units) — Invisible Router
| Unit | File | Target |
|------|------|--------|
| 16.1 | 16.1-provider-mux-engine.md | `src/engines/provider-mux.ts` |
| 16.2 | 16.2-mux-strategies.md | `src/engines/provider-mux.ts` |
| 16.3 | 16.3-response-synthesis.md | `src/engines/provider-mux.ts` |
| 16.4 | 16.4-automatic-failover.md | `src/engines/provider-mux.ts` |
| 16.5 | 16.5-cost-optimizer.md | `src/engines/cost-optimizer.ts` |
| 16.6 | 16.6-learned-routing.md | `src/engines/provider-mux.ts` |
| 16.7 | 16.7-schema-mux-tables.md | `prisma/schema.prisma` |
| 16.8 | 16.8-server-routes-mux.md | `src/server/mux-router.ts` |

### Phase 17 (6 units) — Context-Aware Agent
| Unit | File | Target |
|------|------|--------|
| 17.1 | 17.1-situation-detector.md | `src/engines/situation-detector.ts` |
| 17.2 | 17.2-context-assembly-engine.md | `src/engines/context-assembly.ts` |
| 17.3 | 17.3-predictive-prewarming.md | `src/engines/context-assembly.ts` |
| 17.4 | 17.4-budget-token-allocation.md | `src/engines/context-assembly.ts` |
| 17.5 | 17.5-schema-context-tables.md | `prisma/schema.prisma` |
| 17.6 | 17.6-conv-manager-integration.md | `src/engines/conversation-manager.ts` |

### Phase 18 (10 units) — Composable Interface
| Unit | File | Target |
|------|------|--------|
| 18.1 | 18.1-unified-capability-registry.md | `src/engines/unified-registry.ts` |
| 18.2 | 18.2-cli-complete.md | `src/cli/commands/` |
| 18.3 | 18.3-workflow-builder-api.md | `src/engines/workflow-engine.ts` |
| 18.4 | 18.4-plugin-hot-reload.md | `src/engines/plugin-hot-reload.ts` |
| 18.5 | 18.5-ws-agent-bridge-v2.md | `src/server/websocket.ts` |
| 18.6 | 18.6-adaptive-workspace-modes.md | `src/engines/adaptive-workspace.ts` |
| 18.7 | 18.7-conversation-organization.md | `src/engines/conversation-organizer.ts` |
| 18.8 | 18.8-memory-visualization-api.md | `src/server/memory-viz-router.ts` |
| 18.9 | 18.9-schema-workspace-tables.md | `prisma/schema.prisma` |
| 18.10 | 18.10-mcp-server-real-bind.md | `src/engines/mcp-server-adapter.ts` |

### Phase 19 (8 units) — Autonomous Execution
| Unit | File | Target |
|------|------|--------|
| 19.1 | 19.1-autonomous-execution-engine.md | `src/engines/autonomous-execution.ts` |
| 19.2 | 19.2-execution-policy-engine.md | `src/engines/execution-policy.ts` |
| 19.3 | 19.3-hitl-gate-system.md | `src/engines/autonomous-execution.ts` |
| 19.4 | 19.4-self-healing-integration.md | `src/engines/autonomous-execution.ts` |
| 19.5 | 19.5-agentic-loop-full.md | `src/engines/agentic-loop.ts` |
| 19.6 | 19.6-observability-layer.md | `src/server/autonomous-router.ts` |
| 19.7 | 19.7-schema-autonomous-tables.md | `prisma/schema.prisma` |
| 19.8 | 19.8-visual-workflow-dag.md | `src/engines/workflow-engine.ts` |

### Phase 20 (8 units) — Sovereign Data
| Unit | File | Target |
|------|------|--------|
| 20.1 | 20.1-encryption-engine.md | `src/engines/encryption.ts` |
| 20.2 | 20.2-wal-mode-prisma.md | `src/storage/prisma.ts` |
| 20.3 | 20.3-export-engine.md | `src/engines/export.ts` |
| 20.4 | 20.4-airgap-engine.md | `src/engines/airgap.ts` |
| 20.5 | 20.5-local-model-integration.md | `src/engines/local-model-adapter.ts` |
| 20.6 | 20.6-sync-engine.md | `src/engines/sync.ts` |
| 20.7 | 20.7-telemetry-audit.md | `src/engines/telemetry-audit.ts` |
| 20.8 | 20.8-schema-sovereign-tables.md | `prisma/schema.prisma` |

---

## Upgrade Doc Location

All source docs are at:
```
docs/merged-design-v2/upgrade/
  upgrade-00-index.md          — Overview, doc map, cross-reference
  upgrade-01-objectives.md     — 7 objectives with vision, success criteria
  upgrade-02-architecture.md   — New engine designs with full TS interfaces
  upgrade-03-schema.md         — New Prisma models, modified models, migrations
  upgrade-04-engines.md        — Each engine: purpose, store contract, flow, errors, tests
  upgrade-05-memory-intelligence.md — Obj 1+3: 10-type memory, context assembly
  upgrade-06-muxing-routing.md     — Obj 2: multi-provider mux, routing
  upgrade-07-composable-interface.md — Obj 4+5: CLI, workflow, plugin, workspace
  upgrade-08-autonomous-execution.md — Obj 6: harness, DAG, HITL, observability
  upgrade-09-sovereign-data.md     — Obj 7: encryption, export, air-gap, sync
  upgrade-10-atomic-breakdown.md   — Phases 14-20, all 60 units
```
