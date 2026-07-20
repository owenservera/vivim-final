'use client';

/**
 * components/canvas/CanvasSurface.tsx
 * --------------------------------------------------------------------
 * THE shell. Single HTML surface; every visible region is a hot-swappable
 * node rendered from a resolved CanvasDefinition / UIComponentRegistry row.
 *
 * The shell is dumb by design (invariant 3, P2):
 *   - No provider conditionals (no `if (slug === 'chatgpt')`)
 *   - No hardcoded tool/theme/renderer registries
 *   - No CDP, no fetch URLs, no provider selectors
 *   - Just pan/zoom + node placement + sandboxed rendering
 *
 * The richness lives in:
 *   - the backend routeSync resolver (data-driven)
 *   - the published CanvasDefinition rows (DB-driven UI)
 *   - the UIComponentRegistry (live React component hot-swap)
 *
 * Harvested from POC: world↔screen transforms (transform.ts),
 * QuadTree viewport culling (quad-tree.ts), CommandStack undo/redo
 * (command-stack.ts). The POC's Scene/Node/Renderer classes are NOT
 * imported (they violate invariants — hardcoded tools/themes).
 */

import { useCallback, useMemo, useState } from 'react';
import { CanvasNode } from './CanvasNode';
import { useResolvedNodes } from './use-resolved-nodes';
import { useCanvasEvents } from './use-canvas-events';
import { CommandStack } from './command-stack';
import { QuadTree, type BoundingBox } from './quad-tree';
import type { CanvasLayout } from '../../shared/canvas-types';
import type { ResolvedSlot, RouteContext } from '../../shared/route-context';

export interface CanvasSurfaceProps {
  workspaceId: string;
  userId: string;
  providerIds: string[];
  accounts: RouteContext['accounts'];
  slotIds?: string[];
  variant?: string;
  onCapabilityRequest?: (capability: string, input: Record<string, unknown>) => Promise<unknown>;
}

const DEFAULT_VIEWPORT = { x: 0, y: 0, zoom: 1 };

// Default layout for each slot — mirrors bundle 01 §5.1 SEED_NODES pattern.
const DEFAULT_LAYOUTS: Record<string, CanvasLayout> = {
  'chat.header': { x: -320, y: -260, z: 10, w: 640, h: 56 },
  'chat.sidebar': { x: -560, y: -180, z: 5, w: 240, h: 480 },
  'chat.thread': { x: -320, y: -180, z: 5, w: 480, h: 360 },
  'chat.composer': { x: -320, y: 200, z: 5, w: 480, h: 100 },
  'chat.entry': { x: -320, y: -180, z: 8, w: 480, h: 360 },
  'chat.bubble': { x: 200, y: -180, z: 5, w: 280, h: 80 },
  'chat.send': { x: 200, y: 200, z: 5, w: 100, h: 36 },
  'chat.attach': { x: 320, y: 200, z: 5, w: 100, h: 36 },
  'chat.streaming': { x: 200, y: -260, z: 5, w: 240, h: 32 },
  'chat.result': { x: 200, y: -100, z: 5, w: 280, h: 240 },
  'chat.confirm': { x: 0, y: 0, z: 50, w: 320, h: 120 },
  'chat.error': { x: -320, y: -340, z: 50, w: 480, h: 40 },
  'chat.actionBar': { x: -320, y: 320, z: 5, w: 640, h: 44 },
};

