# vivim-final — ACU + DCB + Cozo Architecture Plan (Harvested from edge-pwa OG)

**Status**: Build mode — research/planning docs (no code yet)
**Source**: `C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\edge-pwa` (Rust + redb + Cozo + tokio backend)
**Target stack**: Bun + Prisma/SQLite (records) + **Cozo WASM** (graph + vectors) + in-memory snapshot (warm view)

---

## 0. Decisions (from user)

1. **Keep SQLite/Prisma for records. Add Cozo as a second embedded store for graph + vectors.**
2. **Scale**: ~20k conversations average. ALL conversations live-synced to DB → network graph updates LIVE, DCB context bundles update LIVE.
3. **Full spec plan**: harvest OG algorithms, ACU and DCB designs.
4. **Core concept introduced**:
   - **Conversations = ACU** by default (1 conversation → 1 root ACU).
   - Unless the user remixes / touches parts of a conversation for other purposes → lineage system (designed LATER).
   - Internal vivim system identifies **high-value targets** within a conversation and flags / generates ACUs from it (can go down to individual messages from user OR provider/assistant).

---

## 1. Storage Architecture (3-tier, all embedded, zero servers)

| Tier | Engine | Holds | Why |
|------|--------|------|-----|
| Primary records | **SQLite (Prisma)** | conversations, messages, accounts, tokens, ACU nodes, ACU links, memories, identity/prefs blobs | Matches vivim-final existing `Node` layer; ACU-proven fields already present |
| Graph + vectors | **Cozo (WASM build)** | LCG: `Entity`, `ConvEntity`, `Project`, `ConvMeta` with `<F32;1536>` embeddings; `AcuGraph` relations | Real graph queries + 1536-dim vector math, embedded, no server |
| Warm view | **In-memory snapshot** | precomputed IDF, active projects, hot threads, identity/prefs blobs, version counter | Sub-second DCB composition (no DB query at compose time) |

**Critical invariant (from OG ADR-001)**: SQLite is single source of truth. Cozo is a **rebuildable projection/index** — writes go to SQLite first, then projected into Cozo. Cozo can be wiped and rebuilt from SQLite without data loss. Fail-open: Cozo errors are logged, never propagated.

**Why NOT Postgres** (answered): OG reference implements graph math (Cozo Datalog), file tracking (KV + contentHash), and live context generation (ContextEngine over warm snapshot) with zero servers. Postgres would force a server process onto every peer machine and break the single-user-local + P2P model.

---

## 2. ACU (Atomic Chat Unit) — the knowledge primitive

### 2.1 Concept
Smallest independently-meaningful knowledge piece (claim / decision / code idea / preference / insight). Individually addressable, content-fingerprinted, versioned, signed, full provenance.

### 2.2 "Conversations = ACU" rule (NEW for vivim-final)
- **Default**: Each conversation is a root ACU (`type=conversation_root`). The conversation's messages are child ACUs under it.
- **High-value targeting**: vivim internal system scores each message (user OR assistant) and sub-spans within a message. When a span crosses an importance threshold it is flagged and promoted to a child ACU (`type` ∈ {claim, decision, code, preference, insight, fact}).
- **Lineage**: When the user remixes / lifts a part of a conversation for another purpose, the derived ACU carries a `parent_id` + `lineage_kind` (remix/fork/quote/extract). Full lineage spec deferred — schema MUST reserve `parent_id`, `version`, `lineage_kind`, `author_did`, `signature` now so later lineage is additive.

### 2.3 ACU data model (ported from OG `schema_models.rs:85`)
```rust
struct AtomicChatUnit {
  id: String,
  authorDid: String,
  signature: Vec<u8>,
  content: String,
  contentHash: Option<String>,
  version: i32,
  type: String,            // conversation_root | claim | decision | code | preference | insight | fact
  category: String,
  origin: String,
  conversationId: Option<String>,
  messageId: Option<String>,
  messageIndex: Option<i32>,
  provider: Option<String>,
  model: Option<String>,
  sourceTimestamp: Option<String>,
  parentId: Option<String>,       // lineage anchor
  extractorVersion: Option<String>,
  parserVersion: Option<String>,
  state: String,                  // active | superseded | tombstone
  securityLevel: i32,
  isPersonal: bool,
  level: i32,
  contentType: String,
  qualityOverall: Option<f64>,
  contentRichness: Option<f64>,
  structuralIntegrity: Option<f64>,
  uniqueness: Option<f64>,
  viewCount: i32, shareCount: i32, quoteCount: i32,
  rediscoveryScore: Option<f64>,
  sharingPolicy: String, sharingCircles: Vec<String>,
  canView/Annotate/Remix/Reshare: bool,
  expiresAt: Option<String>,
  createdAt, indexedAt: String,
  metadata: Json, tags: Vec<String>,
}
```
Maps 1:1 onto vivim-final `Node` ACU-proven fields (`contentHash`, `version`, `state`, `securityLevel`, `authorDid`, `signature`, `acl`, `quality`).

