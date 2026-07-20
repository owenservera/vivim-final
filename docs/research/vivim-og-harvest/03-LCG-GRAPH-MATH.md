# LCG — Local Context Graph (network graph math)

## Purpose
The "complex network graph math" requirement. Clusters 20k conversations into projects, tracks entities across providers, maintains a warm snapshot for live DCB. All in Cozo Datalog + in-memory, embedded.

## Relations (Datalog, `lcg/schema.rs`)
```
Entity(id) => name, kind, canonical, first_seen, last_seen, mention_count, doc_freq, embedding:<F32;1536>
ConvEntity(conv_id, entity_id) => weight, raw_count, provider, account_id, conv_updated_at
Project(id) => name, status, confidence, is_user_confirmed, providers, created_at, updated_at,
               device_id, rev, updated_by, valid_from, superseded_at
ProjectMembership(project_id, conv_id) => score, method, added_at,
               device_id, rev, updated_by, valid_from, superseded_at
ConvMeta(id) => provider, account_id, title, updated_at, msg_count, centroid:<F32;1536>
EntityAlias(alias_id) => canonical_id
lcg_state(key) => value
```
HNSW index on Entity.embedding is DISABLED (linear cosine fallback); column kept for forward-compat.

## Project inference (`project_infer.rs`)
Constants:
```
MIN_SHARED_ENTITIES=2, SESSION_WINDOW_SECS=28800, LINK_THRESHOLD=0.35,
AUTO_PROJECT_THRESHOLD=0.55, W_ENTITY=0.5, W_TEMPORAL=0.3, W_EMBED=0.2,
SIGNATURE_TOP_K=5, SIGNATURE_JACCARD=0.5, CANDIDATE_HNSW_K=20, DORMANT_AFTER_DAYS=30
```
Steps:
1. `idf(e) = ln(N/df) + 1`.
2. salience_vector(conv) = { entity : weight*idf }.
3. candidates = top-K(20) centroid-similar conv pairs.
4. link(c1,c2) = W_ENTITY*entity_overlap + W_TEMPORAL*temporal_prox + W_EMBED*centroid_cosine.
5. edges where link ≥ 0.35.
6. union_find_clusters(convs, edges, 0.55) → project clusters.
7. match_project_by_signature (Jaccard ≥ 0.5 on top-5 salient entities) → existing or new.
8. write ProjectMembership(method ∈ EntityOverlap|Temporal|Hybrid|User).
9. status: user_confirmed→Active; any conv >30d old→Dormant; conf≥0.55→Active; else Candidate.
10. cross_provider count (≥2 providers).

## Entity extraction (`entity.rs`)
- `derive_entity_id(canonical) = "ent:" + sha256(canonical)[0..8]`.
- `tech_dictionary()` static HashSet (rust, react, cozo, redb, postgresql, docker, k8s…).
- `extract(text)` → Mention[]{canonical, surface, kind, raw_count}.
- `MAX_ENTITIES_PER_CONV=15` (config `ingest.max_entities_per_conv`).

## Embeddings (`retrieval.rs`)
`embed_text`: word-hash → 1536 position buckets (count), L2-normalize. Deterministic, model-free. Swap later.

## Snapshot (`LcgSnapshot`)
```
version, built_at, idf_total_conversations,
identity_blob, prefs_blob,
active_projects: ProjectSummary[]{ project, rolling_summary, recent_convs, top_entities:(id,name)[], decisions[] },
hot_threads: ThreadDigest[]{ conv_id, provider, account_id, title, updated_at, last_user_excerpt, project_id },
entity_idf: Map<entityId, f64>
```
Rebuild: debounced 30s (`MAINTENANCE_DEBOUNCE_SECS`). Bumps `version` in `lcg_state`.

## Ingest → rebuild → live DCB
`ingest_conversation`:
- entity extraction + `assign_conversation` (cluster) + `schedule_rebuild`.
- `extract_tracking` (Phase 4 tasks/deadlines, heuristic, config-gated `tracking.enabled`).
- `distill_facts` (Phase 5 identity/prefs blobs, config-gated `facts.enabled`).
- `recompose_cards()`.
Snapshot version bump → cards recompute freshness; next compose reads new snapshot.

## Scale at 20k
- Debounce prevents rebuild storm.
- 15 entities/conv cap + linear cosine = cheap writes.
- Compose reads only warm snapshot (O(active_projects+hot_threads)), independent of 20k total.
- Cooperative cancel (`AtomicBool` + pause RPC) halts rebuild at safe checkpoints.
