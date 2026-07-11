# Extraction Pipeline — Design Plan

**Date:** 2026-07-11
**Purpose:** Extract CDP methods, capabilities, and streaming/parsing logic from all three original codebases into vivim-final's DB.
**Status:** Design phase

---

## Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    EXTRACTION LAYER (Bun scripts)                 │
│                                                                  │
│  scripts/extract/extract-cap-store.ts                            │
│    reads → edge-pwa/cap-store/src/                               │
│    outputs → data/extracted/cap-store-manifest.json              │
│                                                                  │
│  scripts/extract/extract-cap-lab.ts                              │
│    reads → edge-pwa/capabilit-lab/src/                           │
│    outputs → data/extracted/cap-lab-manifest.json                │
│                                                                  │
│  scripts/extract/extract-backend.ts                              │
│    reads → edge-pwa/backend/src/registry/                        │
│    outputs → data/extracted/backend-manifest.json                │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                 STANDARDIZED MANIFEST FORMAT                      │
│  Zod-validated JSON (see EXTRACTION-MANIFEST-FORMAT.md)          │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   INGESTION LAYER                                │
│                                                                  │
│  scripts/extract/ingest-extracted.ts                             │
│    reads → data/extracted/*.json                                 │
│    upserts → Prisma (ProviderDefinition, CdpMethodRegistry,      │
│              ProviderStreamConfig, CapabilityTaxonomy, etc.)     │
│    records → ImportJob (provenance tracking)                     │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ASSESSMENT LAYER                               │
│                                                                  │
│  scripts/extract/assess-coverage.ts                              │
│    reads → Prisma DB                                             │
│    compares → extracted manifest vs DB state                     │
│    outputs → data/extracted/coverage-report.json                 │
│              + console summary                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Extraction Scripts

### `scripts/extract/extract-cap-store.ts`

**Input:** `edge-pwa/cap-store/src/`
**Output:** `data/extracted/cap-store-manifest.json`

**What it scans:**
| File/Dir | What to Extract |
|----------|----------------|
| `src/executor/cdp.ts` | CDP method calls (regex: `send\|call\|execute.*\|Page\|Runtime\|Fetch\|Input\|DOM\|IO\|Network\|Target\.\w+`) |
| `src/schema/core.ts` | Taxonomy definitions, provider bindings |
| `src/executor/parsers.ts` | Parser registry (provider → parser mapping) |
| `src/executor/parsers/*.ts` | Per-provider parser configs |
| `src/executor/stream-detector.ts` | Completion signals per provider |
| `src/confidence.ts` | Confidence formula (pure function, capture as-is) |
| `src/lifecycle/index.ts` | Status ladder (pure function, capture as-is) |
| `src/drift.ts` | Drift detection thresholds |
| `src/executor/recipe.ts` | Recipe format (step types, act verbs) |
| `src/executor/turn-executor.ts` | Turn execution pattern |
| `src/errors.ts` | Error→HTTP mapping |

**Extraction method:** Static analysis — regex/AST scan of source files for:
- CDP method call patterns
- Provider ID strings
- Parser function names
- Configuration constants
- Interface/type definitions

### `scripts/extract/extract-cap-lab.ts`

**Input:** `edge-pwa/capabilit-lab/src/`
**Output:** `data/extracted/cap-lab-manifest.json`

**What it scans:**
| File/Dir | What to Extract |
|----------|----------------|
| `src/cdp/client.ts` | CDP method calls |
| `src/cdp/locator.ts` | A11y locator patterns |
| `src/cdp/input.ts` | Trusted input dispatch patterns |
| `src/cdp/network.ts` | Network capture patterns |
| `src/providers/registry.ts` | 7-provider config table (streamTransport, streamTerminal, composerSelector, etc.) |
| `src/parsers/sse.ts` | SSE parser config |
| `src/parsers/gemini.ts` | Gemini batchexecute config |
| `src/parsers/artifacts.ts` | Artifact extraction patterns |
| `src/content/harness.ts` | In-page harness JS (fetch/XHR monkey-patch) |
| `src/recipe/schema.ts` | Recipe Zod schema |
| `src/healing/portfolio.ts` | Selector portfolio generator |
| `src/healing/classifier.ts` | Failure classifier types |
| `src/learn/confidence.ts` | Confidence formula |
| `src/promotion/ladder.ts` | Status ladder |

### `scripts/extract/extract-backend.ts`

**Input:** `edge-pwa/backend/src/registry/`
**Output:** `data/extracted/backend-manifest.json`

**What it scans:**
| File | What to Extract |
|------|----------------|
| `provider_protocols.rs` | Provider endpoint registry, URL patterns, drift detection |
| `capability_vault.rs` | Capability definitions, edges, drift reports |
| `gemini_protocol.rs` | RPC specs, model registry, recipes, batch RPC table |
| `parsers.rs` | Parser registry (param builder + response parser) |

**Special handling:** Rust source → extract string literals, struct definitions, const arrays.

---

## Phase 2: Manifest Format

See `extraction/EXTRACTION-MANIFEST-FORMAT.md` for the full Zod schema.

**Summary:** Each manifest contains 5 sections:
1. `cdpMethods` — CDP method entries (method, domain, params, usedFor)
2. `capabilities` — Capability definitions (slug, category, providerIds, cdpMethods)
3. `streamConfigs` — Streaming transport configs (transport, terminal, format, deltaPath)
4. `providers` — Provider definitions (slug, endpoints, models)
5. `pureFunctions` — Harvestable pure functions (confidence, statusLadder, driftThresholds)

---

## Phase 3: Ingestion Pipeline

### `scripts/extract/ingest-extracted.ts`

**Input:** `data/extracted/*.json`
**Output:** Prisma DB upserts

**Ingestion order (respects foreign keys):**
```
1. ImportJob (record ingestion start)
2. ProviderDefinition (upsert by slug)
3. ProviderEndpoint (upsert by providerId + url)
4. ProviderModel (upsert by providerId + modelSlug)
5. CdpMethodRegistry (upsert by providerId + method + chromeVersion)  [NEW]
6. ProviderStreamConfig (upsert by providerId + transport + version)  [NEW]
7. CapabilityTaxonomy (upsert by slug)
8. CapabilityBinding (upsert by globalId + providerId)
9. ProviderCapability (upsert by providerId + globalCapabilityId)
10. ProviderParser (upsert by providerId + parserName + version)
11. ImportJob (mark completed)
```

**Idempotency:** All upserts use unique constraints. Running ingestion multiple times is safe.

**Provenance:** Each imported record gets `sourceCodebase` metadata (cap-store, cap-lab, backend).

---

## Phase 4: Assessment Queries

### `scripts/extract/assess-coverage.ts`

**Purpose:** Compare extracted data against vivim-final's current DB state.

**Queries:**
1. **CDP method coverage** — Which CDP methods exist in extracted data but NOT in vivim-final's TraceEntry?
2. **Capability coverage** — Which capabilities exist in extracted data but NOT in vivim-final's CapabilityTaxonomy?
3. **Parser coverage** — Which parser configs exist in extracted data but NOT in vivim-final's ProviderParser?
4. **Streaming config coverage** — Which stream configs exist in extracted data but NOT in vivim-final's ProviderStreamConfig?
5. **Provider completeness** — For each provider, what % of extracted data is in vivim-final?
6. **Version compatibility** — Which extracted parsers have newer versions than vivim-final's?

**Output:** `data/extracted/coverage-report.json` + console summary

---

## Execution Order

```
Step 1: Create extraction scripts (extract-cap-store.ts, extract-cap-lab.ts, extract-backend.ts)
Step 2: Create manifest format schema (extracted-manifest.ts)
Step 3: Run extraction → data/extracted/*.json
Step 4: Create ingestion script (ingest-extracted.ts)
Step 5: Run ingestion → Prisma DB
Step 6: Create assessment script (assess-coverage.ts)
Step 7: Run assessment → coverage-report.json
Step 8: Review report → identify gaps → iterate
```

---

## Dependencies

- **Runtime:** Bun (TypeScript execution)
- **Schema:** Zod (manifest validation)
- **Database:** Prisma client (ingestion)
- **New Prisma models:** `CdpMethodRegistry`, `ProviderStreamConfig` (migration needed)
- **No external APIs:** All extraction is static file analysis

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Regex misses CDP methods | Validate against CDP protocol documentation |
| Rust source parsing fails | Use string literal extraction + struct field matching |
| Duplicate provider slugs | Use Prisma unique constraints (upsert is idempotent) |
| Schema migration breaks existing data | New tables only, no modifications to existing tables |
| Extraction is incomplete | Assessment script catches gaps |