### 2.4 ACU Link (graph edge)
```rust
struct AcuLink {
  id, sourceId, targetId, relation: String, weight: f64,
  createdByDid: Option<String>, createdAt, metadata: Json
}
```
Relation vocabulary: `same_as` (cos>0.92 + same type), `supports` / `contradicts` (NLI-lite), `responds_to`, `derives_from` (lineage), `child_of` (conversation→message ACU tree).

### 2.5 ACU extraction (harvested `taxonomy_migration.rs`)
- `segment_markdown(text)` → DecomposedBlock[] (code block vs prose vs table). Code block = 1 ACU candidate.
- `derive_did_key(pubkey)` → W3C `did:key:z...` via Ed25519 multicodec + base58btc (zero-dep impl in OG `base58_encode`).
- `bootstrap_sovereign_identity` → Ed25519 user/device, persisted with `encryptOnWrite`, `localFirst` settings.
- Identity is bootstrapped once; ACUs are signed with the user DID. Extraction is **re-runnable**: `extractorVersion` + `parserVersion` on every ACU means a better lens can replay the whole corpus.

### 2.6 High-value targeting — scoring heuristic (to implement in vivim-final)
For each message (user or assistant) compute a `value_score`:
- structural: code block present (+), table present (+), length in healthy band
- signal keywords: decision ("we decided", "let's use"), commitment ("I will", "todo"), preference ("I prefer", "always"), fact ("note that", "remember")
- uniqueness: low cosine to existing ACUs in same conversation
- source: assistant claim with user confirmation signal ranks higher
Promote when `value_score ≥ threshold` (config `acu.promote_threshold`, default ~0.6). Span granularity configurable (`acu.granularity` ∈ {message, sentence, block}).

---

## 3. Dynamic Context Bundles (DCB) — live context engine

### 3.1 Concept
A DCB is a **layered, token-budgeted context object** assembled on demand (or pre-warmed) from the warm LCG snapshot. It is what gets injected into the prompt for the LLM.

### 3.2 Data model (`cortex/dcb/mod.rs`)
```rust
struct DynamicContextBundle {
  id: BundleId,                 // dcb:<profile>:<ts>
  profile: DcbProfile,
  scenario: Option<ScenarioId>,
  project_id: Option<ProjectId>,
  layers: Vec<LayerItem>,
  total_tokens: usize, budget: usize,
  model_target: Option<String>,
  created_at: String,
}

struct LayerItem {
  layer: LayerType,
  text: String,
  provenance: Provenance { source, conv_id, provider, account_id, timestamp, label },
  confidence: f64,
  recency_secs: u64,
  token_cost: usize,
  included: bool,
  blocks: Vec<ContentBlock>,   // Text | Image | Code | Reference (additive)
}

enum DcbProfile { Seed, Reunion, Convergence, Continuum, Handoff, Probe, DeepResearch, DecisionBrief }
```

### 3.3 8 Profiles → layer mixes
| Profile | DepthMode | Active layers |
|---------|-----------|---------------|
| Seed | Compact | L0 Identity, L7 Query |
| Reunion | Standard | + L4 Conversation (where we left off) |
| Convergence | Deep | + L2 Topic, L3 Entity, Lp Project |
| Continuum | Standard | + L5 JIT context |
| Handoff | Standard | + Lp Project, Ld Decisions |
| Probe | Standard | L0, L2, L7 |
| DeepResearch | Deep | All layers, max entities |
| DecisionBrief | Standard | L0, Ld Decisions, Lp Project |

### 3.4 L0–L7 Layer taxonomy (from `composer.rs`)
- **L0 Identity** — `identity_blob` (who the user is). ALWAYS included.
- **L1 GlobalPrefs** — `prefs_blob` (tone/format).
- **L2 Topic** — top topic entities by IDF (truncate 10).
- **L3 Entity** — project top entities by IDF (truncate 15).
- **Lp ProjectState** — rolling project summary across providers.
- **Ld Decisions** — decisions reached in project.
- **L4 Conversation** — "where we left off" excerpt (200 chars).
- **L5 JITContext** — nearby relevant threads (truncate 5, sorted by recency).
- **L6 RecentHistory** — deeper recent excerpt (500 chars).
- **L7 UserQuery** — the draft text. ALWAYS included.

