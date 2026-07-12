# Research Notes: SOTA Deterministic NLU for Agentic Systems

## Raw Observations

### Snips NLU (Most Important Reference)
- Deterministic parser uses regex — perfect on training examples, zero generalization
- Probabilistic parser: logistic regression (intent) + CRF (slots)
- They tried dozens of architectures including deep learning — CRF was sufficient
- Key insight: "there was no significant gain using deep learning versus CRFs for this task"
- Built-in entity resolution: datetime → ISO, numbers → normalized
- Forked as `intently-nlu` on PyPI (still active)

### Rasa DIET
- DIET = Dual Intent and Entity Transformer
- Shared transformer for both intent classification AND entity extraction
- CRF layer on top for entity sequence prediction
- Dot-product loss for intent label embedding space
- 6x faster to train than BERT, comparable accuracy
- 2026 addition: Co-existence Router (NLU vs LLM per-turn)

### Amazon REIC (EMNLP 2025)
- Hierarchical intent ontology: coarse → fine (each head < 50 intents)
- Dense vector index of (query, intent) pairs
- Cosine similarity retrieval → LLM probability calculation with constrained decoding
- 8x cost reduction vs proprietary LLMs
- Dynamic updates: just add pairs to index, no retraining

### Agentic Routing (2026)
- Four mechanisms: LLM, embedding, rule-based, ML classifier
- Confidence threshold routing is universal pattern
- C-A-F loop: Context → Action → Feedback → Context

### TypeScript NLP Libraries
- wink-nlp: 2M tokens/sec, zero deps, TypeScript, ~100% test coverage
- NLP.js: intent classification, entity extraction in JS
- Vex Intent Classifier: Levenshtein + TF-IDF cosine hybrid
- Transformers.js v4: WebGPU, runs in Node/Bun/Deno/browser

### Key Techniques
- Fuzzy matching (Levenshtein/Jaro-Winkler) for typo tolerance
- TF-IDF cosine for paraphrase detection
- Paraphrasing examples boosts accuracy 78%→86%
- Active learning with entropy sampling for continuous improvement
- Three-stage entity matching: TF-IDF → Jaro-Winkler → embeddings

## Gaps Identified for vivim-final

1. **No fuzzy matching** — typos immediately fall to LLM
2. **No semantic similarity** — only keyword scoring, no paraphrase detection
3. **No entity resolution** — Zod validation only, no value normalization
4. **Flat intent space** — no hierarchy for scaling
5. **Simple confidence scoring** — coverage + capture groups, no calibrated probabilities

## Open Questions

1. Should we add NLP.js as ML classifier layer, or skip to LLM?
2. What confidence thresholds for each layer? (0.85/0.7/0.6/0.5/0.4 suggested)
3. Entity resolution for v1 or defer?
4. Hierarchical classification now or when >100 intents?
