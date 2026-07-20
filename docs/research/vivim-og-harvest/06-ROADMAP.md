# Implementation Roadmap — vivim-final ACU + DCB + Cozo

## Phase 0 — Storage foundation
- [x] Add `cozo-node` dep; verify WASM checklist: <F32;1536>, file-backed sqlite, param binding, 17 relations. ✅ 2025-07-18
- [ ] Write `storage/cozo/cozo-layer.ts` (open/init_schema/run_script/project, fail-open).
- [ ] Port LCG + graph DDL (doc 05).
- [ ] Prisma: extend `Node` with `acuType, lineageKind, extractorVersion, parserVersion, valueScore, isHighValue` (doc 00 §9).
- [ ] ADR: SQLite=source of truth, Cozo=rebuildable projection (port ADR-001).

## Phase 1 — ACU core
- [ ] `engines/acu-engine.ts`: `segment_markdown`, `derive_entity_id`.
- [ ] "Conversations = ACU": on conversation create → root ACU; on message save → child ACU.

## Phase 2 — High-value targeting
- [ ] `value_score` heuristic (doc 01): structural + intent + uniqueness + source.
- [ ] Promotion to typed child ACUs (claim/decision/code/preference/insight/fact).
- [ ] Config: `acu.promote_threshold` (0.6), `acu.granularity` (message), `acu.max_per_conv` (15).
- [ ] ACU link graph (child_of / same_as / supports / contradicts / responds_to).

## Phase 3 — LCG engine
- [ ] `engines/lcg-engine.ts`: `ingest_conversation`, `extract` (entity NER + tech dict), `infer_projects` (union-find, link weights, signature match).
- [ ] `rebuild_snapshot` → `LcgSnapshot` (in-memory, debounced 30s, version bump).
- [ ] Distill identity/prefs blobs (Phase 5, config-gated).

## Phase 4 — Context engine + DCB
- [ ] `engines/context-engine.ts`: `compose`, `compose_for_moment`, `ingest` channel (async).
- [ ] `engines/dcb/composer.ts`: L0–L7 builders + `pack_items` + `recency_decay`.
- [ ] `engines/dcb/budget.ts`: DepthMode, layer configs, allocate.
- [ ] `engines/dcb/cards.ts`: BundleCard, recompose on version bump, freshness.
- [ ] `engines/dcb/feeder.ts`: background feed + cooperative pause.
- [ ] `engines/dcb/projector.ts`: inject-prompt projection + release policy.

## Phase 5 — Retrieval + thermo
- [ ] `engines/retrieval.ts`: hybrid semantic+lexical + RRF, tiered memory, cache.
- [ ] `engines/thermodynamics.ts`: ContextState optimizer (Boltzmann/greedy/spectral).

## Phase 6 — Live sync wiring (20k requirement)
- [ ] Capture/sync write → SQLite → project to Cozo → `enqueue_ingest` → LCG ingest → snapshot bump → cards recompose.
- [ ] Load test at 20k conversations: measure `infer_projects` + compose latency.
- [ ] Cooperative cancel for long rebuilds.

## Phase 7 — P2P live workspaces (deferred-ish, schema now)
- [ ] Add `device_id`, `rev`, `valid_from`, `superseded_at`, `updated_by` to relations (done in Phase 0 schema).
- [ ] CRDT merge of Cozo deltas over libp2p/Yjs (transport layer, later).

## Lineage system — DEFERRED
- Schema fields reserved (`parentId`, `lineageKind`). Full remix/fork graph + conflict resolution designed later.

## Acceptance criteria
- Compose <1s at 20k convs.
- Live sync reflected in DCB within debounce window (<30s).
- ACU graph rebuildable from SQLite with zero data loss.
- High-value ACUs promoted from individual messages with `valueScore` recorded.
- All tests from OG ported (`taxonomy_unit`, `dcb_kpi`, LCG snapshot tests).