### 3.5 Composition algorithm (harvested `composer.rs` + `budget.rs`)
1. Read warm `LcgSnapshot` (no DB hit).
2. `resolve_topic_entities` (from active conv project, else NER on draft).
3. `resolve_project` (from active conv).
4. For each active layer in profile → build `LayerItem`s with `confidence` + `recency_secs`.
5. Convert to `PackItem{ layer, score = confidence * recency_decay(secs), tokens }`.
6. `budget::pack_items(items, budget, depth)` → included set. L0 & L7 always forced-included.
7. Sum `included` token costs → `total_tokens ≤ budget`.
8. `recency_decay(secs) = exp(-secs / (7*86400))` (7-day half-life).

Compose is **synchronous, <1s** (OG warns if >1s — PRD E1 latency budget).

### 3.6 Freshness (from `dcb/mod.rs`)
- `Live` — composed within 60s.
- `Fresh` — composed against current snapshot version.
- `Stale` — snapshot advanced since compose.
Cards replay recomposition when snapshot bumps (see §5).

---

## 4. LCG — Local Context Graph (the "network graph math")

### 4.1 Schema (harvested `cortex/lcg/schema.rs`, Datalog)
```
Entity { id => name, kind, canonical, first_seen, last_seen, mention_count, doc_freq, embedding: <F32;1536> }
ConvEntity { conv_id, entity_id => weight, raw_count, provider, account_id, conv_updated_at }
Project { id => name, status, confidence, is_user_confirmed, providers, created_at, updated_at,
           device_id, rev, updated_by, valid_from, superseded_at }   // M14.2/M14.3 sync+temporal
ProjectMembership { project_id, conv_id => score, method, added_at, device_id, rev, updated_by, valid_from, superseded_at }
ConvMeta { id => provider, account_id, title, updated_at, msg_count, centroid: <F32;1536> }
EntityAlias { alias_id => canonical_id, ... }                         // entity resolution
lcg_state { key => value }                                            // version, idf_n, device_id, next_rev, identity_blob, prefs_blob
```
**Note (OG)**: HNSW index on `Entity.embedding` is **intentionally disabled** — vector_search falls back to linear cosine scan; the 1536-dim column is stored for forward-compat. Dominant feed cost was HNSW insert per entity.

### 4.2 Constants (harvested `project_infer.rs:7`)
```
MIN_SHARED_ENTITIES = 2
SESSION_WINDOW_SECS = 8*3600
LINK_THRESHOLD = 0.35
AUTO_PROJECT_THRESHOLD = 0.55
W_ENTITY = 0.5, W_TEMPORAL = 0.3, W_EMBED = 0.2
SIGNATURE_TOP_K = 5, SIGNATURE_JACCARD = 0.5
CANDIDATE_HNSW_K = 20
DORMANT_AFTER_DAYS = 30
EMBED_DIM = 1536, HNSW_M = 16, HNSW_EF_CONSTRUCTION = 200
```

### 4.3 Project inference algorithm (`infer_projects`)
1. Load entity doc-freqs, conv infos (with centroids), conv→entity links.
2. Build `idf_map`: `idf(e) = ln(N/df) + 1`.
3. Per-conv **salience vector** = weighted entity vector (weight × idf).
4. `generate_candidates` via HNSW/centroid similarity (top-K=20).
5. For each candidate pair compute `link_weight`:
   `link = W_ENTITY*entity_overlap + W_TEMPORAL*temporal_proximity + W_EMBED*centroid_cosine`
6. Keep edges where `link ≥ LINK_THRESHOLD`.
7. `union_find_clusters(convs, edges, AUTO_PROJECT_THRESHOLD)` → clusters = projects.
8. `match_project_by_signature` (Jaccard ≥ 0.5 on top-K salient entities) merges into existing project or creates new.
9. Write `ProjectMembership` (method ∈ EntityOverlap/Temporal/Hybrid/User).
10. Status: user_confirmed→Active; any conv older than 30d→Dormant; confidence≥0.55→Active; else Candidate.
11. Cross-provider project counter (≥2 providers).

