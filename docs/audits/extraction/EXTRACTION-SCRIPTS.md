# Extraction Scripts — Design

**Location:** `scripts/extract/`
**Runtime:** Bun

---

## Script 1: `extract-cap-store.ts`

### Input
```
edge-pwa/cap-store/src/
```

### Output
```
data/extracted/cap-store-manifest.json
```

### Extraction Patterns

#### CDP Methods
```typescript
// Regex patterns to find CDP method calls
const CDP_PATTERNS = [
  /sendCommand\(\s*['"]([A-Z][a-z]+\.[a-zA-Z]+)['"]/g,     // sendCommand('Page.navigate')
  /cdp\.call\(\s*['"]([A-Z][a-z]+\.[a-zA-Z]+)['"]/g,       // cdp.call('Runtime.evaluate')
  /\.send\(\s*\{[^}]*method:\s*['"]([A-Z][a-z]+\.[a-zA-Z]+)['"]/g,  // method: 'Page.navigate'
  /['"]([A-Z][a-z]+\.[a-zA-Z]+)['"]\s*,\s*\{/g,            // 'Page.navigate', { url }
]
```

#### Provider IDs
```typescript
// Find provider ID references
const PROVIDER_ID_PATTERN = /providerId:\s*['"]([\w-]+)['"]/g
const PROVIDER_SLUG_PATTERN = /slug:\s*['"]([\w-]+)['"]/g
```

#### Parser Configs
```typescript
// Find parser function registrations
const PARSER_REGISTRY = /create(\w+Parser)\(\)/g
const STREAM_TERMINAL = /streamTerminal:\s*['"]([\[\]"\w]+)['"]/g
```

#### Confidence Formula
```typescript
// Capture the confidence function body (lines 57-168)
// Pure function, extract as-is
```

#### Status Ladder
```typescript
// Capture VALID_TRANSITIONS and autoStatus() (lines 9-169)
// State machine, extract as-is
```

---

## Script 2: `extract-cap-lab.ts`

### Input
```
edge-pwa/capabilit-lab/src/
```

### Output
```
data/extracted/cap-lab-manifest.json
```

### Extraction Patterns

#### CDP Methods (same regex as cap-store, applied to different files)
```typescript
const CDP_FILES = [
  'src/cdp/client.ts',
  'src/cdp/locator.ts',
  'src/cdp/input.ts',
  'src/cdp/network.ts',
  'src/recipe/executor.ts',
]
```

#### Provider Config Table
```typescript
// The PROVIDERS registry is a single object with all 7 providers
// Extract the entire object as structured data
// Location: src/providers/registry.ts
```

#### Harness JS (in-page monkey-patch)
```typescript
// Extract BLOCK_HARNESS_JS constant
// Location: src/content/harness.ts
// This is the fetch/XHR monkey-patch code injected into provider pages
```

#### Selector Portfolio
```typescript
// Extract generatePortfolio() function
// Location: src/healing/portfolio.ts
// Generates 5 fallback strategies per capability
```

#### Failure Classifier
```typescript
// Extract classifyFailure() function + FAILURE_TYPES
// Location: src/healing/classifier.ts
// 5 failure types: selector_not_found, element_changed, dom_restructured, timing_issue, wrong_capability
```

---

## Script 3: `extract-backend.ts`

### Input
```
edge-pwa/backend/src/registry/
```

### Output
```
data/extracted/backend-manifest.json
```

### Extraction Patterns

#### Rust Provider Protocols
```typescript
// Extract endpoint definitions from provider_protocols.rs
// Pattern: struct ProviderEndpoint { ... }
// Pattern: fn url_matches_pattern(pattern: &str, observed: &str) -> bool
```

#### Gemini Protocol (RPC Specs)
```typescript
// Extract BATCH_RPC_SPECS array from gemini_protocol.rs
// Pattern: pub const BATCH_RPC_SPECS: &[BatchRpcSpec] = &[ ... ]
// Each entry: { rpc: RpcId::X, arg_spec: ArgSpec::Y, metadata_key: "z" }
```

#### Gemini Recipes
```typescript
// Extract RECIPES array from gemini_protocol.rs
// Pattern: pub const RECIPES: &[CapabilityRecipe] = &[ ... ]
// Each entry: { capability_id: "x", rpc_ids: &[...], uses_stream_generate: bool }
```

