// src/engines/capability-snapshot.ts
// 019 — DB-driven capability execution: boot loader into an in-memory map.
//
// The ported capability taxonomy/bindings/programs live in the DB but were
// write-only at runtime (only the static 96-command CDP catalog was live).
// This engine loads active bindings for registered providers at boot into a
// static, process-lifetime in-memory map. Runtime resolution is O(1) — no
// per-request DB hit. Governor Canon: this engine never imports BunCdpClient.

import type { CapabilityStore, SnapshotRow } from '../storage/contracts/capability-store.js'

export interface CapabilitySnapshotEntry extends SnapshotRow {
  /** True when a program is attached and can actually be executed. */
  executable: boolean
}

export class CapabilitySnapshot {
  private bySlugProvider = new Map<string, CapabilitySnapshotEntry>()
  private byIdProvider = new Map<string, CapabilitySnapshotEntry>()
  private bySlugAny = new Map<string, CapabilitySnapshotEntry>()

  constructor(private readonly store: CapabilityStore) {}

  /**
   * Boot loader. Reads active bindings for the given (registered) providers and
   * builds the in-memory maps. Returns the number of entries loaded. Idempotent:
   * re-loading replaces the whole map.
   */
  async load(registeredProviderIds: string[]): Promise<number> {
    const rows = await this.store.loadSnapshot(registeredProviderIds)
    this.bySlugProvider.clear()
    this.byIdProvider.clear()
    this.bySlugAny.clear()

    for (const r of rows) {
      const entry: CapabilitySnapshotEntry = {
        ...r,
        executable: r.programId != null,
      }
      this.bySlugProvider.set(`${r.slug}@${r.providerId}`, entry)
      this.byIdProvider.set(`${r.globalId}@${r.providerId}`, entry)
      // Provider-agnostic fallback: first writer wins (stable for boot load).
      if (!this.bySlugAny.has(r.slug)) this.bySlugAny.set(r.slug, entry)
    }
    return this.bySlugProvider.size
  }

  /** Resolve by slug for a provider; falls back to provider-agnostic entry. */
  getBySlug(slug: string, providerId?: string): CapabilitySnapshotEntry | null {
    if (providerId) {
      const hit = this.bySlugProvider.get(`${slug}@${providerId}`)
      if (hit) return hit
    }
    return this.bySlugAny.get(slug) ?? null
  }

  /** Resolve by taxonomy globalId for a provider. */
  getById(globalId: string, providerId?: string): CapabilitySnapshotEntry | null {
    if (providerId) {
      const hit = this.byIdProvider.get(`${globalId}@${providerId}`)
      if (hit) return hit
    }
    // globalId without provider scope is ambiguous across providers; require it.
    return null
  }

  /** All loaded entries (registry bridge / debug surface). */
  all(): CapabilitySnapshotEntry[] {
    return [...this.bySlugProvider.values()]
  }
}
