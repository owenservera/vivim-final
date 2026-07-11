# Schema Gap Analysis — Versioning & Completeness Assessment

**Date:** 2026-07-11
**Scope:** Does vivim-final's Prisma schema accommodate different versions of CDP, parsing, streaming configs?
**Schema:** `prisma/schema.prisma` (1829 lines, 50+ models)

---

## Versioning Assessment

### 1. Parser Versioning — ✓ FULLY SUPPORTED

**Existing model:** `ProviderParser`

```prisma
model ProviderParser {
  id               String  @id
  providerId       String  @map("provider_id")
  parserName       String  @map("parser_name")
  parserVersion    Int     @default(1) @map("parser_version")
  parserLogicType  String  @default("file") @map("parser_logic_type")
  parserFilePath   String? @map("parser_file_path")
  parserHash       String? @map("parser_hash")
  isActive         Int     @default(1) @map("is_active")
  fallbackParserId String? @map("fallback_parser_id")
  // ...
}
```

**What it supports:**
- Version tracking (`parserVersion`)
- Hash-based change detection (`parserHash`)
- Fallback chains (`fallbackParserId` → self-reference)
- Active/inactive toggle (`isActive`)
- File path reference (`parserFilePath`)

**What it DOESN'T support:**
- Per-version content snapshots (the parser code is in files, not in DB)
- Diff between versions (no `supersededBy` chain like `CapabilityProgram`)

**Verdict:** Parser versioning is sufficient for Phase 22. The version chain + hash is enough to know which parser is active and detect changes. No schema change needed.

---

### 2. CDP Method Versioning — ✗ NOT SUPPORTED

**What exists:** `TraceEntry` records CDP methods that were *executed*, but there's no registry of CDP methods that are *available* per provider or per Chrome version.

```prisma
model TraceEntry {
  cdpMethod      String? @map("cdp_method")      // "Page.navigate"
  cdpParamsJson  String? @map("cdp_params_json")
  cdpResultJson  String? @map("cdp_result_json")
  // ...
}
```

**Gap:** No model to answer:
- "What CDP methods does Claude need?"
- "What CDP methods are available in Chrome 125?"
- "Which providers use `Input.insertText`?"

**Required:** New `CdpMethodRegistry` model.

```prisma
model CdpMethodRegistry {
  id              String  @id
  providerId      String? @map("provider_id")     // null = universal method
  method          String                           // "Page.navigate"
  domain          String                           // "Page"
  paramsJson      String  @default("[]") @map("params_json")
  usedForJson     String  @default("[]") @map("used_for_json")  // capability slugs
  sourceCodebase  String                           // "cap-store" | "cap-lab" | "backend"
  sourceFile      String? @map("source_file")
  chromeVersion   String? @map("chrome_version")  // null = all versions
  isActive        Int     @default(1) @map("is_active")
  createdAt       Int     @map("created_at")
  updatedAt       Int     @map("updated_at")

  provider ProviderDefinition? @relation(fields: [providerId], references: [id], onDelete: Cascade)

  @@unique([providerId, method, chromeVersion])
  @@index([domain])
  @@index([method])
  @@map("cdp_method_registry")
}
```

---

### 3. Provider Manifest Versioning — ✓ FULLY SUPPORTED

**Existing model:** `ProviderManifestVersion`

```prisma
model ProviderManifestVersion {
  id            String  @id
  providerId    String  @map("provider_id")
  manifestFile  String  @map("manifest_file")
  version       Int     @default(1)
  hash          String
  contentJson   String  @map("content_json")
  changeSummary String? @map("change_summary")
  actor         String  @default("system")
  createdAt     Int     @map("created_at")
  // ...
}
```

**What it supports:**
- Semantic versioning (`version`)
- Content hashing (`hash`)
- Full content snapshot (`contentJson`)
- Change tracking (`changeSummary`)
- Actor attribution (`actor`)
- Unique constraint (`providerId, manifestFile, version`)

