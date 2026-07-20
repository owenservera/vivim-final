# Dynamic Context Bundles (DCB) — Detailed Spec

## Overview
DCB = layered, token-budgeted prompt context assembled from the warm LCG snapshot. Compose is synchronous, target <1s (warn if >1s).

## Bundle shape
```ts
interface DynamicContextBundle {
  id: string;               // dcb:<profile>:<epoch>
  profile: DcbProfile;
  scenario?: string;
  projectId?: string;
  layers: LayerItem[];
  totalTokens: number;
  budget: number;
  modelTarget?: string;
  createdAt: string;
}
interface LayerItem {
  layer: LayerType;
  text: string;
  provenance: { source: ProvenanceSource; convId?; provider?; accountId?; timestamp?; label };
  confidence: number; recencySecs: number; tokenCost: number;
  included: boolean;
  blocks: ContentBlock[];  // Text | Image | Code | Reference (additive, default [])
}
```

## 8 Profiles → DepthMode + active layers
| Profile | Depth | Layers |
|---------|-------|--------|
| seed | Compact | L0, L7 |
| reunion | Standard | L0, L4, L7 |
| convergence | Deep | L0, L2, L3, Lp, L7 |
| continuum | Standard | L0, L5, L7 |
| handoff | Standard | L0, Lp, Ld, L7 |
| probe | Standard | L0, L2, L7 |
| deep_research | Deep | ALL (L0–L7, max entities) |
| decision_brief | Standard | L0, Ld, Lp, L7 |

## Layer builders (from `composer.rs`)
- **build_l0_identity**: `snap.identity_blob`. If empty → "Identity information not yet available." confidence 1.0.
- **build_l1_prefs**: `snap.prefs_blob`.
- **build_l2_topic**: topic entities (resolve from active conv project else NER on draft). confidence=idf.min(1), sort desc, truncate 10.
- **build_l3_entity**: project `top_entities` (id, desc). truncate 15.
- **build_lp_project**: project `rolling_summary`.
- **build_ld_decisions**: project `decisions[]`.
- **build_l4_conversation**: "Where we left off:" + excerpt(200). confidence 0.9.
- **build_l5_jit**: nearby threads (filter by project if given), excerpt(300), sort by recency, truncate 5.
- **build_l6_history**: deeper excerpt(500).
- **build_l7_query**: `moment.draft_text`. ALWAYS included, confidence 1.0.

## Packing (`budget.rs`)
```
PackItem { layer, score = confidence * recency_decay(recency_secs), tokens }
recency_decay(secs) = exp(-secs / (7*86400))    // 7-day half-life
included = budget::pack_items(pack_items, budget, depth)
FORCE-INCLUDE: L0Identity, L7UserQuery
total_tokens = sum(included.token_cost)  // must be <= budget
```
DepthMode affects how many of each layer type are allowed (Compact/Standard/Deep caps).

## Compose flow (`compose_for_moment`)
1. `scenario::classify(store, moment)` → ScenarioVerdict (scenario + matched_project).
2. `scenario_to_profile(verdict.scenario)` → DcbProfile.
3. `compose(store, profile, moment, matched_project, budget, model, scenario)`.

## Cards (live DCB deck, `cards.rs`)
- `BundleCard` = persisted, named DCB preset with `CardConfig` (layers on/off, budget, profile).
- `recompose_all` runs when snapshot version bumps or after ingest.
- Freshness: Live (<60s) / Fresh (version matches) / Stale (version advanced).
- `refresh_card(id)`, `set_card_config(id, cfg)`.

## Feeder (background, `feeder.rs`)
- `feed(engine, db, opts)` walks all conversations, ingests into LCG, reports progress (fed/total).
- Cooperative pause: `*.feed.pause` RPC sets `AtomicBool` cancel; loop halts between convs, partial work intact, resume skips ingested.

## Inject projection (`projector.rs`)
`project_inject_text(dcb)` → applies `release::policy_for` (sharing/visibility enforcement) → `enforce(layers, policy)` → `project(enforced, Surface::InjectPrompt)` → final prompt string.

## Build status (`BuildStatus`)
`phase ∈ {Idle, Building, Paused, Complete}`, `fed`, `total`, `elapsed_ms`, `started_at`, `finished_at`.