#### Gemini Model Registry
```typescript
// Extract MODELS array from gemini_protocol.rs
// Pattern: pub const MODELS: &[ModelSpec] = &[ ... ]
// Each entry: { mode_id: "x", model_num: N, api_name: "y", deprecated: bool }
```

#### Capability Vault
```typescript
// Extract capability definitions from capability_vault.rs
// Pattern: struct CapabilityEntry { id, name, category, ... }
// Pattern: struct CapabilityEdge { from, to, relationship }
```

---

## Script 4: `ingest-extracted.ts`

### Input
```
data/extracted/*.json
```

### Output
Prisma DB upserts

### Ingestion Order
```
1. ImportJob
2. ProviderDefinition (upsert by slug)
3. ProviderEndpoint (upsert by providerId + url)
4. ProviderModel (upsert by providerId + modelSlug)
5. CdpMethodRegistry (upsert by providerId + method + chromeVersion)
6. ProviderStreamConfig (upsert by providerId + transport + version)
7. CapabilityTaxonomy (upsert by slug)
8. CapabilityBinding (upsert by globalId + providerId)
9. ProviderCapability (upsert by providerId + globalCapabilityId)
10. ProviderParser (upsert by providerId + parserName + version)
11. ImportJob (mark completed)
```

### Error Handling
- Log each upsert success/failure
- Continue on non-fatal errors (duplicate, FK violation)
- Record error summary in ImportJob.resultJson
- Exit with code 1 if >50% of upserts failed

---

## Script 5: `assess-coverage.ts`

### Input
Prisma DB

### Output
```
data/extracted/coverage-report.json
```

### Assessment Queries

#### CDP Method Coverage
```sql
SELECT cm.method, cm.domain, cm.source_codebase,
  CASE WHEN te.id IS NOT NULL THEN 'in-db' ELSE 'missing' END as status
FROM cdp_method_registry cm
LEFT JOIN trace_entry te ON te.cdp_method = cm.method
ORDER BY cm.domain, cm.method
```

#### Capability Coverage
```sql
SELECT cap.slug, cap.source_codebase,
  CASE WHEN vf.id IS NOT NULL THEN 'in-db' ELSE 'missing' END as status
FROM (
  SELECT DISTINCT json_extract(value, '$.slug') as slug, source_codebase
  FROM extracted_capabilities
) cap
LEFT JOIN capability_taxonomy vf ON vf.slug = cap.slug
ORDER BY cap.slug
```

#### Parser Coverage
```sql
SELECT psc.provider_id, psc.stream_transport, psc.version,
  CASE WHEN pp.id IS NOT NULL THEN 'in-db' ELSE 'missing' END as status
FROM provider_stream_config psc
LEFT JOIN provider_parser pp ON pp.provider_id = psc.provider_id
WHERE psc.is_active = 1
ORDER BY psc.provider_id
```

#### Provider Completeness
```sql
SELECT
  p.slug,
  (SELECT COUNT(*) FROM cdp_method_registry WHERE provider_id = p.id) as cdp_methods,
  (SELECT COUNT(*) FROM provider_stream_config WHERE provider_id = p.id AND is_active = 1) as stream_configs,
  (SELECT COUNT(*) FROM capability_binding WHERE provider_id = p.id) as bindings,
  (SELECT COUNT(*) FROM provider_parser WHERE provider_id = p.id AND is_active = 1) as parsers
FROM provider_definition p
ORDER BY p.slug
```

---

## File Locations Summary

```
scripts/extract/
├── extract-cap-store.ts      ← Scan cap-store source
├── extract-cap-lab.ts        ← Scan cap-lab source
├── extract-backend.ts        ← Scan backend source
├── ingest-extracted.ts       ← Load JSON → Prisma
└── assess-coverage.ts        ← Compare DB vs extracted

data/extracted/
├── cap-store-manifest.json   ← Output from extract-cap-store
├── cap-lab-manifest.json     ← Output from extract-cap-lab
├── backend-manifest.json     ← Output from extract-backend
└── coverage-report.json      ← Output from assess-coverage
```
