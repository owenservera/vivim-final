'use client';

/**
 * components/canvas/use-node-types.ts
 * --------------------------------------------------------------------
 * Maps slot IDs to their resolved React components via the slot registry.
 * Replaces hardcoded STUB data in LivingCanvas with real resolution.
 *
 * Usage:
 *   const { getComponent, getLayout } = useNodeTypes(providerIds, variant);
 *   const Component = getComponent('chat.composer', 'chatgpt');
 */

import { useMemo } from 'react';
import { resolveSlot, type AnyComponent } from '@/sdk/canvas/register-slot';
import { SLOT_IDS, type SlotId } from '@/ui/slots';

export interface NodeTypeEntry {
  slotId: SlotId;
  component: AnyComponent;
  source: 'capability' | 'provider' | 'default';
}

export interface UseNodeTypesResult {
  /** Resolve a component for a slot + provider. Returns null if no default. */
  getComponent: (slotId: string, providerSlug?: string) => AnyComponent | null;
  /** Get all resolved node types for the current providers. */
  getNodeTypes: (providerIds: string[]) => NodeTypeEntry[];
}

export function useNodeTypes(
  providerIds: string[],
  variant?: string,
): UseNodeTypesResult {
  return useMemo(() => {
    const cache = new Map<string, AnyComponent | null>();

    function getComponent(slotId: string, providerSlug?: string): AnyComponent | null {
      const key = `${slotId}:${providerSlug ?? ''}:${variant ?? ''}`;
      if (cache.has(key)) return cache.get(key)!;

      try {
        const ctx = { providerSlug: providerSlug ?? '', capabilitySlug: variant };
        const resolved = resolveSlot(slotId, ctx);
        cache.set(key, resolved.component);
        return resolved.component;
      } catch {
        cache.set(key, null);
        return null;
      }
    }

    function getNodeTypes(providers: string[]): NodeTypeEntry[] {
      const entries: NodeTypeEntry[] = [];

      for (const slotId of SLOT_IDS) {
        const comp = getComponent(slotId, providers[0]);
        if (!comp) continue;

        entries.push({ slotId, component: comp, source: 'default' });
      }

      return entries;
    }

    return { getComponent, getNodeTypes };
  }, [providerIds, variant]);
}
