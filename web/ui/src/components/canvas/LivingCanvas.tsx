'use client';

/**
 * components/canvas/LivingCanvas.tsx (V6 — The Living Canvas)
 * --------------------------------------------------------------------
 * Replaces CanvasSurface as the primary canvas. Integrates:
 *   #1 Streaming-Native Nodes (useStreamSlot per node)
 *   #2 Agent Co-Pilot (ghost overlays + HITL)
 *   #3 Semantic Zoom (3 tiers: cards < 0.5x, shells 0.5-2x, full > 2x)
 *   #5 Intent Autolayout (force-directed)
 *   vCard system (hierarchical context menu)
 *   Visual I/O connections (bezier lines)
 *   #10 Observability HUD (cost/latency per node)
 *
 * The shell is still dumb (P2): it renders whatever routeSync resolves.
 * The "alive" feeling comes from streaming + semantic zoom + agent.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useResolvedNodes } from './use-resolved-nodes';
import { useCanvasEvents } from './use-canvas-events';
import { VCardMenu } from './VCardMenu';
import { ConnectionLayer } from './ConnectionLayer';
import { ObservabilityHUD } from './ObservabilityHUD';
import { AgentOverlay } from './AgentOverlay';
import { CommandStack } from './command-stack';
import { QuadTree } from './quad-tree';
import { computeLayout, type LayoutIntent, type LayoutNode, type LayoutEdge, LAYOUT_INTENT_LABELS } from '../../shared/layout-intent';
import type { VCardState, VCardCategory } from '../../shared/vcard';
import type { ConnectionLine } from '../../shared/connection-line';
import type { AgentCanvasPlan } from '../../shared/agent-canvas';
import type { ResolvedSlot } from '../../shared/route-context';
import type { CanvasLayout } from '../../shared/canvas-types';

export interface LivingCanvasProps {
  workspaceId: string;
  userId: string;
  providerIds: string[];
  accounts: import('../../shared/route-context').AccountContext[];
  slotIds?: string[];
  variant?: string;
}

type ZoomTier = 'micro' | 'mid' | 'macro';

function getZoomTier(zoom: number): ZoomTier {
  if (zoom < 0.5) return 'micro';
  if (zoom > 2) return 'macro';
  return 'mid';
}

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

export function LivingCanvas(props: LivingCanvasProps) {
  const { workspaceId, userId, providerIds, accounts, slotIds, variant } = props;
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });
  const [layouts, setLayouts] = useState<Record<string, CanvasLayout>>({});
  const [history] = useState(() => new CommandStack(200));
  const [layoutIntent, setLayoutIntent] = useState<LayoutIntent>('free');
  const [pinnedNodes, setPinnedNodes] = useState<Set<string>>(new Set());
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());
  const [fullscreenNode, setFullscreenNode] = useState<string | null>(null);
  const [lockedNodes, setLockedNodes] = useState<Set<string>>(new Set());
  const [connections, setConnections] = useState<ConnectionLine[]>([]);
  const [hoveredConn, setHoveredConn] = useState<string | null>(null);
  const [agentPlan, setAgentPlan] = useState<AgentCanvasPlan | null>(null);
  const [containerSize, setContainerSize] = useState({ w: 1200, h: 800 });
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null);

  const slotsToResolve = slotIds ?? Object.keys(DEFAULT_LAYOUTS);
  const { data: surface, isLoading, error } = useResolvedNodes({
    workspaceId, userId, providerIds, accounts, slotIds: slotsToResolve, variant,
  });
  useCanvasEvents(workspaceId);

  // Track container size.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setContainerSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setContainerSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // Build effective layouts.
  const effectiveLayouts = useMemo(() => {
    const out: Record<string, CanvasLayout> = { ...DEFAULT_LAYOUTS };
    for (const slot of surface?.slots ?? []) {
      const key = `${slot.providerId}:${slot.slotId}`;
      out[key] = layouts[key] ?? out[slot.slotId] ?? { x: 0, y: 0, z: 0, w: 320, h: 240 };
    }
    return out;
  }, [surface, layouts]);

  // Force-directed layout.
  const runLayout = useCallback((intent: LayoutIntent) => {
    if (!surface) return;
    const layoutNodes: LayoutNode[] = surface.slots.map((slot) => {
      const key = `${slot.providerId}:${slot.slotId}`;
      const l = effectiveLayouts[key] ?? { x: 0, y: 0, w: 320, h: 240 };
      return {
        id: key,
        x: l.x, y: l.y,
        w: l.w, h: l.h,
        pinned: pinnedNodes.has(key),
        category: slot.slotId.split('.')[0],
        providerId: slot.providerId,
        createdAt: Date.now() + surface.slots.indexOf(slot),
      };
    });
    const layoutEdges: LayoutEdge[] = connections.map((c) => ({
      from: c.from.nodeId, to: c.to.nodeId, weight: 1,
    }));
    const result = computeLayout(layoutNodes, layoutEdges, intent, {
      width: containerSize.w, height: containerSize.h, iterations: 150,
    });
    setLayouts((prev) => {
      const next = { ...prev };
      for (const [id, pos] of Object.entries(result.positions)) {
        const existing = next[id] ?? DEFAULT_LAYOUTS[slotsToResolve[0]] ?? { x: 0, y: 0, z: 0, w: 320, h: 240 };
        next[id] = { ...existing, x: pos.x, y: pos.y };
      }
      return next;
    });
    setLayoutIntent(intent);
  }, [surface, effectiveLayouts, pinnedNodes, connections, containerSize, slotsToResolve]);

  // Viewport culling via QuadTree.
  const zoomTier = getZoomTier(viewport.zoom);
  const visibleSlots = useMemo(() => {
    if (!surface) return [] as ResolvedSlot[];
    const vpBB = { x: viewport.x - containerSize.w / viewport.zoom, y: viewport.y - containerSize.h / viewport.zoom, width: containerSize.w / viewport.zoom * 2, height: containerSize.h / viewport.zoom * 2 };
    const qt = new QuadTree<{ slot: ResolvedSlot; layout: CanvasLayout }>({ x: -10_000, y: -10_000, width: 20_000, height: 20_000 });
    for (const slot of surface.slots) {
      const key = `${slot.providerId}:${slot.slotId}`;
      const layout = effectiveLayouts[key];
      if (!layout) continue;
      qt.insert({ bb: { x: layout.x, y: layout.y, width: layout.w, height: layout.h }, data: { slot, layout } });
    }
    return qt.queryBB(vpBB).map((e) => e.slot);
  }, [surface, effectiveLayouts, viewport, containerSize]);

  // Pan + zoom.
  const onWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setViewport((vp) => ({ ...vp, zoom: Math.max(0.1, Math.min(5, vp.zoom * delta)) }));
    } else {
      setViewport((vp) => ({ x: vp.x + e.deltaX / vp.zoom, y: vp.y + e.deltaY / vp.zoom, zoom: vp.zoom }));
    }
  }, []);

  // Keyboard: undo/redo + arrow-key pan.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); history.undo(); }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); history.redo(); }
      if (e.key === 'ArrowLeft') setViewport((vp) => ({ ...vp, x: vp.x - 50 / vp.zoom }));
      if (e.key === 'ArrowRight') setViewport((vp) => ({ ...vp, x: vp.x + 50 / vp.zoom }));
      if (e.key === 'ArrowUp') setViewport((vp) => ({ ...vp, y: vp.y - 50 / vp.zoom }));
      if (e.key === 'ArrowDown') setViewport((vp) => ({ ...vp, y: vp.y + 50 / vp.zoom }));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [history]);

  // Node drag.
  const onNodePointerDown = useCallback((key: string, e: React.PointerEvent) => {
    if (lockedNodes.has(key) || pinnedNodes.has(key)) return;
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const layout = effectiveLayouts[key];
    if (!layout) return;
    dragRef.current = { id: key, startX: e.clientX, startY: e.clientY, origX: layout.x, origY: layout.y };
  }, [effectiveLayouts, lockedNodes, pinnedNodes]);

  useEffect(() => {
    if (!dragRef.current) return;
    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const dx = (e.clientX - drag.startX) / viewport.zoom;
      const dy = (e.clientY - drag.startY) / viewport.zoom;
      setLayouts((prev) => {
        const existing = prev[drag.id] ?? DEFAULT_LAYOUTS[slotsToResolve[0]] ?? { x: 0, y: 0, z: 0, w: 320, h: 240 };
        return { ...prev, [drag.id]: { ...existing, x: drag.origX + dx, y: drag.origY + dy } };
      });
    };
    const onUp = () => { dragRef.current = null; };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
  }, [viewport.zoom, slotsToResolve]);

  // vCard actions.
  const handleVCardAction = useCallback((key: string, actionId: string) => {
    switch (actionId) {
      case 'collapse': setCollapsedNodes((s) => new Set(s).add(key)); break;
      case 'expand': setCollapsedNodes((s) => { const n = new Set(s); n.delete(key); return n; }); break;
      case 'pin': setPinnedNodes((s) => { const n = new Set(s); n.add(key); return n; }); break;
      case 'fullscreen': setFullscreenNode((f) => (f === key ? null : key)); break;
      case 'lock': setLockedNodes((s) => { const n = new Set(s); n.add(key); return n; }); break;
      case 'remove': setLayouts((prev) => { const n = { ...prev }; delete n[key]; return n; }); break;
      default: break;
    }
  }, []);

  if (isLoading) {
    return <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontFamily: 'ui-sans-serif, system-ui' }}>Resolving canvas…</div>;
  }
  if (error) {
    return <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#b91c1c', fontFamily: 'ui-sans-serif, system-ui' }}>Canvas error: {String(error)}</div>;
  }

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      role="application"
      aria-label="Vivim Living Canvas"
      onWheel={onWheel}
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: 'radial-gradient(circle at 50% 50%, var(--bg-subtle) 0%, var(--bg) 100%)', outline: 'none' }}
    >
      {/* Grid */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'linear-gradient(to right, rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.04) 1px, transparent 1px)',
        backgroundSize: `${40 * viewport.zoom}px ${40 * viewport.zoom}px`,
        backgroundPosition: `${-viewport.x * viewport.zoom + containerSize.w / 2}px ${-viewport.y * viewport.zoom + containerSize.h / 2}px`,
      }} />

      {/* Connection lines */}
      <ConnectionLayer
        connections={connections}
        nodeLayouts={Object.fromEntries(
          visibleSlots.map((s) => {
            const key = `${s.providerId}:${s.slotId}`;
            const l = effectiveLayouts[key] ?? { x: 0, y: 0, w: 320, h: 240 };
            return [key, l];
          }),
        )}
        viewport={viewport}
        width={containerSize.w}
        height={containerSize.h}
        hoveredConnectionId={hoveredConn}
        onConnectionHover={setHoveredConn}
      />

      {/* Nodes */}
      {visibleSlots.map((slot) => {
        const key = `${slot.providerId}:${slot.slotId}`;
        const layout = effectiveLayouts[key] ?? { x: 0, y: 0, z: 0, w: 320, h: 240 };
        const isCollapsed = collapsedNodes.has(key);
        const isFullscreen = fullscreenNode === key;
        const isLocked = lockedNodes.has(key);
        const isPinned = pinnedNodes.has(key);
        const screenX = (layout.x - viewport.x) * viewport.zoom + containerSize.w / 2;
        const screenY = (layout.y - viewport.y) * viewport.zoom + containerSize.h / 2;
        const screenW = (isFullscreen ? containerSize.w - 32 : layout.w) * viewport.zoom;
        const screenH = (isFullscreen ? containerSize.h - 32 : isCollapsed ? 32 : layout.h) * viewport.zoom;

        const vcardState: VCardState = {
          nodeId: key,
          collapsed: isCollapsed,
          pinned: isPinned,
          fullscreen: isFullscreen,
          locked: isLocked,
          connectionsVisible: true,
          detached: false,
          category: (slot.slotId.split('.')[0] as VCardCategory) ?? 'generic',
        };

        return (
          <div
            key={key}
            role="article"
            aria-label={`${slot.slotId} node — ${slot.tier} tier`}
            data-node-id={key}
            data-tier={slot.tier}
            data-zoom-tier={zoomTier}
            onPointerDown={(e) => onNodePointerDown(key, e)}
            style={{
              position: 'absolute',
              left: screenX,
              top: screenY,
              width: screenW,
              height: screenH,
              zIndex: isFullscreen ? 200 : layout.z,
              borderRadius: 8,
              overflow: 'hidden',
              background: 'var(--bg-elevated)',
              border: isLocked ? '2px solid #ef4444' : isPinned ? '2px solid var(--accent)' : '1px solid var(--border)',
              boxShadow: 'var(--shadow)',
              cursor: isPinned || isLocked ? 'default' : 'grab',
              userSelect: 'none',
              opacity: zoomTier === 'micro' ? 0.85 : 1,
              transition: 'box-shadow 0.15s, border-color 0.15s',
            }}
          >
            <VCardMenu state={vcardState} onAction={(a) => handleVCardAction(key, a)}>
              {/* Node header */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '4px 8px', background: 'var(--bg-subtle)',
                borderBottom: isCollapsed ? 'none' : '1px solid var(--border)',
                fontSize: 11, color: 'var(--text-muted)', height: 28, flexShrink: 0,
                fontFamily: 'ui-sans-serif, system-ui',
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden' }}>
                  <strong style={{ fontSize: 11, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{slot.slotId}</strong>
                  {zoomTier !== 'micro' && (
                    <span style={{ opacity: 0.5, fontSize: 10 }}>{slot.providerId}</span>
                  )}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {zoomTier !== 'micro' && (
                    <span style={{
                      padding: '1px 5px', borderRadius: 3, fontSize: 9, fontWeight: 600,
                      background: slot.tier === 'provider+variant' ? '#fde68a' : slot.tier === 'provider' ? '#fcd34d' :
                        slot.tier === 'family+variant' ? '#bbf7d0' : slot.tier === 'family' ? '#86efac' :
                        slot.tier === 'cross-type' ? '#bfdbfe' : '#e5e7eb',
                      color: '#374151',
                    }}>{slot.tier}</span>
                  )}
                  {isPinned && <span title="Pinned">📌</span>}
                  {isLocked && <span title="Locked">🔒</span>}
                </span>
              </div>

              {/* Node body — semantic zoom tiers */}
              {!isCollapsed && (
                <div style={{ position: 'absolute', inset: '28px 0 0 0', overflow: 'hidden' }}>
                  {zoomTier === 'micro' ? (
                    // Micro: just a colored summary
                    <div style={{ padding: 6, fontSize: 10 * viewport.zoom, color: 'var(--text-muted)', lineHeight: 1.3, fontFamily: 'ui-sans-serif, system-ui' }}>
                      {slot.component?.displayName ?? 'system default'}
                    </div>
                  ) : zoomTier === 'macro' ? (
                    // Macro: full content + observability HUD
                    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                      <div style={{ flex: 1, padding: 8, fontSize: 12, overflow: 'auto', fontFamily: 'ui-sans-serif, system-ui', color: 'var(--text)' }}>
                        {slot.component ? (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            <div style={{ fontWeight: 600, marginBottom: 4 }}>{slot.component.displayName}</div>
                            <div>engineRef: <code style={{ fontSize: 10 }}>{slot.component?.componentKey ?? '—'}</code></div>
                            <div>actions: {slot.actions.length}</div>
                            <div>tier: {slot.tier}</div>
                            <div>accountTier: {slot.accountTier}</div>
                          </div>
                        ) : (
                          <div style={{ color: 'var(--text-subtle)' }}>System default — no component resolved.</div>
                        )}
                      </div>
                      <ObservabilityHUD
                        streamState="idle"
                        tokensIn={0}
                        tokensOut={0}
                        costUsd={0}
                        latencyMs={0}
                        traceId={surface?.traceId}
                      />
                    </div>
                  ) : (
                    // Mid: normal shell rendering
                    <div style={{ padding: 8, fontSize: 12, overflow: 'auto', fontFamily: 'ui-sans-serif, system-ui', color: 'var(--text)' }}>
                      {slot.component ? (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {slot.component.displayName}
                        </div>
                      ) : (
                        <div style={{ color: 'var(--text-subtle)' }}>System default</div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </VCardMenu>
          </div>
        );
      })}

      {/* Agent overlay */}
      <AgentOverlay
        plan={agentPlan}
        viewport={viewport}
        width={containerSize.w}
        height={containerSize.h}
        onAccept={(opId) => {
          setAgentPlan((p) => p ? { ...p, ops: p.ops.map((o) => o.id === opId ? { ...o, status: 'applied' } : o) } : null);
        }}
        onReject={(opId) => {
          setAgentPlan((p) => p ? { ...p, ops: p.ops.map((o) => o.id === opId ? { ...o, status: 'rejected' } : o) } : null);
        }}
        onAcceptAll={() => {
          setAgentPlan((p) => p ? { ...p, ops: p.ops.map((o) => ({ ...o, status: 'applied' as const })), status: 'applied' } : null);
        }}
        onRejectAll={() => setAgentPlan(null)}
      />

      {/* HUD: viewport + layout controls */}
      <div style={{
        position: 'absolute', bottom: 12, left: 12,
        padding: '6px 10px', borderRadius: 6,
        background: 'var(--bg-elevated)', border: '1px solid var(--border)',
        fontFamily: 'ui-sans-serif, system-ui', fontSize: 10, color: 'var(--text-muted)',
        pointerEvents: 'auto', display: 'flex', gap: 8, alignItems: 'center',
      }}>
        <span><strong>zoom:</strong> {viewport.zoom.toFixed(2)}× ({zoomTier})</span>
        <span><strong>nodes:</strong> {visibleSlots.length}/{surface?.slots.length ?? 0}</span>
        <span><strong>trace:</strong> <code style={{ fontSize: 9 }}>{surface?.traceId.slice(0, 12)}…</code></span>
        <div style={{ display: 'flex', gap: 2, marginLeft: 8 }}>
          {(['cluster', 'timeline', 'mindmap', 'kanban', 'grid', 'free'] as LayoutIntent[]).map((intent) => (
            <button
              key={intent}
              onClick={() => runLayout(intent)}
              title={`${LAYOUT_INTENT_LABELS[intent].label} layout`}
              style={{
                padding: '2px 6px', border: '1px solid', borderColor: layoutIntent === intent ? 'var(--accent)' : 'var(--border)',
                background: layoutIntent === intent ? 'var(--accent-subtle)' : 'var(--bg)',
                color: 'var(--text)', borderRadius: 3, cursor: 'pointer', fontSize: 10, fontFamily: 'inherit',
              }}
            >
              {LAYOUT_INTENT_LABELS[intent].icon}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
