/**
 * engines/route-sync-workspace.ts
 * --------------------------------------------------------------------
 * routeSyncWorkspace — the workspace-aware 6-level tree walk.
 *
 * Same shape, same determinism, same first-hit-wins semantics as the
 * provider chain (routeSync.ts). The chain here is:
 *
 *   workspace+surface+region → workspace+surface → workspace →
 *   cross-workspace → system
 *
 * Card kinds (Phase 2): 'doc' | 'video' | 'audio' | 'automation' |
 * 'agent' | 'shell' | 'chat'. Each kind maps to a slot id
 * (docs.viewer, media.player, automation.builder, agents.canvas,
 * shell.terminal, chat.X).
 *
 * The shell stays dumb (P2): 3D z-depth transforms are data-driven
 * from routeSyncWorkspace output (the ResolvedCard.tier + workspace
 * zDepth), never hardcoded.
 *
 * Coupling: every routeSyncWorkspace() call carries ONE traceId.
 * Decoupling: emits `workspace:surface:resolved` on the event bus,
 * fire-and-forget. The synchronous return NEVER awaits the bus.
 */

import type { CapabilityEventBus } from './capability-event-bus';
import type { StructuredLogger } from './structured-logger';
import type { WorkspaceRouteContext, ResolvedCard, ResolvedWorkspaceSurface } from '../shared/workspace-route';
import type { WorkspaceResolutionTier } from '../shared/workspace';
import { WORKSPACE_RESOLUTION_CHAIN, GLOBAL_WORKSPACE_ID } from '../shared/workspace';
import type { UiComponent } from '../shared/ui-component';
import type { UiComponentStore } from '../storage/contracts/ui-component-store';
import type { WorkspaceStore } from '../storage/contracts/workspace-store';
import type { CapabilityTierStore } from '../storage/contracts/capability-tier-store';
import type { PrimitiveScope } from '../shared/conceptual-model';
import { ulid } from '../lib/ulid';

export interface WorkspaceRouteSyncDeps {
  eventBus: CapabilityEventBus;
  logger: StructuredLogger;
  uiComponentStore: UiComponentStore;
  workspaceStore: WorkspaceStore;
  capabilityTierStore: CapabilityTierStore;
}

/** Map a cardKind to its canonical slot id (under the surface namespace). */
export function cardKindToSlot(cardKind: string, surfaceSlug: string): string {
  // chat.* stays as-is (Phase 1 namespacing rule, invariant).
  if (cardKind === 'chat') return `chat.entry`;
  // The new surfaces use their own namespaces: docs.*, media.*, automation.*, agents.*, shell.*
  switch (cardKind) {
    case 'doc':
      return 'docs.viewer';
    case 'video':
    case 'audio':
    case 'image':
    case 'stream':
      return 'media.player';
    case 'automation':
      return 'automation.builder';
    case 'agent':
      return 'agents.canvas';
    case 'shell':
      return 'shell.terminal';
    default:
      return `${surfaceSlug}.${cardKind}`;
  }
}

/**
 * The 5-level workspace tree walk. For each (workspace, surface, region)
 * tier, look up a UiComponent row whose (primitiveId, scope, ownerId,
 * variant) matches the tier. First published hit wins.
 *
 * Tier → (scope, ownerId) mapping:
 *   workspace+surface+region → scope='provider', ownerId=`${workspaceId}|${surfaceSlug}|${regionSlotId}`
 *   workspace+surface        → scope='provider', ownerId=`${workspaceId}|${surfaceSlug}`
 *   workspace                → scope='provider', ownerId=`${workspaceId}`
 *   cross-workspace          → scope='cross-type', ownerId='global'
 *   system                   → fallback (no row)
 *
 * IMPORTANT: we do direct lookups via `uiComponentStore.list()` rather
 * than `uiComponentStore.resolve()`. The latter walks its own 6-level
 * provider chain, which would find cross-workspace rows and misreport
 * them as workspace-tier hits. Here we want a STRICT per-tier match.
 */
export async function resolveCard(
  ctx: WorkspaceRouteContext,
  cardKind: string,
  surfaceSlug: string,
  deps: WorkspaceRouteSyncDeps,
): Promise<ResolvedCard> {
  const slotId = cardKindToSlot(cardKind, surfaceSlug);
  const primitiveId = `slot:${slotId}`;
  const workspaceId = ctx.workspaceId || GLOBAL_WORKSPACE_ID;
  const regionSlotId = ctx.regionSlotId ?? slotId;
  const variant = ctx.variant ?? null;

  // Build the walk: variant-specific rows first (when ctx.variant is set),
  // then base rows, from most-specific to least-specific.
  type TierSpec = { tier: WorkspaceResolutionTier; scope: PrimitiveScope; ownerId: string; variant: string | null };
  const tiers: TierSpec[] = [];
  const regionOwner = `${workspaceId}|${surfaceSlug}|${regionSlotId}`;
  const surfaceOwner = `${workspaceId}|${surfaceSlug}`;
  const workspaceOwner = workspaceId;

  if (variant) {
    tiers.push({ tier: 'workspace+surface+region', scope: 'provider', ownerId: regionOwner, variant });
    tiers.push({ tier: 'workspace+surface', scope: 'provider', ownerId: surfaceOwner, variant });
    tiers.push({ tier: 'workspace', scope: 'provider', ownerId: workspaceOwner, variant });
  }
  tiers.push({ tier: 'workspace+surface+region', scope: 'provider', ownerId: regionOwner, variant: null });
  tiers.push({ tier: 'workspace+surface', scope: 'provider', ownerId: surfaceOwner, variant: null });
  tiers.push({ tier: 'workspace', scope: 'provider', ownerId: workspaceOwner, variant: null });
  tiers.push({ tier: 'cross-workspace', scope: 'cross-type', ownerId: 'global', variant: null });

  for (const t of tiers) {
    const rows = await deps.uiComponentStore.list({
      primitiveId,
      scope: t.scope,
      ownerId: t.ownerId,
    });
    // Match the exact variant (null or string).
    const match = rows.find((r) => r.status === 'published' && (r.variant ?? null) === t.variant);
    if (match) {
      return {
        workspaceId,
        surfaceSlug,
        cardKind,
        slotId,
        definitionId: null,
        component: match,
        tier: t.tier,
        fromSystemDefault: false,
        engineRef: `engine:${cardKind}:${surfaceSlug}`,
      };
    }
  }

  // System fallback.
  return {
    workspaceId,
    surfaceSlug,
    cardKind,
    slotId,
    definitionId: null,
    component: null,
    tier: 'system',
    fromSystemDefault: true,
    engineRef: `engine:${cardKind}:default`,
  };
}

