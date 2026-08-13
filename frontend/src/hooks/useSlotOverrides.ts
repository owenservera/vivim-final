'use client';

/**
 * hooks/useSlotOverrides.ts
 * --------------------------------------------------------------------
 * Fetches capabilities from the backend API and applies uiSlots
 * overrides to the SDK slot registry.
 *
 * The backend returns `uiSlots` per capability:
 *   { "chat.composer": { "component": "custom.Composer", "sandbox": ["send_message"] } }
 *
 * This hook resolves the component key against the catalog and calls
 * `registerSlot()` to apply the override.
 *
 * Called once at ChatSurface mount.
 */

import { useEffect } from 'react';
import { useIO } from '@/components/canvas/UnifiedIOProvider';
import { type AnyComponent, registerSlot } from '@/sdk/canvas/register-slot';

// ── Catalog of swappable components ──────────────────────────────────────────
// Components that can be referenced by name in uiSlots overrides.
// This is the frontend-side catalog that backend component keys resolve against.

const COMPONENT_CATALOG: Record<string, AnyComponent> = {};

/**
 * Register a component in the catalog so backend overrides can reference it.
 * Call this at boot for any component that should be hot-swappable.
 */
export function registerCatalogComponent(key: string, component: AnyComponent): void {
  COMPONENT_CATALOG[key] = component;
}

// ── Types ───────────────────────────────────────────────────────────────────

interface UiSlotOverride {
  component?: string;
  sandbox?: string[];
}

interface Capability {
  id: string;
  slug: string;
  uiSlots?: Record<string, UiSlotOverride>;
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function useSlotOverrides(providerSlug?: string): void {
  const io = useIO();

  useEffect(() => {
    let cancelled = false;

    async function applyOverrides(): Promise<void> {
      try {
        const res = await io.get<{ capabilities?: Capability[] }>(
          `/api/capabilities?surface=ui`,
        );
        if (!res.ok) return;
        const caps = res.data?.capabilities ?? [];

        for (const cap of caps) {
          if (!cap.uiSlots || cancelled) continue;

          for (const [slot, override] of Object.entries(cap.uiSlots)) {
            if (cancelled) break;
            if (!override.component) continue;

            const component = COMPONENT_CATALOG[override.component];
            if (!component) continue;

            try {
              registerSlot(slot, cap.slug, component, {
                sandbox: override.sandbox,
              });
            } catch {
              // slot registration failure tolerated
            }
          }
        }
      } catch {
        // capability fetch/parse failure tolerated
      }
    }

    applyOverrides();

    return () => {
      cancelled = true;
    };
  }, [providerSlug, io]);
}
