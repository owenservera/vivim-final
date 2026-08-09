/**
 * engines/route-sync.ts
 * --------------------------------------------------------------------
 * THE routeSync engine (bundle 02 §B.2 + §B.3 + §B.4).
 *
 * Synchronous 6-level tree walk: provider+variant → provider →
 * family+variant → family → cross-type → system. First published hit
 * wins. Exact variant match (no normalization — S98). Skip draft and
 * deprecated (S66/S67/S68).
 *
 * Tier gating (B.4): resolveActions(capabilityId, planTier) applies
 * minPlanTier + CapabilityTier overrides → visible/enabled action set.
 *
 * Coupling: every routeSync() call carries ONE traceId (bundle 02 §C.1).
 * Decoupling: emits `canvas:surface:resolved` on the event bus, fire-and-
 * forget. The synchronous return NEVER awaits the bus (bundle 02 §G.1).
 */

import type { CapabilityEventBus } from './capability-event-bus';
import type { StructuredLogger } from './structured-logger';
import type { Primitive, ResolutionTier } from '../shared/conceptual-model';
import type {
  AccountContext,
  PlanTier,
  ResolvedAction,
  ResolvedSlot,
  ResolvedSurface,
  RouteContext,
} from '../shared/route-context';
import { TIER_RANK } from '../shared/route-context';
import type { AccountStore } from '../storage/contracts/account-store';
import type { CapabilityTierStore } from '../storage/contracts/capability-tier-store';
import type { PrimitiveStore } from '../storage/contracts/primitive-store';
import type { ProviderStore } from '../storage/contracts/provider-store';
import type { ProviderTypeStore } from '../storage/contracts/provider-type-store';
import type { UiComponentStore } from '../storage/contracts/ui-component-store';

import { primitiveToSlotId } from '../shared/conceptual-model';

/**
 * Module-level change-detection cache (loop guard).
 *
 * Every routeSync() emits `canvas:surface:resolved` on the event bus. That
 * event is forwarded over SSE to the browser, which invalidates the
 * `['canvas:resolve']` query → refetches this very route → emits again →
 * ... (a runaway feedback loop; observed ~20 req/s with a growing
 * `SyntaxError: Unexpected end of JSON input` storm at route.ts:36).
 *
 * To break the loop we only emit when the resolved surface actually CHANGED
 * for a workspace. Identical re-resolves emit nothing, so SSE invalidation
 * stops and the loop dies. Cross-tab hot-swap still works because real
 * changes (tier upgrade, provider added/removed, slot def update) produce a
 * different signature → emit → other tabs refetch.
 */
const lastEmittedSignatureByWorkspace = new Map<string, string>();

/** Deterministic content signature of a resolved surface (excludes volatile fields). */
function surfaceSignature(surface: ResolvedSurface): string {
  // Sort slots by providerId:slotId so re-resolves with the same content
  // (but possibly different iteration order) produce an identical signature.
  const slots = [...surface.slots].sort((a, b) =>
    `${a.providerId}:${a.slotId}`.localeCompare(`${b.providerId}:${b.slotId}`),
  );
  return JSON.stringify(slots);
}

export interface RouteSyncDeps {
  eventBus: CapabilityEventBus;
  logger: StructuredLogger;
  uiComponentStore: UiComponentStore;
  providerTypeStore: ProviderTypeStore;
  primitiveStore: PrimitiveStore;
  providerStore: ProviderStore;
  accountStore: AccountStore;
  capabilityTierStore: CapabilityTierStore;
}

/**
 * Map a slotId like `chat.send` → primitiveId `slot:chat.send`.
 *
 * primitiveId is SLOT-LEVEL (family-agnostic). The 6-level tree walk
 * encodes the family/provider distinction via `scope` + `ownerId`, NOT
 * via the primitiveId. This is what makes cross-type rows truly SHARED
 * across all families (S01: 4 providers × 4 families → 1 cross-type row).
 */
export function slotToPrimitive(slotId: string, _familySlug?: string): string {
  return `slot:${slotId}`;
}

/** Resolve families for N providers (bundle 02 §B.2 step 2). */
export async function resolveFamilies(
  providerIds: string[],
  providerStore: ProviderStore,
  providerTypeStore: ProviderTypeStore,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const providerId of providerIds) {
    const def = await providerStore.getDefinition(providerId);
    if (!def?.providerTypeId) continue;
    const family = await providerTypeStore.get(def.providerTypeId);
    if (family) {
      out.set(providerId, family.id);
    }
  }
  return out;
}

/**
 * resolveActions (bundle 02 §B.4) — applies minPlanTier + CapabilityTier
 * override to produce the visible/enabled action set for a capability.
 */
