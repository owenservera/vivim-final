# Data Model: DB-Driven Capability Execution

**Feature**: 019-name-driven-capability-execution
**Date**: 2026-07-18

## Entities

### CapabilitySnapshotEntry (in-memory, derived)

Loaded at boot from `capability_binding` + `capability_taxonomy` + `capability_program`.

| Field | Type | Source | Notes |
|-------|------|--------|-------|
| `globalId` | string | `capability_binding.globalId` | taxonomy row id |
| `slug` | string | `capability_taxonomy.slug` | unique key for resolution |
| `providerId` | string | `capability_binding.providerId` | filter axis |
| `category` | string | `capability_taxonomy.category` | |
| `status` | string | `capability_binding.status` | must be `active` to load |
| `confidence` | number | `capability_binding.confidence` | |
| `programId` | string \| null | `capability_binding.bestProgramId ?? currentProgramId` | harness recipe |
| `configJson` | string | `capability_program.configJson` | executed by HarnessExecutor |
| `uiComponent` | string | `capability_taxonomy.uiComponent` | frontend render hint |
| `uiPosition` | string | `capability_taxonomy.uiPosition` | |
| `uiInputSchema` | string | `capability_taxonomy.uiInputSchema` | JSON |

**Key**: composite — `slug@providerId` and `globalId@providerId`.
**State**: immutable for process lifetime after `load()`. Reload only on explicit re-seed.

### SnapshotRow (contract DTO, `CapabilityStore.loadSnapshot`)

```ts
interface SnapshotRow {
  globalId: string
  slug: string
  providerId: string
  category: string
  status: string
  confidence: number
  programId: string | null
  configJson: string | null
  uiComponent: string
  uiPosition: string
  uiInputSchema: string
}
```

### RegisteredProviderSet (in-memory, derived)

Set of `providerId`s from `ProviderStore.listDefinitions({ isActive: 1 })`, optionally
narrowed to providers with a default `ProviderAccount`. Used to filter the snapshot query.

### (Existing, unchanged) ProviderParser fallback graph

`ProviderParser.fallbackParserId` self-relation — populated by the registrar's 2-pass insert
(R1.2). No new entity; the change is in the *write* path, not the model.

## Relationships

```text
ProviderDefinition (active) 1───* CapabilityBinding (providerId)
CapabilityBinding  *───1 CapabilityTaxonomy (globalId)
CapabilityBinding  1───* CapabilityProgram (bestProgramId/currentProgramId)
        │
        └─► CapabilitySnapshotEntry (in-memory projection, keyed slug@providerId)
```

## Validation Rules

- A binding is loaded into the snapshot only if `status === 'active'`.
- A binding is loaded only if its `providerId` ∈ registered provider set.
- A snapshot entry with `programId == null` is still resolvable (taxonomy exists) but
  marked non-executable (`executable: false`).
- Snapshot load is idempotent; re-`load()` replaces the whole map.

## State Transitions

- `unloaded` → `loaded` (boot) → `frozen` (process lifetime) → `reloaded` (explicit).
- Parser rows: `file` default → `inline` default (R1.3); `fallbackParserId: null` →
  resolved row id when manifest declares `fallback`.
