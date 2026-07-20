/**
 * sdk/canvas/register-slot.ts
 * --------------------------------------------------------------------
 * G1.4 — `registerSlot(slot, slug, Component, opts)` and
 * `unregisterSlot(...)`. Wraps the in-browser UIComponentRegistry
 * (an external store consumed via useSyncExternalStore).
 *
 * Precedence: capabilitySlug > providerSlug > default. A bespoke
 * React component live-swaps into the slot without rebuild.
 *
 * (Bundle 05 §5.3 registry.ts API, packaged for SDK consumers.)
 */

import type { ComponentType } from 'react';

// ── Inline registry (mirrors bundle 05 web/ui/src/ui/registry.ts) ──────

export type AnyComponent = ComponentType<Record<string, unknown>>;
export type SlotSource = 'capability' | 'provider' | 'default';

export interface ResolvedSlotComponent {
  component: AnyComponent;
  source: SlotSource;
  sandbox: string[];
}

export interface RegisterOptions {
  /** Capability(s) this bespoke renderer is whitelisted to touch (P8). */
  sandbox?: string[];
}

const defaults = new Map<string, AnyComponent>();
const bespoke = new Map<string, Map<string, { component: AnyComponent; sandbox: string[] }>>();
const listeners = new Set<() => void>();
let version = 0;

function emit(): void {
  version += 1;
  for (const l of listeners) l();
}

/** External store subscription (useSyncExternalStore). */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getVersion(): number {
  return version;
}

/** Register the generic default for a slot (called once at boot). */
export function registerDefault(slot: string, component: AnyComponent): void {
  defaults.set(slot, component);
  if (!bespoke.has(slot)) bespoke.set(slot, new Map());
  emit();
}

/** Register/replace a bespoke renderer for a slot + slug. Live-swaps. */
export function registerSlot(
  slot: string,
  slug: string,
  component: AnyComponent,
  opts?: RegisterOptions,
): void {
  if (!slug) throw new Error('registerSlot requires a slug');
  if (!defaults.has(slot)) {
    throw new Error(`Unknown slot: ${slot}. Call registerDefault first.`);
  }
  let store = bespoke.get(slot);
  if (!store) {
    store = new Map();
    bespoke.set(slot, store);
  }
  store.set(slug, { component, sandbox: opts?.sandbox ?? [] });
  emit();
}

/** Remove a bespoke renderer; falls back to default. */
export function unregisterSlot(slot: string, slug: string): void {
  bespoke.get(slot)?.delete(slug);
  emit();
}

/** Resolve the active component for a slot under a context. */
export function resolveSlot(
  slot: string,
  ctx: { providerSlug: string; capabilitySlug?: string },
): ResolvedSlotComponent {
  const store = bespoke.get(slot);
  if (ctx.capabilitySlug && store?.has(ctx.capabilitySlug)) {
    const rec = store.get(ctx.capabilitySlug)!;
    return { component: rec.component, source: 'capability', sandbox: rec.sandbox };
  }
  if (ctx.providerSlug && store?.has(ctx.providerSlug)) {
    const rec = store.get(ctx.providerSlug)!;
    return { component: rec.component, source: 'provider', sandbox: rec.sandbox };
  }
  const def = defaults.get(slot);
  if (!def) throw new Error(`No default registered for slot: ${slot}`);
  return { component: def, source: 'default', sandbox: [] };
}

/** Manifest of all bespoke overrides (debug/devtools). */
export function listSlotOverrides(): Array<{ slot: string; slug: string; sandbox: string[] }> {
  const out: Array<{ slot: string; slug: string; sandbox: string[] }> = [];
  for (const [slot, store] of bespoke) {
    for (const [slug, rec] of store) {
      out.push({ slot, slug, sandbox: rec.sandbox });
    }
  }
  return out;
}