export async function resolveActions(
  capabilityId: string,
  planTier: PlanTier,
  store: CapabilityTierStore,
): Promise<ResolvedAction[]> {
  const cap = await store.getTaxonomy(capabilityId);
  if (!cap) return [];
  // S10/S51/S52: tier < minPlanTier → all actions hidden.
  if (TIER_RANK[planTier] < TIER_RANK[cap.minPlanTier]) {
    return [];
  }
  const tierRow = await store.getTier(capabilityId, planTier);
  const baseActions: ResolvedAction[] = JSON.parse(cap.baseActionsJson || '[]') as ResolvedAction[];
  if (!tierRow) return baseActions;
  // S53/S56/S57/S58: tier override merges customConfig + caps actions.
  const customConfig = tierRow.customConfigJson
    ? (JSON.parse(tierRow.customConfigJson) as Record<string, unknown>)
    : undefined;
  return baseActions.map((a) => ({
    ...a,
    enabled: a.enabled !== false, // default true unless explicitly false
    tierOverride: a.tierOverride ?? (customConfig || tierRow.maxFileSize || tierRow.maxOptions
      ? {
          maxFileSize: tierRow.maxFileSize,
          maxOptions: tierRow.maxOptions,
          customConfig,
        }
      : undefined),
  }));
}

/**
 * The synchronous routeSync. Returns a fully resolved surface in ONE pass.
 * Bundle 02 §B.2 lines 1-18 are the COUPLED phase; line 19-20 are the
 * DECOUPLED emit (fire-and-forget). The caller gets the surface before
 * the emit completes.
 */
export async function routeSync(ctx: RouteContext, deps: RouteSyncDeps): Promise<ResolvedSurface> {
  const startedAt = Date.now();
  const span = deps.logger.start(ctx.traceId, 'route:sync', 'routeSync', {
    workspaceId: ctx.workspaceId,
    providerCount: ctx.providerIds.length,
    slotCount: ctx.slotIds.length,
  });

  // Step 2: resolve families for all providers (FK walk, S95).
  const familyMap = await resolveFamilies(ctx.providerIds, deps.providerStore, deps.providerTypeStore);

  const slots: ResolvedSlot[] = [];

  // Step 4-15: nested loop over providers × slots.
  for (let providerIndex = 0; providerIndex < ctx.providerIds.length; providerIndex++) {
    const providerId = ctx.providerIds[providerIndex]!;
    const familyId = familyMap.get(providerId);
    if (!familyId) {
      // S95: provider has no family link → all slots fall to system default.
      for (const slotId of ctx.slotIds) {
        slots.push({
          providerId,
          slotId,
          primitive: {
            id: slotToPrimitive(slotId, 'custom'),
            scope: 'cross-type',
            familyId: null,
            providerId: null,
            label: slotId,
            description: null,
            defaultRegion: { x: 0, y: 0, z: 0, w: 320, h: 240 },
            version: 1,
          },
          component: null,
          tier: 'system',
          fromSystemDefault: true,
          accountTier: 'anonymous',
          actions: [],
        });
      }
      continue;
    }

    const familyRow = await deps.providerTypeStore.get(familyId);
    if (!familyRow) continue;
    const familySlug = familyRow.slug;

    // S09/S50/S76/S86: when a provider appears multiple times in ctx.providerIds,
    // align accounts by index so each instance gets its OWN account/tier.
    const accountTier = await resolveAccountTier(
      ctx.accounts,
      providerId,
      providerIndex,
      deps.accountStore,
    );

    for (const slotId of ctx.slotIds) {
      // Step 7-12: 6-level tree walk via UiComponentStore.resolve.
      const primitiveId = slotToPrimitive(slotId, familySlug);
      const resolved = await deps.uiComponentStore.resolve({
        primitiveId,
        providerId,
        familyId,
        variant: ctx.variant,
      });

      // Fetch the primitive row (for defaultRegion + label).
      const primRow = await deps.primitiveStore.get(primitiveId);
      const primitive: Primitive = primRow
        ? deps.primitiveStore.toDomain(primRow)
        : {
            id: primitiveId,
            scope: 'cross-type',
            familyId,
            providerId: null,
            label: slotId,
            description: null,
            defaultRegion: { x: 0, y: 0, z: 0, w: 320, h: 240 },
            version: 1,
          };

      // Step 13: resolve actions for the capability backing this slot.
      // Strip the `chat.` namespace so 'chat.attach' → 'cap:canvas:attach'
      // matches the taxonomy id (S53/S56/S58/S60).
      const capabilityId = `cap:canvas:${slotId.replace(/^chat\./, '')}`;
      const actions = await resolveActions(capabilityId, accountTier, deps.capabilityTierStore);

      slots.push({
        providerId,
        slotId,
        primitive,
        component: resolved.component,
        tier: resolved.tier,
        fromSystemDefault: resolved.fromSystemDefault,
        accountTier,
        actions,
      });
    }
  }

  const durationMs = Date.now() - startedAt;
  deps.logger.end(span, { slotCount: slots.length, durationMs, ok: true });

  const surface: ResolvedSurface = {
    traceId: ctx.traceId,
    workspaceId: ctx.workspaceId,
    slots,
    resolvedAt: Date.now(),
    durationMs,
  };

  // Step 19-20: DECOUPLED emit. The synchronous return below does NOT
  // wait for any consumer of this event (Governor Canon).
  // Change-detection guard: only emit when the surface content changed for
  // this workspace. This breaks the SSE → query-invalidation → refetch →
  // re-emit feedback loop (every identical re-resolve would otherwise
  // broadcast an event that makes the browser refetch the same route).
  const signature = surfaceSignature(surface);
  if (lastEmittedSignatureByWorkspace.get(ctx.workspaceId) !== signature) {
    lastEmittedSignatureByWorkspace.set(ctx.workspaceId, signature);
    deps.eventBus.emit({
      type: 'canvas:surface:resolved',
      traceId: ctx.traceId,
      workspaceId: ctx.workspaceId,
      slotCount: slots.length,
      durationMs,
    });
  }

  return surface;
}

