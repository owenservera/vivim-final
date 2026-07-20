# Retrieval + Thermodynamics (DCB packing helpers)

## Hybrid Retrieval (`retrieval.rs`)
Config defaults: semantic_weight=0.6, keyword_weight=0.4, rrf_k=60, max_results=20, similarity_threshold=0.35.

Pathway A — Semantic: cosine over 1536-dim embeddings. Tiered:
- T0 Hot: raw f32 cosine.
- T1 Warm: int8 quantized cosine (`cosine_similarity_int8`).
- T2 Cold: binary quantized Hamming → `1 - dist/total_bits`.
- T3 Archive: simhash-64 Hamming similarity.

Pathway B — Lexical: stopword-filter, tokenize, top-5 tokens weighted `1/(idx+1)` for substring match.

Fusion (RRF): `combined = sem_w*(1/(rank_sem+k)) + kw_w*(1/(rank_kw+k))`. Sort desc, truncate max_results.

Cache: SHA256(user+query+topic) key, 90s TTL, cleared every 100 writes (`record_write`).

## Thermodynamics (`thermodynamics.rs`, `cortex/mod.rs`)
Per section → `ContextState`:
```
relevance = ratio.min(1)                       // ratio = token_used / allocated
information_gain = relevance * (1 - min(token_cost/16000, 0.5))
mutual_information = relevance * (1 + info_gain).ln()
```
Optimizers: Boltzmann, greedy, spectral, RG. `optimize_context(states, token_budget)` → selected subset when pack_items over-budgets.

## Stopwords (lexical)
the a an and or but is are was were to of in for on with as at by from up about into over after
your my our their his her its it they them he she you me i we this that these those then there
what which who how why where when can will would should could have has had do does did
