# Contract: CapabilitySnapshot

**Feature**: 019-name-driven-capability-execution
**Surface**: Engine-internal (read-only projection). Consumed by `governor.executeCapability`
and the unified registry bridge.

## 1. Engine interface (`src/engines/capability-snapshot.ts`)

```ts
import type { CapabilityStore } from '../storage/contracts/capability-store.js'

export interface SnapshotRow {
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

export interface CapabilitySnapshotEntry extends SnapshotRow {
  executable: boolean // programId != null
}

export class CapabilitySnapshot {
  constructor(private store: CapabilityStore) {}

  /** Boot loader — reads bindings for registered providers into memory. */
  async load(registeredProviderIds: string[]): Promise<number>

  /** Resolve by slug for a provider (falls back to provider-agnostic if not found). */
  getBySlug(slug: string, providerId?: string): CapabilitySnapshotEntry | null

  /** Resolve by taxonomy globalId for a provider. */
  getById(globalId: string, providerId?: string): CapabilitySnapshotEntry | null

  /** All entries (for registry bridge / debug surface). */
  all(): CapabilitySnapshotEntry[]
}
```

## 2. Store contract addition (`src/storage/contracts/capability-store.ts`)

```ts
export interface CapabilityStore {
  // ... existing methods ...
  /** Bulk load for the snapshot: active bindings for the given providers,
   *  joined to taxonomy + best program. */
  loadSnapshot(providerIds: string[]): Promise<SnapshotRow[]>
}
```

## 3. Resolution contract (runtime, no DB hit)

`governor.executeCapability(ref, slug, opts)` MUST:
1. If `slug` → static `cap:cdp:*` registry entry → keep current CDP path.
2. Else resolve `snapshot.getBySlug(slug, providerId)` where `providerId` derives from
   `opts.resolver.getConversationProviderId(ref)`.
3. If entry found and `executable` → run `HarnessExecutor` on `configJson` via the live
   slave resolved from `ref`.
4. If entry found but not executable → throw `EngineError('capability has no program')`.
5. If missing → throw `EngineError('capability not found in snapshot')`.

## 4. Invariants

- Snapshot is **read-only** after `load()`; no writes.
- `load()` performs exactly one bulk query (no N+1).
- Never imports `BunCdpClient` (Governor Canon).
- Per-request resolution is O(1) map lookup (R2.2).
