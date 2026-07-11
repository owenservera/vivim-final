# Assessment Queries — Coverage Analysis

**Script:** `scripts/extract/assess-coverage.ts`
**Purpose:** Compare extracted data against vivim-final's DB state
**Output:** `data/extracted/coverage-report.json`

---

## Query 1: CDP Method Coverage

**Question:** Which CDP methods exist in extracted data but NOT in vivim-final's trace log?

```sql
-- CDP methods from extraction that have never been traced in vivim-final
SELECT
  cm.method,
  cm.domain,
  cm.source_codebase,
  cm.used_for_json,
  CASE
    WHEN te.method_count > 0 THEN 'traced'
    ELSE 'never-traced'
  END as trace_status
FROM cdp_method_registry cm
LEFT JOIN (
  SELECT cdp_method, COUNT(*) as method_count
  FROM trace_entry
  WHERE cdp_method IS NOT NULL
  GROUP BY cdp_method
) te ON te.cdp_method = cm.method
WHERE cm.is_active = 1
ORDER BY cm.domain, cm.method
```

**Expected output:**
```
┌─────────────────────────┬────────────┬───────────┬─────────────┐
│ method                  │ domain     │ source    │ trace_status│
├─────────────────────────┼────────────┼───────────┼─────────────┤
│ Input.insertText        │ Input      │ cap-lab   │ never-traced│
│ Input.dispatchKeyEvent  │ Input      │ cap-lab   │ never-traced│
│ Fetch.enable            │ Fetch      │ cap-lab   │ traced      │
│ Page.navigate           │ Page       │ cap-lab   │ traced      │
│ ...                     │ ...        │ ...       │ ...         │
└─────────────────────────┴────────────┴───────────┴─────────────┘
```

---

## Query 2: Capability Coverage

**Question:** Which capabilities exist in extracted data but NOT in vivim-final's taxonomy?

```sql
-- Capabilities from extraction that don't exist in vivim-final
SELECT
  cap.slug,
  cap.display_name,
  cap.source_codebase,
  cap.provider_ids_json,
  CASE
    WHEN vf.id IS NOT NULL THEN 'exists'
    ELSE 'missing'
  END as taxonomy_status
FROM (
  -- This would be populated from the extracted JSON
  -- In practice, read from CdpMethodRegistry.used_for_json or similar
  SELECT DISTINCT
    json_extract(value, '$.slug') as slug,
    json_extract(value, '$.displayName') as display_name,
    source_codebase,
    json_extract(value, '$.providerIds') as provider_ids_json
  FROM cdp_method_registry, json_each(used_for_json)
) cap
LEFT JOIN capability_taxonomy vf ON vf.slug = cap.slug
ORDER BY cap.slug
```

---

## Query 3: Parser Coverage

**Question:** Which parser configs exist in extracted data but NOT in vivim-final?

```sql
-- Stream configs from extraction without matching parsers in vivim-final
SELECT
  psc.provider_id,
  psc.stream_transport,
  psc.version,
  psc.sse_format,
  CASE
    WHEN pp.id IS NOT NULL THEN 'has-parser'
    ELSE 'no-parser'
  END as parser_status,
  pp.parser_version as db_parser_version
FROM provider_stream_config psc
LEFT JOIN provider_parser pp
  ON pp.provider_id = psc.provider_id
  AND pp.is_active = 1
WHERE psc.is_active = 1
ORDER BY psc.provider_id
```

---

## Query 4: Provider Completeness

**Question:** For each provider, how complete is vivim-final's data compared to extraction?

```sql
SELECT
  p.slug as provider,
  p.display_name,
  -- CDP methods
  (SELECT COUNT(*) FROM cdp_method_registry WHERE provider_id = p.id AND is_active = 1)
    as extracted_cdp_methods,
  (SELECT COUNT(DISTINCT te.cdp_method) FROM trace_entry te WHERE te.provider_id = p.id)
    as traced_cdp_methods,
  -- Stream configs
  (SELECT COUNT(*) FROM provider_stream_config WHERE provider_id = p.id AND is_active = 1)
    as extracted_stream_configs,
  (SELECT COUNT(*) FROM provider_parser WHERE provider_id = p.id AND is_active = 1)
    as db_parsers,
  -- Capabilities
  (SELECT COUNT(*) FROM capability_binding WHERE provider_id = p.id)
    as db_bindings,
  -- Endpoints
  (SELECT COUNT(*) FROM provider_endpoint WHERE provider_id = p.id)
    as db_endpoints,
  -- Models
  (SELECT COUNT(*) FROM provider_model WHERE provider_id = p.id)
    as db_models
FROM provider_definition p
ORDER BY p.slug
```

