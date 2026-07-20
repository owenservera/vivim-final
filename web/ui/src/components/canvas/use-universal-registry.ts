'use client';

/**
 * components/canvas/use-universal-registry.ts
 * --------------------------------------------------------------------
 * React binding for the UniversalComponentRegistry.
 *
 * - `useComponent(slot, ctx)` → live-resolved component (useSyncExternalStore)
 * - `useRegistry()` → the full registry (for listing/debugging)
 * - `registerAllComponents()` → registers ALL ~30 UI components into the
 *   registry at boot. Called once from the UniversalComponentProvider.
 */

import { useSyncExternalStore, useCallback, useMemo } from 'react';
import type { ComponentType } from 'react';
import {
  subscribe,
  getVersion,
  resolve,
  register,
  unregister,
  list,
  listByKind,
  size,
  generateCliCommands,
  type ComponentSpec,
  type ResolveContext,
  type ResolvedComponent,
  type ComponentKind,
  type ComponentCategory,
} from '../../shared/universal-registry';

/** Live-resolve a component by slot + context. Re-renders on hot-swap. */
export function useComponent(ctx: ResolveContext): ResolvedComponent | null {
  const version = useSyncExternalStore(subscribe, getVersion, getVersion);
  void version; // referenced so React re-renders on version bump
  return resolve(ctx);
}

/** Get the full registry snapshot (re-renders on any change). */
export function useRegistry(): {
  list: (filter?: Parameters<typeof list>[0]) => ComponentSpec[];
  listByKind: () => Record<ComponentKind, ComponentSpec[]>;
  size: () => number;
  generateCliCommands: () => ReturnType<typeof generateCliCommands>;
} {
  const version = useSyncExternalStore(subscribe, getVersion, getVersion);
  void version;
  return useMemo(
    () => ({ list, listByKind, size, generateCliCommands }),
    [], // stable — the functions read the live Map
  );
}

/** Register a component (returns a disposer). */
export function useRegister(spec: Parameters<typeof register>[0]): () => void {
  return useCallback(() => {
    register(spec);
    return () => unregister(spec.id);
  }, [spec]);
}

// Re-export the raw functions for non-hook contexts.
export { register, unregister, resolve, list, listByKind, size, generateCliCommands };
export type { ComponentSpec, ResolveContext, ResolvedComponent, ComponentKind, ComponentCategory };
