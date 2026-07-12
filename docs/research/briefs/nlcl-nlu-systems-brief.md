# SOTA Deterministic NLU for Agentic Systems — Brief

**Source:** [full report](../reports/nlcl-nlu-systems-sota-2026.md)
**Confidence:** High | **Sources:** 24 | **Date:** 2026-07-12

## TL;DR

The SOTA for agentic NLU is a **five-layer pipeline**: Normalization → Regex → Fuzzy Match → Semantic Similarity → LLM Fallback. Snips NLU and Rasa DIET prove that deterministic-first with probabilistic fallback handles 95%+ of commands. The key missing pieces in vivim-final's NLCL are: (1) fuzzy matching for typo tolerance, (2) TF-IDF cosine for paraphrase detection, and (3) entity resolution for value normalization.

## Key Decisions

1. **Add a fuzzy matching layer** between regex and LLM fallback — Levenshtein/Jaro-Winkler for typo tolerance (<1ms latency)
2. **Add TF-IDF cosine similarity** as the "feels like AI" layer — paraphrase detection without ML training
3. **Use wink-nlp** for text preprocessing — 2M tokens/sec, TypeScript, zero dependencies, production-grade
4. **Implement hierarchical intent classification** for scaling beyond 100 intents (coarse → fine)
5. **Keep the existing HybridResolver pattern** — it's validated by every production system in 2026

## Evidence Summary

- **Snips NLU**: Two-phase (regex → CRF) handles 95%+ with zero AI. Deep learning showed "no significant gain" over CRFs ([Snips](https://medium.com/snips-ai/an-introduction-to-snips-nlu-the-open-source-library-behind-snips-embedded-voice-platform-b12b1a60a41a))
- **Rasa DIET**: Shared transformer for intent + entity, 6x faster than BERT, Co-existence Router for NLU/LLM per-turn ([Rasa](https://rasa.com/nlu))
- **Amazon REIC**: Hierarchical intent ontology + RAG retrieval achieves 8x cost reduction vs LLMs ([EMNLP 2025](https://arxiv.org/abs/2506.00210))
- **Vex Intent Classifier**: TypeScript hybrid (Levenshtein + TF-IDF cosine) running 100% client-side — direct reference architecture ([GitHub](https://github.com/cookieukw/vex-intent-classifier))
- **wink-nlp**: 2M tokens/sec, ~100% test coverage, zero deps, TypeScript — best-in-class for preprocessing ([winkjs.org](https://winkjs.org/wink-nlp))

## Open Questions

1. Should we add a lightweight ML classifier (NLP.js) between semantic similarity and LLM, or skip directly to LLM?
2. What's the right confidence threshold for each layer? (Research suggests 0.85 regex, 0.7 fuzzy, 0.6 semantic, 0.5 ML)
3. Do we need entity resolution (datetime normalization, etc.) for v1, or is Zod validation sufficient?
4. Should hierarchical intent classification be added now or deferred until >100 intents?

## Used In

- `src/engines/nlcl/intent-resolver.ts` — Current hybrid architecture to evolve
- `src/engines/nlcl/nl-parser.ts` — Deterministic parser to extend with fuzzy matching
- `src/engines/nlcl/types.ts` — Type contracts to extend
- ADR for NLCL evolution (when created)
