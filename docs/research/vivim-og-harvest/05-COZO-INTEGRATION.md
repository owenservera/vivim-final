# Cozo Integration Plan for vivim-final (Bun/TypeScript)

## Why Cozo (not Postgres, not sqlite-vec)
OG uses **Cozo** (embedded Datalog graph DB) for the LCG: real graph queries (union-find clusters, multi-hop entity traversal) + 1536-dim vector columns + file-backed persistence — all with **no server**. This is the closest match to vivim-final's local-first + P2P requirement.

## Binding options
1. **Cozo WASM/JS build** (`cozo` npm) — runs Datalog `run_script` in-process. Verify:
   - `<F32;1536>` relation column support.
   - File-backed `:memory:` vs path open on Bun.
   - `init_schema` idempotency (`:create` already-exists tolerated).
2. Fallback: if WASM insufficient, implement graph math in TS over SQLite (union-find + cosine in JS). Cozo preferred.

## CozoLayer port (`storage/cozo/cozo-layer.ts`)
Mirror OG `cozo_layer.rs`:
- `open(path)` → `new_cozo_sqlite(path)` (or WASM equiv).
- `run_script(stmt, params, mutable)`.
- `init_schema()` → runs COZO_SCHEMA_STMTS + LCG_SCHEMA_STMTS, skip "already exists".
- `project(tree, key, value)` → write into graph relations AFTER SQLite commit.
- Fail-open: catch Cozo errors, log, never throw to caller.

## Projection contract (ADR-001 port)
- SQLite = single source of truth (Prisma `Node`/`NodeEdge`).
- Cozo = rebuildable index. `GRAPH_TREES = [atomic_chat_units, acu_links, conversations, memories, memory_relationships, capability_vault, provider_accounts]`.
- Wipe+rebuild Cozo from SQLite at any time = no data loss.

## Schema DDL to port (`lcg/schema.rs` + `cozo_layer.rs`)
Core graph:
```
:create Account { id => provider_id, email }
:create Conversation { id => account_id, provider, state, updated_at }
:create Acus { id => author_did, type, state, parent_id?, indexed_at }
:create CapEntry { id => provider_id, name, version, status, confidence }
:create Memory { id => account_id, memory_type, importance, is_active }
:create AccountHasConv { account_id, conv_id }
:create AcuParent { child_id => parent_id }
:create AcuEdge { id => src, tgt, relation, weight }
:create CapEdge { id => src, tgt, relationship }
:create MemRel { id => src, tgt, rel_type, strength }
```
LCG:
```
:create Entity { id => name, kind, canonical, first_seen, last_seen, mention_count, doc_freq, embedding:<F32;1536> }
:create ConvEntity { conv_id, entity_id => weight, raw_count, provider, account_id, conv_updated_at }
:create Project { id => name, status, confidence, is_user_confirmed, providers, created_at, updated_at, device_id, rev, updated_by, valid_from, superseded_at }
:create ProjectMembership { project_id, conv_id => score, method, added_at, device_id, rev, updated_by, valid_from, superseded_at }
:create ConvMeta { id => provider, account_id, title, updated_at, msg_count, centroid:<F32;1536> }
:create EntityAlias { alias_id => canonical_id }
:create lcg_state { key => value }
```

## WASM verification TODO (before code)
- [x] `cozo-node@0.7.6` resolves + loads on Bun (Windows x86_64). Package: `cozo-node` (not `cozo`).
- [x] `:create Entity` with `<F32;1536>` works. Verified: create, insert, read back 1536-dim vectors.
- [x] File path open persists across restarts. Verified: close + reopen with sqlite engine.
- [x] Param binding works with JS arrays → `DataValue::List` → coerced to `<F32;N>`. Verified for 1536-dim.
- [ ] Benchmark `infer_projects` at 20k convs (target <30s; else incremental assign-only). Deferred to Phase 6.

### Notes
- Package name is `cozo-node` (not `cozo`). Native binary auto-downloaded via `node-pre-gyp`.
- API: `new CozoDb("sqlite", path, {})` — engine is first arg, path second.
- Script method is `db.run(script, params)` (not `run_script`).
- `<F32;N>` vector columns require at least one non-vector value column alongside key.
- Params use `$name` syntax in CozoScript, passed as `{ name: value }` JS object.
- `:create` (single colon) is correct — `::create` (double colon) does not work in 0.7.6.
