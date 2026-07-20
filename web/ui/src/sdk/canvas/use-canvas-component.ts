'use client';

/**
 * sdk/canvas/use-canvas-component.ts
 * --------------------------------------------------------------------
 * G1.5 — `useCanvasComponent(slot, ctx)`: React hook backed by an
 * external store (useSyncExternalStore). Returns the live resolved
 * component for a slot. Live-swaps when registerSlot/unregisterSlot
 * fires — no rebuild.
 */

import { useSyncExternalStore } from 'react';
import {
  getVersion,
  subscribe,
  resolveSlot,
  type AnyComponent,
  type ResolvedSlotComponent,
} from './register-slot';

export function useCanvasComponent(
  slot: string,
  ctx: { providerSlug: string; capabilitySlug?: string },
): ResolvedSlotComponent {
  const snapshot = useSyncExternalStore(subscribe, getVersion, getVersion);
  // snapshot is the version counter; resolveSlot is the live lookup.
  void snapshot; // referenced so React re-renders on version bump
  return resolveSlot(slot, ctx);
}

export type { AnyComponent, ResolvedSlotComponent };
