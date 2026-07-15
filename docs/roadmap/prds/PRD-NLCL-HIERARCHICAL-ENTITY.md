# PRD: NLCL Hierarchical Intent + Entity Resolution

**Status:** READY FOR AGENT
**Date:** 2026-07-13
**Author:** opencode (research review)
**Labels:** `ready-for-agent`, `research-proposal`, `nlcl`, `phase-3`
**Source brief:** `docs/research/briefs/nlcl-nlu-systems-brief.md` (High confidence, 24 sources)
**Maps to units:** 3.1–3.4 (IntentDecomposer, `[~]`) — related but distinct

---

## Problem Statement

The 5-layer NLU pipeline from the brief is **already implemented** and validated:

- `src/engines/nlcl/fuzzy-matcher.ts` — Levenshtein + Jaro-Winkler
- `src/engines/nlcl/tfidf.ts` + `semantic-resolver.ts` — TF-IDF cosine
- `src/engines/nlcl/layered-resolver.ts` — deterministic → fuzzy → semantic → llm gatechain
- `src/engines/nlcl/text-normalizer.ts` — custom zero-dep normalizer (deliberate `wink-nlp` swap, documented)

Two brief recommendations remain **unimplemented**:

1. **Hierarchical intent classification** (coarse domain → fine action) for scaling past 100 intents.
   The current `layered-resolver.ts` is flat; `src/engines/nlcl/intent-resolver.ts` has no coarse→fine routing.
2. **Entity resolution / value normalization** — datetime, number, enum normalization before param
   extraction. `src/engines/nlcl/entity-resolution.ts` exists as a hook but is not wired into the
   layered pipeline; `types.ts` only carries `fuzzyThreshold` (0.7), no entity/normalization config.

## Solution

### A. Hierarchical classifier (`src/engines/nlcl/hierarchical-resolver.ts`)

Coarse pass buckets input into a domain (e.g. `conversation`, `provider`, `file`, `browser`) using
cheap TF-IDF/keyword routing; fine pass runs the existing layered resolver **scoped to that domain's**
pattern set. This both speeds resolution and scales past 100 intents.

```typescript
interface HierarchicalResolverOpts {
  coarseThreshold?: number   // default 0.5
  domains: Record<string, IntentPattern[]>
}
```

### B. Entity resolution layer (`src/engines/nlcl/entity-resolution.ts`)

Add a normalization stage invoked **after** intent match, before param extraction:

- datetime ("tomorrow 9am" → ISO), numbers ("five" → 5), enums (synonyms → canonical).
- Pluggable resolvers registered per entity type; Zod schemas remain the validation backstop.

Wire both into `layered-resolver.ts` so the pipeline becomes:
`normalize → hierarchical-coarse → deterministic → fuzzy → semantic → llm → entity-resolution → params`.

## Implementation Plan

1. Implement `hierarchical-resolver.ts`; register domain→pattern partitions from `catalog.ts`.
2. Complete `entity-resolution.ts` with datetime/number/enum normalizers; export a `resolveEntities()`.
3. Call `resolveEntities` in `layered-resolver.ts` after the winning resolver returns.
4. Extend `nlcl/types.ts` config with `coarseThreshold` + `entityResolution: boolean`.
5. Update `intent-resolver.ts:258` config wiring.

## Acceptance Criteria

1. A 120+ intent catalog resolves correctly via coarse→fine (add a regression test with >100 patterns).
2. `"remind me tomorrow 9am"` → intent `reminder.create` with entity `when` normalized to ISO date.
3. Existing flat-resolution tests still pass (no regression in fuzzy/semantic behavior).
4. `bun run devops gate` passes.

## Tests

- `tests/unit/engines/nlcl/hierarchical-resolver.test.ts` — coarse routing + fine resolution.
- `tests/unit/engines/nlcl/entity-resolution.test.ts` — datetime/number/enum normalization.
- `tests/integration/nlcl/pipeline.test.ts` — full pipeline with >100 intents.

## Dependencies / Risks

- Keep the validated HybridResolver pattern (brief decision #5) — do not replace, only extend.
- Entity resolution must not over-normalize free-text message content; scope to extracted params only.

## References

- `docs/research/briefs/nlcl-nlu-systems-brief.md` (decisions 3, 4; open questions 1, 3)
- `src/engines/nlcl/{layered-resolver,intent-resolver,fuzzy-matcher,tfidf,semantic-resolver,text-normalizer,entity-resolution,types}.ts`
- Units 3.1–3.4: `docs/atomic-v3-fork-canon/phase-03-agentic-core/`
