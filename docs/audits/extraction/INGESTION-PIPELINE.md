# Ingestion Pipeline — Design

**Script:** `scripts/extract/ingest-extracted.ts`
**Input:** `data/extracted/*.json`
**Output:** Prisma DB upserts

---

## Prerequisite: New Migration

Before ingestion can work, run the migration to add `CdpMethodRegistry` and `ProviderStreamConfig`:

```bash
bunx prisma migrate dev --name add_cdp_method_registry_and_stream_config
```

This creates two new tables without modifying any existing tables.

---

## Ingestion Flow

```
Read manifest JSON
  │
  ▼
Validate with Zod (ExtractedManifestSchema)
  │
  ├─ Invalid → log error, skip manifest
  │
  ▼
Create ImportJob (status: "running")
  │
  ▼
For each provider in manifest.providers:
  │
  ├─ Upsert ProviderDefinition (by slug)
  │   └─ Sets: displayName, category, websiteUrl, authType, etc.
  │
  ├─ For each endpoint:
  │   └─ Upsert ProviderEndpoint (by providerId + url)
  │
  └─ For each model:
      └─ Upsert ProviderModel (by providerId + modelSlug)
  │
  ▼
For each CdpMethodEntry in manifest.cdpMethods:
  │
  ├─ Resolve providerId from provider slug
  │
  └─ Upsert CdpMethodRegistry (by providerId + method + chromeVersion)
      └─ Sets: domain, paramsJson, usedForJson, sourceCodebase, sourceFile
  │
  ▼
For each ExtractedStreamConfig in manifest.streamConfigs:
  │
  ├─ Resolve providerId from provider slug
  │
  └─ Upsert ProviderStreamConfig (by providerId + streamTransport + version)
      └─ Sets: streamTerminalJson, sseFormat, deltaPathJson, completionDetectorsJson
  │
  ▼
For each ExtractedCapability in manifest.capabilities:
  │
  ├─ Upsert CapabilityTaxonomy (by slug)
  │   └─ Sets: name, category, inputType, description
  │
  └─ For each providerId:
      └─ Upsert CapabilityBinding (by globalId + providerId)
          └─ Sets: status="prospect", confidence=0.0
  │
  ▼
For each ExtractedPureFunction in manifest.pureFunctions:
  │
  └─ Log to ImportJob.resultJson (no DB write — functions stay in code)
  │
  ▼
Update ImportJob (status: "completed", resultJson with stats)
```

---

## Upsert Strategy

All upserts use Prisma's `upsert` with unique constraints:

```typescript
await prisma.providerDefinition.upsert({
  where: { slug: provider.slug },
  create: { id: newId(), slug: provider.slug, ... },
  update: { displayName: provider.displayName, ... },
})
```

This ensures:
1. First run: creates new records
2. Subsequent runs: updates changed fields, no duplicates
3. Foreign key violations: logged and skipped (non-fatal)

---

## ImportJob Tracking

Each ingestion run creates an `ImportJob` record:

```typescript
const job = await prisma.importJob.create({
  data: {
    id: newId(),
    source: `extracted-${manifest.sourceCodebase}`,
    filePath: manifestPath,
    status: 'running',
    configJson: JSON.stringify({
      manifestVersion: manifest.manifestVersion,
      extractedAt: manifest.extractedAt,
      cdpMethodCount: manifest.cdpMethods.length,
      capabilityCount: manifest.capabilities.length,
      streamConfigCount: manifest.streamConfigs.length,
    }),
    startedAt: Date.now(),
  },
})
```

On completion:
```typescript
await prisma.importJob.update({
  where: { id: job.id },
  data: {
    status: 'completed',
    resultJson: JSON.stringify({
      providersUpserted: n,
      cdpMethodsUpserted: n,
      streamConfigsUpserted: n,
      capabilitiesUpserted: n,
      bindingsUpserted: n,
      errors: [...],
    }),
    completedAt: Date.now(),
  },
})
```

---

## Error Handling

| Error Type | Handling |
|-----------|---------|
| Zod validation fail | Skip manifest, log error, continue to next |
| Prisma unique violation | Log warning, skip record, continue |
| Prisma FK violation | Log warning, skip record, continue |
| File not found | Log error, skip manifest |
| JSON parse error | Log error, skip manifest |
| >50% records failed | Set ImportJob.status = "failed", exit 1 |

---

## Idempotency Guarantee

Running ingestion multiple times is safe:
- `upsert` with unique constraints prevents duplicates
- Changed fields are updated, unchanged fields are preserved
- `ImportJob` records accumulate (one per run)
- No data is deleted or truncated

---

## Output Example

```
$ bun run scripts/extract/ingest-extracted.ts

[1/3] Ingesting cap-store-manifest.json...
  ProviderDefinition: upserted "claude" (id: provider_xxx)
  ProviderDefinition: upserted "chatgpt" (id: provider_yyy)
  ProviderDefinition: upserted "gemini" (id: provider_zzz)
  CdpMethodRegistry: upserted 18 methods for "claude"
  CdpMethodRegistry: upserted 15 methods for "chatgpt"
  ProviderStreamConfig: upserted 1 config for "claude" (sse, v1)
  ProviderStreamConfig: upserted 1 config for "chatgpt" (sse, v1)
  ProviderStreamConfig: upserted 1 config for "gemini" (batchexecute, v1)
  CapabilityTaxonomy: upserted 11 capabilities
  CapabilityBinding: upserted 25 bindings
  ImportJob: completed (250ms)

[2/3] Ingesting cap-lab-manifest.json...
  ProviderDefinition: upserted "claude" (updated)
  CdpMethodRegistry: upserted 18 methods for "claude" (source: cap-lab)
  ProviderStreamConfig: upserted 1 config for "claude" (v1, source: cap-lab)
  ...

[3/3] Ingesting backend-manifest.json...
  ProviderDefinition: upserted "gemini" (updated)
  CdpMethodRegistry: upserted 3 methods for "gemini" (source: backend)
  ...

Summary:
  Providers: 7 upserted
  CDP methods: 68 upserted (18 claude + 15 chatgpt + 15 gemini + 10 deepseek + 10 others)
  Stream configs: 7 upserted
  Capabilities: 11 upserted
  Bindings: 25 upserted
  ImportJobs: 3 created
  Errors: 0
```