async function resolveAccountTier(
  accounts: AccountContext[],
  providerId: string,
  providerIndex: number,
  accountStore: AccountStore,
): Promise<PlanTier> {
  // S09/S50/S76/S86: when a provider appears multiple times in ctx.providerIds,
  // the i-th instance uses the i-th account that matches the provider.
  // First, try a direct index match (providerIds[i] ↔ accounts[i]).
  if (accounts[providerIndex] && accounts[providerIndex]!.providerId === providerId) {
    return accounts[providerIndex]!.planTier;
  }
  // Otherwise, find the (providerIndex+1)-th account matching this provider.
  let matchCount = 0;
  for (const a of accounts) {
    if (a.providerId === providerId) {
      if (matchCount === providerIndex) return a.planTier;
      matchCount += 1;
    }
  }
  // Fall back to store lookup (e.g. when only accountId is provided).
  for (const a of accounts) {
    const tier = await accountStore.tierFor(a.accountId, providerId);
    if (tier !== 'anonymous') return tier;
  }
  return 'anonymous';
}

/**
 * onContextChange (bundle 02 §D) — re-couple a new synchronous pass
 * under a NEW traceId, then emit a delta so the frontend decouples the
 * heavy re-resolve. S54 (live tier upgrade), S79 (WS switch),
 * S96 (same provider diff tier per WS), S97 (provider deleted).
 */
export async function onContextChange(
  prevSurface: ResolvedSurface,
  nextCtx: RouteContext,
  deps: RouteSyncDeps,
): Promise<{ next: ResolvedSurface; delta: SurfaceDelta }> {
  const next = await routeSync(nextCtx, deps);
  const delta = diffSurfaces(prevSurface, next);
  deps.eventBus.emit({
    type: 'workspace:reresolved',
    traceId: nextCtx.traceId,
    workspaceId: nextCtx.workspaceId,
    delta,
  });
  return { next, delta };
}

export interface SurfaceDelta {
  added: ResolvedSlot[];
  removed: string[]; // slot keys `${providerId}:${slotId}`
  changed: ResolvedSlot[];
}

export function diffSurfaces(prev: ResolvedSurface, next: ResolvedSurface): SurfaceDelta {
  const prevMap = new Map<string, ResolvedSlot>();
  for (const s of prev.slots) prevMap.set(`${s.providerId}:${s.slotId}`, s);
  const nextMap = new Map<string, ResolvedSlot>();
  for (const s of next.slots) nextMap.set(`${s.providerId}:${s.slotId}`, s);

  const added: ResolvedSlot[] = [];
  const removed: string[] = [];
  const changed: ResolvedSlot[] = [];

  for (const [key, nextSlot] of nextMap) {
    const prevSlot = prevMap.get(key);
    if (!prevSlot) {
      added.push(nextSlot);
    } else if (
      prevSlot.tier !== nextSlot.tier ||
      prevSlot.component?.id !== nextSlot.component?.id ||
      prevSlot.accountTier !== nextSlot.accountTier ||
      actionsDiffer(prevSlot.actions, nextSlot.actions)
    ) {
      changed.push(nextSlot);
    }
  }
  for (const key of prevMap.keys()) {
    if (!nextMap.has(key)) removed.push(key);
  }
  return { added, removed, changed };
}

function actionsDiffer(a: ResolvedAction[], b: ResolvedAction[]): boolean {
  if (a.length !== b.length) return true;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i]!;
    const bi = b[i]!;
    if (ai.capabilityId !== bi.capabilityId || ai.enabled !== bi.enabled) return true;
  }
  return false;
}

/** Re-export for tests. */
export { primitiveToSlotId };
export type { ResolutionTier };
