/**
 * engines/adaptive-workspace.ts
 * --------------------------------------------------------------------
 * Workspace remix model (bundle 02 §A.4 + Block 5/8 scenarios).
 * A workspace carries 1..N providers, each with its own account/tier.
 * Switching workspaces re-resolves the surface under a NEW traceId
 * (bundle 02 §D onContextChange).
 */

import type { ResolvedSurface, RouteContext } from '../shared/route-context';
import type { AccountContext } from '../shared/route-context';
import type { CapabilityEventBus } from './capability-event-bus';
import type { StructuredLogger } from './structured-logger';
import type { RouteSyncDeps } from './route-sync';
import { onContextChange, routeSync } from './route-sync';

export type WorkspaceMode = 'single' | 'multi' | 'compare' | 'remix';

export interface Workspace {
  id: string;
  userId: string;
  name: string;
  mode: WorkspaceMode;
  providerIds: string[];
  accounts: AccountContext[];
}

export class AdaptiveWorkspace {
  constructor(
    private deps: RouteSyncDeps,
    private eventBus: CapabilityEventBus,
    private logger: StructuredLogger,
  ) {}

  /**
   * Switch workspace — re-couple a new routeSync under a new traceId.
   * The frontend applies the delta only (bundle 02 §D, S79).
   */
  async switchWorkspace(
    prevSurface: ResolvedSurface | null,
    next: Workspace,
    slotIds: string[],
    traceId: string,
  ): Promise<{ surface: ResolvedSurface; delta: import('./route-sync').SurfaceDelta | null }> {
    const ctx: RouteContext = {
      traceId,
      workspaceId: next.id,
      userId: next.userId,
      providerIds: next.providerIds,
      accounts: next.accounts,
      slotIds,
    };
    if (!prevSurface) {
      const surface = await routeSync(ctx, this.deps);
      return { surface, delta: null };
    }
    const { next: surface, delta } = await onContextChange(prevSurface, ctx, this.deps);
    return { surface, delta };
  }
}
