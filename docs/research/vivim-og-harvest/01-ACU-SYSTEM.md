# ACU System — Detailed Spec (harvested from edge-pwa)

## Identity & provenance
- Every ACU is signed by the user's sovereign DID (`did:key:z...`, Ed25519).
- `bootstrap_sovereign_identity(db)`: generates Ed25519 seed from 2 UUIDs → SHA256 → pubkey → `derive_did_key`. Persists `User` + `Device` with `settings={theme:dark, localFirst:true, encryptOnWrite:true}`.
- `base58_encode` is zero-dep (alphabet `123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz`).

## "Conversations = ACU" rule
- Root ACU `type=conversation_root`, `conversationId` = the conversation id, `messageId` = null.
- Each message (user or assistant) is a child ACU: `parentId=root`, `messageId`, `messageIndex`.
- **High-value promotion**: internal scorer (`value_score`) per message and per sub-span promotes to typed child ACU:
  - `claim` (assistant assertion), `decision` (we decided / let's use), `code` (code block), `preference` (I prefer / always), `insight` (non-obvious), `fact` (note that / remember).
- **Lineage (deferred)**: when user lifts/remixes a span → new ACU with `parentId` + `lineageKind ∈ {remix, fork, quote, extract}`. Schema reserves fields now.

## Extraction pipeline (`taxonomy_migration.rs`)
1. `segment_markdown(text)` → DecomposedBlock[]:
   - Toggle on ```` ``` ```` → code block (lang captured) = 1 block.
   - Prose lines → text block.
   - Lines containing `|` → table block.
2. Each block → candidate ACU. Assign `type` by structural + keyword signal.
3. `contentHash` = SHA256(content) for dedup.
4. Link sequential ACUs within a turn (`AcuParent` / `AcuEdge relation=child_of`).
5. Global `run_global_taxonomy_migration` re-parses ALL messages → rebuilds ACU graph. Re-runnable: `extractorVersion`+`parserVersion` let a better lens replay.

## High-value targeting — scoring (to implement)
```
value_score(msg) =
   0.30 * structural_signal(msg)      // code/table/healthy length
 + 0.30 * intent_signal(msg)          // decision/commitment/preference/fact keywords
 + 0.25 * uniqueness(msg)             // 1 - max cosine to sibling ACUs in conv
 + 0.15 * source_signal(msg)          // assistant claim w/ user-confirm signal
promote if value_score >= acu.promote_threshold (default 0.6)
granularity = acu.granularity (message | sentence | block), default message
```
Config keys: `acu.promote_threshold`, `acu.granularity`, `acu.max_per_conv` (default 15), `acu.extractor` (heuristic|llm).

## ACU Link relations
- `child_of` — conversation_root → message ACU → sub-span ACU (tree).
- `same_as` — cos(contentHash/embed) > 0.92 AND same type.
- `supports` / `contradicts` — NLI-lite between claims.
- `responds_to` — assistant ACU → user ACU.
- `derives_from` — lineage (remix/fork/quote/extract).

## ACU graph in Cozo (`cozo_layer.rs` GRAPH_TREES includes `atomic_chat_units`, `acu_links`)
```
Acus { id => author_did, type, state, parent_id?, indexed_at }
AcuParent { child_id => parent_id }
AcuEdge { id => src, tgt, relation, weight }
```

## State machine
`active` → `superseded` (better version) → `tombstone` (erasure). Tier-1: removed from derived layers. Tier-2: destroyed + replica-grade re-key escalation (from CONFORMANCE.md S3).

## Tests to port (`tests/taxonomy_unit.rs`, `tests/dcb_kpi.rs`)
- ACU round-trip (put/get/scan/multi_get).
- Segment markdown → N blocks.
- Promote threshold boundary.
- Replay migration idempotency (re-run yields same graph).