### 4.4 Entity extraction (`entity.rs`)
- `derive_entity_id(canonical)` = `ent:<sha256(canonical)[0..8]>`.
- `tech_dictionary()` — static HashSet of known tech tokens (rust, react, cozo, redb, postgresql…) for zero-dep NER.
- `extract(text)` — surface forms + canonical + kind + raw_count.
- `MAX_ENTITIES_PER_CONV = 15` (bounds graph write cost; configurable `ingest.max_entities_per_conv`).

### 4.5 Embeddings (`retrieval.rs:embed_text`)
Deterministic 1536-dim hashing embedder (word-hash → position bucket, L2-normalized). OG default; swap for a real model later. **Stored for forward-compat.**

### 4.6 Snapshot (`LcgSnapshot`, `rebuild_snapshot`)
In-memory warm view rebuilt from Cozo state:
```
version: u64, built_at, idf_total_conversations,
identity_blob, prefs_blob,
active_projects: Vec<ProjectSummary{ project, rolling_summary, recent_convs, top_entities, decisions }>,
hot_threads: Vec<ThreadDigest{ conv_id, provider, account_id, title, updated_at, last_user_excerpt, project_id }>,
entity_idf: HashMap<EntityId, f64>
```
Debounced rebuild (`MAINTENANCE_DEBOUNCE_SECS = 30`). Version bumped each rebuild → drives DCB freshness + card recomposition.

---

## 5. Live Sync → Live Graph → Live DCB (the 20k requirement)

**Flow** (harvested `cortex/mod.rs` ContextEngine + `main.rs`):
1. Capture/sync writes a conversation+message to **SQLite** (single source of truth).
2. Projection hook writes same record into **Cozo** (graph trees).
3. `ContextEngine.ingest_conversation(conv_id, …)` is called (async, via tokio mpsc channel `ingest_tx`):
   - `lcg.ingest_conversation` → entity extraction + `assign_conversation` (cluster) → `schedule_rebuild` (debounced).
   - `extract_tracking` (Phase 4: tasks/deadlines) — heuristic, config-gated.
   - `distill_facts` (Phase 5: identity/prefs blobs) — config-gated.
   - `recompose_cards()` → DCB deck reflects new data.
4. Snapshot rebuild bumps `version` → all live DCB cards recompute freshness.
5. Next `compose_for_moment` reads the new warm snapshot → **DCB reflects the just-synced conversation in <1s**.

**Scale handling for 20k convos**:
- Debounced snapshot rebuild (30s) prevents thrash on burst ingest.
- Entity ingest capped at 15/conv; linear cosine fallback (no HNSW) keeps writes cheap.
- In-memory snapshot is the only thing compose reads → O(active_projects + hot_threads), independent of 20k total.
- Cooperative cancellation (`AtomicBool` + `*.pause` RPC) lets a long rebuild halt at safe checkpoints (between convs).

---

## 6. P2P / Multi-device (from user: connect to other local users for live workspaces)

Harvested from LCG schema v2 columns:
- `device_id` — stable per device (generated once, persisted in `lcg_state`).
- `rev` — monotonic revision counter (`next_rev()`).
- `valid_from` / `superseded_at` — temporal validity; superseded rows retained for history, active reads filter `superseded_at == ""`.
- `updated_by` — origin device of last write.
Sync = exchange Cozo relation deltas keyed by `(rev, device_id)`; CRDT-merge via `superseded_at` + `rev` precedence. **No server**: libp2p / Yjs over the Node/ACU layer (transport concern, not engine).

---

## 7. Retrieval (hybrid, for DCB L2/L3 + memory)
Harvested `retrieval.rs`:
- Dual-path: **semantic** (cosine over 1536-dim) + **lexical** (stopword-filtered token overlap, top-5 weighting `1/(idx+1)`).
- **Reciprocal Rank Fusion (RRF)**: `score = sem_w*(1/(rank_sem+k)) + kw_w*(1/(rank_kw+k))`, k=60, sem_w=0.6, kw_w=0.4.
- Tiered memory (T0 hot raw / T1 int8 / T2 binary / T3 simhash archive) — quantization by access tier.
- Cache with SHA256 key, 90s TTL, invalidated every 100 writes.

---

## 8. Thermodynamics optimizer (advanced DCB packing)
Harvested `cortex/mod.rs` + `thermodynamics.rs`:
Each section → `ContextState{ layer_id, token_cost, information_gain, relevance_score, mutual_information }`.
`info_gain = relevance * (1 - min(token_cost/16000, 0.5))`.
Optimizers: Boltzmann, greedy, spectral, RG (renormalization group). `optimize_context(states, token_budget)` returns selected subset. Used post-pack for final pruning when over budget.

