// web/ui/src/ui/registry.ts
// Global UIComponentRegistry — the backbone of the hot-swappable, capability-
// global UI (docs/prd-hot-swappable-ui.md).
//
// Every surface resolves its slots through this single registry. A slot has a
// generic DEFAULT shared by all providers; any provider or capability can
// register a BESPOKE renderer for that slot at RUNTIME, and the mounted UI
// live-updates (the registry is an external store consumed via useSyncExternalStore).
//
// Resolution precedence: capabilitySlug > providerSlug > default.
// Sandbox (P8): a bespoke renderer carries a `sandbox` whitelist of the
// capability(s) it is allowed to touch.

import type { ComponentType } from 'react'
import { SLOT_IDS, type SlotId, type SlotOverrideClaim } from './slots.js'

// ── Types ─────────────────────────────────────────────────────────────────

/** Every slot is rendered through this permissive component type so defaults
//  and bespoke renderers can be stored uniformly. Surfaces cast to the
//  concrete prop shape they expect. */
export type AnyComponent = ComponentType<Record<string, unknown>>

export type SlotSource = 'capability' | 'provider' | 'default'

export interface ResolvedSlot {
  component: AnyComponent
  source: SlotSource
  /** Sandbox whitelist attached to the resolved component (P8). Empty = default. */
  sandbox: string[]
}

export interface SlotOverrideRecord {
  slot: SlotId
  slug: string
  component: AnyComponent
  sandbox: string[]
}

export interface SlotContext {
  providerSlug: string
  capabilitySlug?: string
}

export interface RegisterOptions {
  /** Capability(s) this bespoke renderer is whitelisted to touch (P8). */
  sandbox?: string[]
}

// ── Store ───────────────────────────────────────────────────────────────────

const defaults = new Map<SlotId, AnyComponent>()
const bespoke = new Map<SlotId, Map<string, SlotOverrideRecord>>()
const catalog = new Map<string, AnyComponent>()

for (const id of SLOT_IDS) {
  bespoke.set(id, new Map())
}

let version = 0
const listeners = new Set<() => void>()

function emit(): void {
  version++
  for (const l of listeners) l()
  persist()
}

// ── External store API ───────────────────────────────────────────────────────

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getVersion(): number {
  return version
}

// ── Defaults ─────────────────────────────────────────────────────────────────

/** Register the generic default renderer for a slot (shared by all providers). */
export function registerDefault(slot: SlotId, component: AnyComponent): void {
  defaults.set(slot, component)
}

/** Register a named component in the catalog so backend override claims can
//  resolve a key → component (FRONTEND=BACKEND, data-driven swaps, H6). */
export function registerCatalogEntry(key: string, component: AnyComponent): void {
  catalog.set(key, component)
}

// ── Bespoke / hot-swap ─────────────────────────────────────────────────────────

/** Register or replace a bespoke renderer for a slot + slug. Live-swaps the UI. */
export function register(
  slot: SlotId,
  slug: string,
  component: AnyComponent,
  opts?: RegisterOptions,
): void {
  if (!slug) throw new Error('UIComponentRegistry.register requires a slug')
  if (!defaults.has(slot)) {
    throw new Error(`Unknown slot: ${slot}`)
  }
  bespoke.get(slot)!.set(slug, { slot, slug, component, sandbox: opts?.sandbox ?? [] })
  emit()
}

/** Remove a bespoke renderer; falls back to provider/default. */
export function unregister(slot: SlotId, slug: string): void {
  if (bespoke.get(slot)?.delete(slug)) emit()
}

/** Ergonomic alias used from devtools / runtime modules. */
export const hotSwap = register

/** Apply a backend-provided override claim (slot → catalog key + sandbox). */
export function applyClaim(slot: SlotId, slug: string, claim: SlotOverrideClaim): void {
  if (!claim.component) return
  const component = catalog.get(claim.component)
  if (!component) return // unknown catalog key — record nothing (safe no-op)
  register(slot, slug, component, { sandbox: claim.sandbox })
}

// ── Resolve ───────────────────────────────────────────────────────────────────

/** Resolve the active component for a slot under a context. */
export function resolve(slot: SlotId, ctx: SlotContext): ResolvedSlot {
  const store = bespoke.get(slot)
  if (ctx.capabilitySlug && store?.has(ctx.capabilitySlug)) {
    const rec = store.get(ctx.capabilitySlug)!
    return { component: rec.component, source: 'capability', sandbox: rec.sandbox }
  }
  if (store?.has(ctx.providerSlug)) {
    const rec = store.get(ctx.providerSlug)!
    return { component: rec.component, source: 'provider', sandbox: rec.sandbox }
  }
  const def = defaults.get(slot)
  if (!def) throw new Error(`No default registered for slot: ${slot}`)
  return { component: def, source: 'default', sandbox: [] }
}

/** Convenience: resolve just the component. */
export function resolveComponent(slot: SlotId, ctx: SlotContext): AnyComponent {
  return resolve(slot, ctx).component
}

// ── Manifest / debug ───────────────────────────────────────────────────────────

export interface OverrideManifestEntry {
  slot: SlotId
  slug: string
  sandbox: string[]
}

export function listOverrides(): OverrideManifestEntry[] {
  const out: OverrideManifestEntry[] = []
  for (const [slot, store] of bespoke) {
    for (const [slug, rec] of store) {
      out.push({ slot, slug, sandbox: rec.sandbox })
    }
  }
  return out
}

// ── Persistence (localStorage for dev) ──────────────────────────────────────

const STORAGE_KEY = 'vivim.ui.overrides'

interface PersistedOverride {
  slot: SlotId
  slug: string
  componentKey: string
  sandbox: string[]
}

function persist(): void {
  if (typeof window === 'undefined') return
  try {
    const records: PersistedOverride[] = []
    for (const [slot, store] of bespoke) {
      for (const [slug, rec] of store) {
        // only persist overrides whose component is a known catalog entry
        let componentKey: string | null = null
        for (const [key, comp] of catalog) {
          if (comp === rec.component) {
            componentKey = key
            break
          }
        }
        if (componentKey) {
          records.push({ slot, slug, componentKey, sandbox: rec.sandbox })
        }
      }
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
  } catch {
    // persistence is best-effort
  }
}

/** Re-apply persisted overrides from a previous session (dev hot-swap survival). */
export function loadPersisted(): void {
  if (typeof window === 'undefined') return
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const records = JSON.parse(raw) as PersistedOverride[]
    for (const r of records) {
      const component = catalog.get(r.componentKey)
      if (component) register(r.slot, r.slug, component, { sandbox: r.sandbox })
    }
  } catch {
    // ignore corrupt storage
  }
}

// ── Runtime bridge (window.__vivim.ui) ───────────────────────────────────────

/** Expose the registry on window for live hot-swap from devtools (H8). */
export function exposeRuntime(): void {
  if (typeof window === 'undefined') return
  const api = {
    register,
    unregister,
    hotSwap,
    resolve,
    listOverrides,
    applyClaim,
  }
  // biome-ignore lint: runtime debug bridge
  ;(window as unknown as { __vivim: { ui: typeof api } }).__vivim = {
    ...(window as unknown as { __vivim?: { ui?: unknown } }).__vivim,
    ui: api,
  }
}
