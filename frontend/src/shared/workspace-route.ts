/**
 * shared/workspace-route.ts
 * --------------------------------------------------------------------
 * Workspace-aware route context. Extends RouteContext with the
 * workspace/surface/region taxonomy so routeSyncWorkspace can apply
 * the same 6-level precedence as routeSync (provider+variant → …).
 *
 * The chain here is (most-specific → least-specific):
 *   workspace+surface+region → workspace+surface → workspace →
 *   cross-workspace → system
 *
 * Same shape, same determinism, same first-hit-wins semantics as the
 * provider chain. A `ws:global` workspace is ALWAYS resolvable.
 */

import type { WorkspaceResolutionTier } from './workspace';
import type { PlanTier } from './route-context';

export interface WorkspaceRouteContext {
  traceId: string;
  workspaceId: string;
  surfaceSlug?: string; // current surface (chat / docs / media / automation / agents / shell)
  regionSlotId?: string; // current region slot (chat.composer, docs.viewer, …)
  userId: string;
  providerIds: string[];
  accountTiers: PlanTier[]; // per-provider tiers (aligned by index)
  /** Card kinds to resolve (e.g. 'doc', 'video', 'audio', 'automation', 'agent', 'shell'). */
  cardKinds: string[];
  variant?: string;
}

export interface ResolvedCard {
  workspaceId: string;
  surfaceSlug: string;
  cardKind: string;
  /** Card slot id (e.g. docs.viewer, automation.builder, agents.canvas). */
  slotId: string;
  /** The CanvasDefinition row that renders this card. */
  definitionId: string | null;
  /** UiComponent row carrying the html/css/scriptUrl. */
  component: import('./ui-component').UiComponent | null;
  /** Which workspace-tier won. */
  tier: WorkspaceResolutionTier;
  /** True when no row exists — caller uses the built-in default. */
  fromSystemDefault: boolean;
  /** Engine reference (e.g. 'engine:document:pdf') — plugins can hot-swap. */
  engineRef: string | null;
}

export interface ResolvedWorkspaceSurface {
  traceId: string;
  workspaceId: string;
  surfaceSlug: string;
  cards: ResolvedCard[];
  /** 3D z-depth of this surface (workspace stack). */
  zDepth: number;
  resolvedAt: number;
  durationMs: number;
}