---

## 9. File/Module plan for vivim-final (Bun/TS port)

```
src/
  storage/
    contracts/node-store.ts        # existing — extend ACU fields
    cozo/                          # NEW: Cozo WASM bindings
      cozo-layer.ts                # open(path|":memory:"), run_script, init_schema
      schema.ts                    # LCG DDL statements (ported from lcg/schema.rs)
      project_lcg.ts               # Entity/ConvEntity/Project/ConvMeta relations
      acu_graph.ts                 # AcuGraph relations (Acus, AcuParent, AcuEdge)
  engines/
    acu-engine.ts                  # extraction: segment_markdown, derive_did_key, bootstrap_identity,
                                    #   high-value targeting + promotion, lineage anchors
    lcg-engine.ts                  # ingest_conversation, infer_projects (union-find), snapshot rebuild
    context-engine.ts             # ContextEngine: compose, compose_for_moment, cards, ingest channel
    dcb/
      composer.ts                  # L0–L7 layer builders + PackItem + recency_decay
      budget.ts                    # pack_items, DepthMode, default_layer_configs, allocate
      profile.ts                   # active_layers(profile)
      cards.ts                     # BundleCard, CardConfig, recompose, freshness
      projector.ts                 # project(dcb, Surface::InjectPrompt)
      feeder.ts                    # background feed w/ cooperative cancel
    retrieval.ts                   # hybrid semantic+lexical + RRF, tiered memory
    thermodynamics.ts             # ContextState optimizer (Boltzmann/greedy/spectral)
  identity/
    sovereign.ts                   # Ed25519 DID bootstrap, sign/verify ACUs
prisma/
  schema.prisma                    # extend Node/NodeEdge with ACU lineage fields
seeds/                             # identity bootstrap seed
```

### Prisma additions (Node model)
```
model Node {
  ... existing ACU fields ...
  lineageKind   String?   // remix | fork | quote | extract (lineage system, later)
  extractorVersion String?
  parserVersion    String?
  valueScore       Float?  // high-value targeting score
  isHighValue      Boolean @default(false)
  acuType          String?  // conversation_root | claim | decision | code | preference | insight | fact
}
```

---

## 10. Open questions / deferred
- **Lineage system**: full remix/fork graph + conflict resolution — schema reserves fields, logic deferred.
- **Embedding model**: OG uses deterministic hash embedder; swap for real model (bge/local) when quality needs it. 1536-dim kept for compat.
- **Cozo WASM maturity**: verify Cozo JS/WASM build supports Datalog + `<F32;1536>` relations + file-backed persistence on Bun. Fallback: keep graph math in TS over SQLite if WASM insufficient.
- **20k rebuild cost**: measure `infer_projects` wall-time at 20k; if >30s, move to incremental per-conv assign only (skip full union-find on every rebuild).
- **Real LLM extraction**: high-value targeting is heuristic-only first; LLM bridge added later (config `acu.extractor = heuristic|llm`).

---

## 11. Reference file map (OG → vivim-final)
| OG file | vivim-final port |
|---------|------------------|
| `backend/src/schema_models.rs:85` | `prisma/schema.prisma` Node ACU fields |
| `backend/src/registry/acu.rs` | `engines/acu-engine.ts` RPC handlers |
| `backend/src/taxonomy_migration.rs` | `engines/acu-engine.ts` extraction + identity |
| `backend/src/cortex/dcb/mod.rs` | `engines/context-engine.ts` |
| `backend/src/cortex/dcb/composer.rs` | `engines/dcb/composer.ts` |
| `backend/src/cortex/dcb/cards.rs` | `engines/dcb/cards.ts` |
| `backend/src/cortex/lcg/mod.rs` | `engines/lcg-engine.ts` |
| `backend/src/cortex/lcg/project_infer.rs` | `engines/lcg-engine.ts#infer` |
| `backend/src/cortex/lcg/entity.rs` | `engines/acu-engine.ts#extract` |
| `backend/src/cortex/retrieval.rs` | `engines/retrieval.ts` |
| `backend/src/cortex/mod.rs` | `engines/context-engine.ts` orchestrator |
| `backend/src/cozo_layer.rs` | `storage/cozo/cozo-layer.ts` |
| `docs/decisions/ADR-001-reDB-over-SQLite.md` | adopt as ADR: SQLite=source of truth, Cozo=projection |