export function CanvasSurface({
  workspaceId,
  userId,
  providerIds,
  accounts,
  slotIds,
  variant,
  onCapabilityRequest,
}: CanvasSurfaceProps) {
  const [viewport, setViewport] = useState(DEFAULT_VIEWPORT);
  const [layouts, setLayouts] = useState<Record<string, CanvasLayout>>({});
  const [history] = useState(() => new CommandStack(200));

  // Resolve the surface. This is the data-driven path — no hardcoded branches.
  const slotsToResolve = slotIds ?? Object.keys(DEFAULT_LAYOUTS);
  const { data: surface, isLoading, error } = useResolvedNodes({
    workspaceId,
    userId,
    providerIds,
    accounts,
    slotIds: slotsToResolve,
    variant,
  });

  // Subscribe to live events (canvas:def:updated, workspace:reresolved, etc.)
  // — invalidates the query, which refetches and re-renders the diff.
  useCanvasEvents(workspaceId);

  // Build a stable layout map: prefer user-saved layouts, fall back to defaults.
  const effectiveLayouts = useMemo(() => {
    const out: Record<string, CanvasLayout> = { ...DEFAULT_LAYOUTS };
    for (const slot of surface?.slots ?? []) {
      const key = `${slot.providerId}:${slot.slotId}`;
      out[key] = layouts[key] ?? out[slot.slotId] ?? { x: 0, y: 0, z: 0, w: 320, h: 240 };
    }
    return out;
  }, [surface, layouts]);

  // QuadTree viewport culling (W2): only mount visible nodes.
  const visibleSlots = useMemo(() => {
    if (!surface) return [] as ResolvedSlot[];
    const viewportBB: BoundingBox = {
      x: viewport.x - 800,
      y: viewport.y - 600,
      width: 1600,
      height: 1200,
    };
    const qt = new QuadTree<{ slot: ResolvedSlot; layout: CanvasLayout }>({
      x: -10_000,
      y: -10_000,
      width: 20_000,
      height: 20_000,
    });
    for (const slot of surface.slots) {
      const key = `${slot.providerId}:${slot.slotId}`;
      const layout = effectiveLayouts[key];
      if (!layout) continue;
      qt.insert({
        bb: { x: layout.x, y: layout.y, width: layout.w, height: layout.h },
        data: { slot, layout },
      });
    }
    return qt.queryBB(viewportBB).map((entry) => entry.slot);
  }, [surface, effectiveLayouts, viewport]);

  const handleLayoutChange = useCallback(
    (instanceId: string, next: CanvasLayout) => {
      const cmd = {
        id: `layout:${instanceId}:${Date.now()}`,
        description: `move/resize ${instanceId}`,
        execute: () => setLayouts((prev) => ({ ...prev, [instanceId]: next })),
        undo: () =>
          setLayouts((prev) => {
            const copy = { ...prev };
            delete copy[instanceId];
            return copy;
          }),
      };
      history.execute(cmd);
    },
    [history],
  );

  const onWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      // Pinch-zoom
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setViewport((vp) => ({ ...vp, zoom: Math.max(0.1, Math.min(4, vp.zoom * delta)) }));
    } else {
      // Pan
      setViewport((vp) => ({
        x: vp.x + e.deltaX / vp.zoom,
        y: vp.y + e.deltaY / vp.zoom,
        zoom: vp.zoom,
      }));
    }
  }, []);

  const onKey = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault();
          history.undo();
        } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
          e.preventDefault();
          history.redo();
        }
      }
    },
    [history],
  );

  if (isLoading) {
    return (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'ui-sans-serif, system-ui',
          color: '#888',
        }}
      >
        <div>Resolving canvas…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'ui-sans-serif, system-ui',
          color: '#b91c1c',
        }}
      >
        <div>Canvas error: {String(error)}</div>
      </div>
    );
  }

  return (
    <div
      tabIndex={0}
      onWheel={onWheel}
      onKeyDown={onKey}
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        background:
          'radial-gradient(circle at 50% 50%, #fafafa 0%, #f0f0f0 100%)',
        cursor: 'default',
      }}
    >
      {/* Grid background (world-space, scales with zoom) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(to right, rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.04) 1px, transparent 1px)',
          backgroundSize: `${40 * viewport.zoom}px ${40 * viewport.zoom}px`,
          backgroundPosition: `${-viewport.x * viewport.zoom}px ${-viewport.y * viewport.zoom}px`,
        }}
      />

      {/* Nodes — each is a draggable/resizable SandboxedNode host */}
      {visibleSlots.map((slot) => {
        const key = `${slot.providerId}:${slot.slotId}`;
        const layout = effectiveLayouts[key] ?? { x: 0, y: 0, z: 0, w: 320, h: 240 };
        return (
          <CanvasNode
            key={key}
            slot={slot}
            layout={layout}
            viewport={viewport}
            onLayoutChange={handleLayoutChange}
            onCapabilityRequest={onCapabilityRequest}
          />
        );
      })}

      {/* HUD: workspace + viewport + slot count */}
      <div
        style={{
          position: 'absolute',
          bottom: 12,
          left: 12,
          padding: '6px 10px',
          borderRadius: 6,
          background: 'rgba(255,255,255,0.92)',
          border: '1px solid rgba(0,0,0,0.08)',
          fontFamily: 'ui-sans-serif, system-ui',
          fontSize: 11,
          color: '#444',
          pointerEvents: 'none',
        }}
      >
        <div>
          <strong>ws:</strong> {workspaceId}
        </div>
        <div>
          <strong>zoom:</strong> {viewport.zoom.toFixed(2)} ×
        </div>
        <div>
          <strong>nodes:</strong> {visibleSlots.length} / {surface?.slots.length ?? 0}
        </div>
        <div>
          <strong>trace:</strong>{' '}
          <code style={{ fontSize: 10 }}>{surface?.traceId.slice(0, 12)}…</code>
        </div>
      </div>
    </div>
  );
}