**Expected output:**
```
┌──────────┬─────────┬─────────────┬──────────┬─────────────┬──────────┬───────────┬──────────┬──────────┐
│ provider │ name    │ cdp_extract │ cdp_trace│ stream_ext  │ parsers  │ bindings  │ endpoints│ models   │
├──────────┼─────────┼─────────────┼──────────┼─────────────┼──────────┼───────────┼──────────┼──────────┤
│ chatgpt  │ ChatGPT │ 15          │ 0        │ 1           │ 1        │ 9         │ 3        │ 4        │
│ claude   │ Claude  │ 18          │ 0        │ 1           │ 1        │ 11        │ 3        │ 3        │
│ deepseek │ DeepSeek│ 10          │ 0        │ 1           │ 0        │ 4         │ 2        │ 2        │
│ gemini   │ Gemini  │ 15          │ 0        │ 1           │ 1        │ 9         │ 3        │ 5        │
│ qwen     │ Qwen    │ 10          │ 0        │ 1           │ 0        │ 4         │ 2        │ 2        │
│ studio-ai│ Studio  │ 10          │ 0        │ 1           │ 0        │ 4         │ 2        │ 2        │
│ z-ai     │ Z-AI    │ 10          │ 0        │ 1           │ 0        │ 4         │ 2        │ 2        │
└──────────┴─────────┴─────────────┴──────────┴─────────────┴──────────┴───────────┴──────────┴──────────┘
```

---

## Query 5: Version Compatibility

**Question:** Which extracted parsers have newer versions than vivim-final's?

```sql
SELECT
  psc.provider_id,
  psc.stream_transport,
  psc.version as extracted_version,
  pp.parser_version as db_version,
  CASE
    WHEN psc.version > pp.parser_version THEN 'outdated'
    WHEN psc.version = pp.parser_version THEN 'current'
    WHEN pp.parser_version IS NULL THEN 'no-parser'
    ELSE 'newer-in-db'
  END as compatibility
FROM provider_stream_config psc
LEFT JOIN provider_parser pp
  ON pp.provider_id = psc.provider_id
  AND pp.is_active = 1
WHERE psc.is_active = 1
ORDER BY psc.provider_id
```

---

## Query 6: Streaming Config Gap

**Question:** What streaming transport configs are missing from vivim-final?

```sql
SELECT
  psc.provider_id,
  psc.stream_transport,
  psc.stream_terminal_json,
  psc.sse_format,
  psc.completion_detectors_json,
  psc.version,
  CASE
    WHEN pp.id IS NOT NULL THEN 'has-config'
    ELSE 'missing-config'
  END as config_status
FROM provider_stream_config psc
LEFT JOIN provider_parser pp
  ON pp.provider_id = psc.provider_id
  AND pp.parser_logic_type = psc.stream_transport
  AND pp.is_active = 1
WHERE psc.is_active = 1
ORDER BY psc.provider_id
```

---

## Query 7: Harvest Readiness

**Question:** Which pure functions from the originals are ready to harvest into vivim-final?

```sql
-- This queries the extracted pure functions metadata
-- (stored in ImportJob.resultJson during ingestion)
SELECT
  json_extract(value, '$.name') as function_name,
  json_extract(value, '$.purpose') as purpose,
  json_extract(value, '$.loc') as loc,
  json_extract(value, '$.vivimTargetFile') as target_file,
  json_extract(value, '$.dependencies') as deps
FROM import_job ij,
     json_each(ij.config_json, '$.pureFunctions')
WHERE ij.source = 'extracted-cap-store'
ORDER BY json_extract(value, '$.loc') DESC
```

---

## Coverage Report JSON Schema

```typescript
interface CoverageReport {
  generatedAt: number
  summary: {
    totalCdpMethods: number
    tracedCdpMethods: number
    totalCapabilities: number
    existingCapabilities: number
    totalStreamConfigs: number
    configuredStreamConfigs: number
    overallScore: number  // percentage
  }
  byProvider: {
    [providerId: string]: {
      cdpMethods: { extracted: number; traced: number }
      capabilities: { extracted: number; existing: number }
      streamConfigs: { extracted: number; configured: number }
      parsers: { extracted: number; existing: number }
    }
  }
  gaps: {
    cdpMethods: string[]       // methods in extraction but not traced
    capabilities: string[]     // slugs in extraction but not in taxonomy
    streamConfigs: string[]    // providers without stream config
    parsers: string[]          // providers without parser
  }
  recommendations: string[]    // prioritized list of what to harvest next
}
```
