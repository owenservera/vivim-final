/**
 * storage/contracts/ui-component-store.ts
 * --------------------------------------------------------------------
 * Contract for the 6-level UiComponent resolver. Engines depend on this;
 * implementations live in `storage/impl/*` (B2 invariant).
 */

import type { PrimitiveScope, ResolutionTier } from '../../shared/conceptual-model';
import type { UiComponent } from '../../shared/ui-component';

export interface ResolveContext {
  primitiveId: string;
  providerId: string;
  familyId: string;
  variant?: string;
}

export interface ResolveResult {
  component: UiComponent | null;
  tier: ResolutionTier;
  fromSystemDefault: boolean;
}

export interface UiComponentStore {
  /** 6-level tree walk (bundle 02 §B.3). First published hit wins. */
  resolve(ctx: ResolveContext): Promise<ResolveResult>;
  /** Direct row lookup. */
  get(id: string): Promise<UiComponent | null>;
  /** Insert or update a row. */
  upsert(input: Omit<UiComponent, 'createdAt' | 'updatedAt' | 'version'> & { version?: number }): Promise<UiComponent>;
  /** Logical delete (status=deprecated). */
  deprecate(id: string): Promise<boolean>;
  /** Snapshot list (debug/test only). */
  list(filter?: { primitiveId?: string; ownerId?: string; scope?: PrimitiveScope }): Promise<UiComponent[]>;
}
