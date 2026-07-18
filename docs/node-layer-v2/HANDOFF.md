# Session Handoff — Universal Node-Layer v2

## Session: 2026-07-18
- Node-layer v2 fully implemented (see `docs/node-layer-v2/`).
- Skills updated: `vivim-build`, `vivim-testing`, `prisma-workflow`, `devops`, `AGENTS.md`.

## State

### What landed
1. **`src/schema/node.ts`** — ACU-proven fields on `NodeBase`, `NodeAcl` made partial
2. **`src/schema/node-data.ts`** — 8 Zod data shapes (Memory+FSRS-6, Acu, Note, Bookmark, Artifact, Document, Email)
3. **`src/schema/schemas.ts`** — All 8 registered as `cap-store.*` schemas
4. **`prisma/schema.prisma`** — `Node` extended with ACU columns + `NodeVersion` + `NodeAlias` + `NodeEdge.weight`
5. **`prisma/migrations/20260718041000_node_layer_v2/`** — Migration SQL recorded in `migration_log`
6. **`src/storage/contracts/node-store.ts`** — `updateNode`, `getNodeAtVersion`, `getNodeHistory`, `registerAlias`, `resolveAlias`, `rebuildGraphFromNodes`
7. **`src/storage/impl/node-store-impl.ts`** — Implementation of all new methods + version-1 on `putNode`
8. **`src/engines/conversation-manager.ts`** — Enriched `captureAsNode()` with ACU fields + fork linkage (assistant→user)
9. **`src/engines/memory-engine.ts`** — `recordMemory()` emits FSRS-6 memory Nodes
10. **`tests/unit/storage/impl/node-store-impl.test.ts`** — 6 tests (version chain, history, alias, rebuild, dedup)
11. **`docs/node-layer-v2/`** — README, schema docs, usage guide, migration guide
12. **Skills updated** — `vivim-build`, `vivim-testing`, `prisma-workflow`, `devops`, `AGENTS.md`

### Verification
- `bun run typecheck` — 0 errors on all changed files
- `bun test tests/unit/storage/impl/node-store-impl.test.ts` — 6/6 pass
- `registerAllSchemas()` runs without error
- Migration applied to `dev.db` + recorded

### Known pre-existing issues (not from this work)
- `invariants check` fails on A4 (truth-score 58% < 80%, needs roadmap truth scan) and B1 (`protocol-discovery.ts` imports `BunCdpClient`). Not related to Node layer.
- `devops gate` is the long-running autonomous loop (120s+ timeout). Use `bun run devops invariants check` for a bounded verification.

## Next Steps (future agent)

### Immediate follow-ups
1. Wire `MemoryEngine.recordMemory()` into conversation flow (call it after `captureAsNode` to emit memory nodes from message content)
2. Run `bun run devops truth verify` then re-run `bun run devops invariants check` to clear A4
3. Fix `protocol-discovery.ts` B1 violation (CDP direct import) — separate concern

### Medium-term
4. Implement `getNodeAtVersion` to reconstruct full NodeBase from NodeVersion contentRef (currently returns raw VersionRow, not reconstructed NodeBase)
5. Add content-hash dedup guard in `putNode` (skip insert if contentHash matches existing node)
6. Integrate `NodeStoreImpl` in more engines (knowledge-ingestion, bookmark capture, etc.)
7. Add FSRS-6 review scheduling engine driven by `dueDate` fields on memory Nodes

### File reference
- Full docs: `docs/node-layer-v2/`
- Contract: `src/storage/contracts/node-store.ts`
- Impl: `src/storage/impl/node-store-impl.ts`
- NodeBase: `src/schema/node.ts`
- Node data shapes: `src/schema/node-data.ts`
- Schema registry: `src/schema/schemas.ts`
- Capture: `src/engines/conversation-manager.ts` (L190 `captureAsNode`)
- Memory: `src/engines/memory-engine.ts` (L229 `recordMemory`)
- Tests: `tests/unit/storage/impl/node-store-impl.test.ts`
- Migration scripts: `scripts/_record_node_migration.ts`, `scripts/_record_node_layer_v2.ts`