**Verdict:** Fully sufficient. Each manifest revision is captured with full content + hash + diff summary.

---

### 4. Capability Taxonomy Versioning — ✓ FULLY SUPPORTED

**Existing model:** `CapabilityTaxonomyVersion`

```prisma
model CapabilityTaxonomyVersion {
  id               String @id
  capabilityId     String @map("capability_id")
  version          Int
  snapshotJson     String @map("snapshot_json")
  changeSummary    String? @map("change_summary")
  changedFieldsJson String @default("[]") @map("changed_fields_json")
  actor            String @default("system")
  createdAt        Int    @map("created_at")
  // ...
}
```

**What it supports:**
- Version numbering
- Full snapshot per version
- Field-level diff (`changedFieldsJson`)
- Change summary

**Verdict:** Fully sufficient. Each taxonomy revision is captured.

---

### 5. Program Versioning — ✓ FULLY SUPPORTED

**Existing model:** `CapabilityProgram` + `ProgramVersionMetric`

```prisma
model CapabilityProgram {
  id           String  @id
  bindingId    String  @map("binding_id")
  version      Int     @default(1)
  supersededById String? @map("superseded_by")
  isActive     Int     @default(1) @map("is_active")
  configJson   String  @default("{}") @map("config_json")
  // ...
}

model ProgramVersionMetric {
  // Windowed metrics per version
  window1hTotal, window1hSuccess
  window24hTotal, window24hSuccess
  window7dTotal, window7dSuccess
  // ...
}
```

**What it supports:**
- Version chain (`supersededById`)
- Active/inactive toggle
- Windowed performance metrics per version
- Unique constraint (`bindingId, programId, programVersion`)

**Verdict:** Fully sufficient. Programs can version independently with performance tracking.

---

### 6. Streaming Config Versioning — ✗ NOT SUPPORTED

**Gap:** No model for per-provider streaming configuration. The stream transport (SSE vs batchexecute), completion signals, and delta paths are hardcoded in parser seed files and `ProviderDefinition.capabilitiesJson`.

**Required:** New `ProviderStreamConfig` model.

```prisma
model ProviderStreamConfig {
  id                    String  @id
  providerId            String  @map("provider_id")
  streamTransport       String           // "sse" | "batchexecute" | "websocket" | "sse-patch"
  streamTerminalJson    String  @default("[]") @map("stream_terminal_json")
  sseFormat             String? @map("sse_format")  // "openai" | "anthropic" | "gemini"
  deltaPathJson         String? @map("delta_path_json")
  contentType           String? @map("content_type")
  completionDetectorsJson String @default("[]") @map("completion_detectors_json")
  harnessJs             String? @map("harness_js")
  isActive              Int     @default(1) @map("is_active")
  version               Int     @default(1)
  supersededById        String? @map("superseded_by")
  createdAt             Int     @map("created_at")
  updatedAt             Int     @map("updated_at")

  provider     ProviderDefinition     @relation(fields: [providerId], references: [id], onDelete: Cascade)
  supersededBy ProviderStreamConfig?  @relation("SuperStreamConfig", fields: [supersededById], references: [id], onDelete: SetNull)
  supersededFor ProviderStreamConfig[] @relation("SuperStreamConfig")

  @@unique([providerId, streamTransport, version])
  @@index([providerId])
  @@map("provider_stream_config")
}
```

---

### 7. Provider Capability Metrics — ✓ MOSTLY SUPPORTED

**Existing model:** `ProviderCapability`

```prisma
model ProviderCapability {
  confidence                 Float   @default(1.0)
  successCount               Int     @default(0) @map("success_count")
  failCount                  Int     @default(0) @map("fail_count")
  consecutiveFailures        Int     @default(0) @map("consecutive_failures")
  avgLatencyMs               Float   @default(0) @map("avg_latency_ms")
  p95LatencyMs               Float   @default(0) @map("p95_latency_ms")
  selectorHitCount           Int     @default(0) @map("selector_hit_count")
  selectorMissCount          Int     @default(0) @map("selector_miss_count")
  // ... many override fields
}
```