/**
 * The synchronous routeSyncWorkspace. Returns a fully resolved surface
 * in ONE pass. Same coupled/decoupled split as routeSync (bundle 02 §B.2).
 */
export async function routeSyncWorkspace(
  ctx: WorkspaceRouteContext,
  deps: WorkspaceRouteSyncDeps,
): Promise<ResolvedWorkspaceSurface> {
  const startedAt = Date.now();
  const span = deps.logger.start(ctx.traceId, 'route:workspace:sync', 'routeSyncWorkspace', {
    workspaceId: ctx.workspaceId,
    surfaceSlug: ctx.surfaceSlug,
    cardKinds: ctx.cardKinds,
  });

  const ws = await deps.workspaceStore.get(ctx.workspaceId);
  const surface = ws?.surfaces.find((s) => s.slug === ctx.surfaceSlug);
  const zDepth = surface?.zDepth ?? 0;

  const cards: ResolvedCard[] = [];
  for (const cardKind of ctx.cardKinds) {
    const card = await resolveCard(ctx, cardKind, ctx.surfaceSlug ?? 'chat', deps);
    cards.push(card);
  }

  const durationMs = Date.now() - startedAt;
  deps.logger.end(span, { cardCount: cards.length, durationMs, ok: true });

  const result: ResolvedWorkspaceSurface = {
    traceId: ctx.traceId,
    workspaceId: ctx.workspaceId,
    surfaceSlug: ctx.surfaceSlug ?? 'chat',
    cards,
    zDepth,
    resolvedAt: Date.now(),
    durationMs,
  };

  // DECOUPLED emit (Governor Canon — does NOT block the return).
  deps.eventBus.emit({
    type: 'workspace:surface:resolved',
    traceId: ctx.traceId,
    workspaceId: ctx.workspaceId,
    surfaceSlug: ctx.surfaceSlug,
    cardCount: cards.length,
    durationMs,
  });

  return result;
}

/** Re-couple a new routeSyncWorkspace pass under a new traceId (bundle 02 §D). */
export async function onContextChangeWorkspace(
  prev: ResolvedWorkspaceSurface,
  nextCtx: WorkspaceRouteContext,
  deps: WorkspaceRouteSyncDeps,
): Promise<{ next: ResolvedWorkspaceSurface; delta: WorkspaceSurfaceDelta }> {
  const next = await routeSyncWorkspace(nextCtx, deps);
  const delta = diffWorkspaceSurfaces(prev, next);
  deps.eventBus.emit({
    type: 'workspace:surface:reresolved',
    traceId: nextCtx.traceId,
    workspaceId: nextCtx.workspaceId,
    surfaceSlug: nextCtx.surfaceSlug,
    delta,
  });
  return { next, delta };
}

export interface WorkspaceSurfaceDelta {
  added: ResolvedCard[];
  removed: string[]; // card keys `${cardKind}:${slotId}`
  changed: ResolvedCard[];
}

export function diffWorkspaceSurfaces(
  prev: ResolvedWorkspaceSurface,
  next: ResolvedWorkspaceSurface,
): WorkspaceSurfaceDelta {
  const prevMap = new Map<string, ResolvedCard>();
  for (const c of prev.cards) prevMap.set(`${c.cardKind}:${c.slotId}`, c);
  const nextMap = new Map<string, ResolvedCard>();
  for (const c of next.cards) nextMap.set(`${c.cardKind}:${c.slotId}`, c);

  const added: ResolvedCard[] = [];
  const removed: string[] = [];
  const changed: ResolvedCard[] = [];

  for (const [key, nextCard] of nextMap) {
    const prevCard = prevMap.get(key);
    if (!prevCard) {
      added.push(nextCard);
    } else if (
      prevCard.tier !== nextCard.tier ||
      prevCard.component?.id !== nextCard.component?.id ||
      prevCard.engineRef !== nextCard.engineRef
    ) {
      changed.push(nextCard);
    }
  }
  for (const key of prevMap.keys()) {
    if (!nextMap.has(key)) removed.push(key);
  }
  return { added, removed, changed };
}

export { ulid, WORKSPACE_RESOLUTION_CHAIN };
export type { WorkspaceResolutionTier, UiComponent };
