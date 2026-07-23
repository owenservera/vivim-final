/**
 * canvas/live-config.ts (G2 backend)
 * --------------------------------------------------------------------
 * Live-config toolkit for in-place editing of published
 * CanvasDefinitions. Patches html/css/bindings/layout/sandbox,
 * bumps version, emits `canvas:def:updated` on the bus so mounted
 * nodes re-render without page reload.
 *
 * Also exposes `reresolve(ctx)` — re-runs routeSync against the
 * current store and returns a fresh node tree. And `observeContext(cb)`
 * for subscribing to context-change events that trigger reresolve.
 */

import type { CapabilityEventBus } from '../engines/capability-event-bus';
import type { StructuredLogger } from '../engines/structured-logger';
import type { CanvasDefinition, CanvasLayout, LayerBinding, SandboxPolicy } from '../shared/canvas-types';
import type { ResolvedSurface, RouteContext } from '../shared/route-context';
import type { CanvasDefinitionStore } from '../storage/contracts/canvas-definition-store';
import type { CanvasDefinitionInput } from '../storage/contracts/canvas-definition-store';
import type { RouteSyncDeps } from '../engines/route-sync';
import { routeSync } from '../engines/route-sync';
import { ulid } from '../lib/ulid';

export interface LiveConfigDeps {
  canvasDefinitionStore: CanvasDefinitionStore;
  eventBus: CapabilityEventBus;
  logger: StructuredLogger;
  routeSyncDeps: RouteSyncDeps;
}

export interface DefinitionPatch {
  html?: string;
  css?: string;
  scriptUrl?: string;
  bindings?: LayerBinding[];
  layout?: CanvasLayout;
  sandbox?: SandboxPolicy;
  status?: 'draft' | 'published' | 'deprecated';
  tags?: string[];
  name?: string;
  description?: string;
}

/**
 * G2.1 — patchDefinition(id, partial): live-edit a published
 * CanvasDefinition. Bumps version, emits `canvas:def:updated`.
 * Mounted nodes listening via useCanvasEvents re-render from the
 * new blob WITHOUT page reload (invariant 7: Live, not build).
 */
export async function patchDefinition(
  id: string,
  patch: DefinitionPatch,
  deps: LiveConfigDeps,
): Promise<CanvasDefinition> {
  // P8: forbid inline <script> in patched html.
  if (patch.html && /<script\b[^>]*>/i.test(patch.html)) {
    throw new Error(
      'P8 violation: inline <script> tags are forbidden in CanvasDefinition.html',
    );
  }
  // P8: sandbox.allowInlineScript must be false (literal type enforces this).
  if (patch.sandbox && (patch.sandbox.allowInlineScript as unknown) !== false) {
    throw new Error('P8 violation: allowInlineScript must be false');
  }

  const updated = await deps.canvasDefinitionStore.update(id, patch as Partial<CanvasDefinitionInput>);
  deps.eventBus.emit({
    type: 'canvas:def:updated',
    definitionId: updated.id,
    slug: updated.slug,
    version: updated.version,
  });
  deps.logger.info('live-config', `patched ${updated.slug} → v${updated.version}`, {
    definitionId: updated.id,
  });
  return updated;
}

/**
 * G2.2 — reresolve(ctx): re-runs routeSync against the current store
 * under a NEW traceId. Returns a fresh resolved surface. Used by the
 * live-config toolkit when bindings/layout/sandbox change to verify
 * the new resolution path (bundle 02 §D onContextChange).
 */
export async function reresolve(
  ctx: RouteContext,
  deps: LiveConfigDeps,
): Promise<ResolvedSurface> {
  return routeSync(ctx, deps.routeSyncDeps);
}

/**
 * G2.3 — observeContext(cb): subscribes to context-change events on
 * the bus (`account:plan_tier_changed`, `provider:added`, etc.) and
 * invokes cb with the new context so the caller can re-resolve.
 *
 * Returns a disposer.
 */
export function observeContext(
  cb: (event: { type: string; traceId: string; workspaceId?: string }) => void,
  deps: LiveConfigDeps,
): () => void {
  const handler = (event: unknown) => {
    const e = event as { type: string; [k: string]: unknown };
    if (
      e.type === 'account:plan_tier_changed' ||
      e.type === 'provider:added' ||
      e.type === 'workspace:switched' ||
      e.type === 'canvas:def:updated'
    ) {
      cb({
        type: e.type,
        traceId: (e.traceId as string) ?? ulid(),
        workspaceId: e.workspaceId as string | undefined,
      });
    }
  };
  return deps.eventBus.on('account:plan_tier_changed', handler as never) &&
    deps.eventBus.on('provider:added', handler as never) &&
    deps.eventBus.on('workspace:switched', handler as never) &&
    deps.eventBus.on('canvas:def:updated', handler as never);
}