**What it supports:**
- Per-provider-per-capability confidence
- Success/fail counts
- Latency metrics
- Selector hit/miss tracking
- UI override fields (label, icon, component, position)

**What it DOESN'T support:**
- Versioned capability configs (no `supersededBy`)
- Capability-specific CDP method requirements

**Verdict:** Sufficient for Phase 22. No schema change needed.

---

### 8. Chrome/CDP Version Compatibility — ✗ NOT SUPPORTED

**Gap:** No model to track which Chrome versions support which CDP methods. When Chrome deprecates a CDP method, there's no way to know which providers are affected.

**Option A:** Use `CdpMethodRegistry.chromeVersion` (part of new model, string field)
**Option B:** Create a separate `ChromeVersion` model (overkill for now)

**Recommendation:** Option A. A string field `chromeVersion` on `CdpMethodRegistry` is sufficient. No separate model needed.

---

## Gap Summary

| Versioning Need | Existing Support | Gap? | Action |
|-----------------|-----------------|------|--------|
| Parser versions | `ProviderParser` | ✓ None | No change |
| Manifest versions | `ProviderManifestVersion` | ✓ None | No change |
| Taxonomy versions | `CapabilityTaxonomyVersion` | ✓ None | No change |
| Program versions | `CapabilityProgram` + `ProgramVersionMetric` | ✓ None | No change |
| CDP method registry | `TraceEntry` (audit only) | ✗ Missing | New `CdpMethodRegistry` model |
| Streaming config | None | ✗ Missing | New `ProviderStreamConfig` model |
| Chrome version compat | None | ✗ Missing | Field on `CdpMethodRegistry` |
| Provider capability metrics | `ProviderCapability` | ✓ None | No change |
| Binding status lifecycle | `BindingStatusLog` | ✓ None | No change |
| Selector health | `SelectorHealthHistory` | ✓ None | No change |

---

## New Models Required

### `CdpMethodRegistry`
**Purpose:** Catalog of CDP methods per provider, with Chrome version tracking.
**Why:** Know what CDP methods each provider needs, detect Chrome version incompatibilities.
**Unique:** `[providerId, method, chromeVersion]`

### `ProviderStreamConfig`
**Purpose:** Per-provider streaming transport configuration with version chain.
**Why:** Different providers use different transports (SSE vs batchexecute). Config should be versioned.
**Unique:** `[providerId, streamTransport, version]`

**Total new models: 2** (out of 50+ existing models = 4% expansion)

---

## What Fits Without Changes

The following from the originals fits existing schema without any new models:

| Original Pattern | Maps To |
|-----------------|---------|
| Cap-store confidence formula (168 LOC) | `CapabilityBinding.confidence` field |
| Cap-store status ladder (169 LOC) | `CapabilityBinding.status` + `BindingStatusLog` |
| Cap-store drift detection (96 LOC) | `DriftEvent` model |
| Cap-store pattern store (65 LOC) | `SelectorHealthHistory` model |
| Cap-store verify gate (89 LOC) | `Outcome` model |
| Cap-lab selector portfolio (456 LOC) | `SelectorStrategy` model |
| Cap-lab failure classifier (296 LOC) | `FailureClassification` model |
| Cap-lab promotion ladder (127 LOC) | `BindingStatusLog` model |
| Cap-lab outcomes (181 LOC) | `Outcome` model |
| Backend GeminiProfile | `ProviderModel` + `ProviderManifestVersion` |
| Backend CapabilityRecipe | `CapabilityMacro` + `dagJson` |
| Backend URL matcher | Utility function (no schema needed) |
| Cap-store SSE parser | `ProviderParser` + seed files |
| Cap-store per-provider parsers | `ProviderParser` + seed files |
| Cap-store stream detector | `ProviderStreamConfig` (new) |
| Cap-store turn executor | Engine code (no schema needed) |
| Cap-lab trusted input dispatch | Engine code (no schema needed) |
