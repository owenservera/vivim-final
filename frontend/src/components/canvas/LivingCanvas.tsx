'use client';

/**
 * components/canvas/LivingCanvas.tsx (V9 SOTA Rewrite)
 * --------------------------------------------------------------------
 * The primary canvas shell. SOTA visual design:
 *   - Glass-morphism node surfaces, refined typography
 *   - No emojis — SVG Icon system throughout
 *   - Semantic zoom (3 tiers), force-directed layout
 *   - vCard menus, connection lines, observability HUD
 *   - Agent co-pilot ghost overlays
 *
 * The shell is dumb (P2): renders whatever routeSync resolves.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNodeTypes } from './use-node-types';
import { useStreamSlot } from './use-stream-slot';
import { VCardMenu } from './VCardMenu';
import { ConnectionLayer } from './ConnectionLayer';
import { ObservabilityHUD } from './ObservabilityHUD';
import { AgentOverlay } from './AgentOverlay';
import { StreamingNodeWrapper } from './StreamingNodeWrapper';
import { Icon, type IconName, SURFACE_ICONS, LAYOUT_ICONS } from './Icon';
import { CommandStack } from './command-stack';
import { QuadTree } from './quad-tree';
import { getCanvasEventBus, CanvasEventType } from './event-bus';
import { computeLayout, type LayoutIntent, type LayoutNode, type LayoutEdge, LAYOUT_INTENT_LABELS } from '../../shared/layout-intent';
import { useLiveConfig } from './LiveConfigProvider';
import type { VCardState, VCardCategory } from '../../shared/vcard';
import type { ConnectionLine } from '../../shared/connection-line';
import type { ResolvedSlot } from '../../shared/route-context';
import type { CanvasLayout } from '../../shared/canvas-types';
import type { AgentCanvasPlan } from '@/shared/agent-canvas';
import type { AgentCanvasCommand, AgentCanvasResponse, AgentCanvasPolicy, CanvasState, DEFAULT_POLICY } from '@/shared/agent-canvas';

export interface LivingCanvasProps {
  workspaceId: string;
  providerIds: string[];
  slotIds?: string[];
  variant?: string;
  conversationId?: string | null;
}

type ZoomTier = 'micro' | 'mid' | 'macro';

function getZoomTier(zoom: number): ZoomTier {
  if (zoom < 0.5) return 'micro';
  if (zoom > 2) return 'macro';
  return 'mid';
}

const DEFAULT_LAYOUTS: Record<string, CanvasLayout> = {
  'chat.header': { x: -340, y: -280, z: 10, w: 680, h: 48 },
  'chat.sidebar': { x: -600, y: -200, z: 5, w: 240, h: 500 },
  'chat.thread': { x: -340, y: -200, z: 5, w: 500, h: 380 },
  'chat.composer': { x: -340, y: 210, z: 5, w: 500, h: 80 },
  'chat.entry': { x: -340, y: -200, z: 8, w: 500, h: 380 },
  'chat.bubble': { x: 200, y: -200, z: 5, w: 280, h: 72 },
  'chat.send': { x: 200, y: 210, z: 5, w: 90, h: 36 },
  'chat.attach': { x: 310, y: 210, z: 5, w: 90, h: 36 },
  'chat.streaming': { x: 200, y: -280, z: 5, w: 240, h: 32 },
  'chat.result': { x: 200, y: -100, z: 5, w: 280, h: 240 },
  'chat.confirm': { x: 0, y: 0, z: 50, w: 320, h: 120 },
  'chat.error': { x: -340, y: -360, z: 50, w: 500, h: 40 },
  'chat.actionBar': { x: -340, y: 310, z: 5, w: 680, h: 44 },
};

const TIER_BADGE: Record<string, { label: string; className: string }> = {
  'provider+variant': { label: 'PV', className: 'badge-warning' },
  'provider': { label: 'P', className: 'badge-accent' },
  'family+variant': { label: 'FV', className: 'badge-success' },
  'family': { label: 'F', className: 'badge-success' },
  'cross-type': { label: 'C', className: 'badge-default' },
  'system': { label: 'S', className: 'badge-default' },
};

export function LivingCanvas(props: LivingCanvasProps) {
  const { workspaceId, providerIds, variant, slotIds, conversationId } = props;
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
  const { surface, isLoading, error } = useLiveConfig();

  // Real component resolution via slot registry
  const { getComponent } = useNodeTypes(providerIds, variant);

  // ── Agent Command Handler (defined before useEffect that uses it) ──────────────
  async function handleAgentCommand(payload: { command: unknown; respond: (response: unknown) => void }) {
    const { command, respond } = payload;
    // The executor is server-side via API, but we can handle local canvas ops here
    // For now, just acknowledge
    respond({ type: 'canvas.ack', payload: { received: true } });
  }

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setContainerSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setContainerSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // ── Agent Command Handler ──────────────────────────────────────────────────
  useEffect(() => {
    const bus = getCanvasEventBus();
    const handler = (event: unknown) => {
      const e = event as { type: string; payload: unknown };
      if (e.type === CanvasEventType.AGENT_COMMAND) {
        handleAgentCommand(e.payload as { command: unknown; respond: (response: unknown) => void });
      }
    };
    bus.on(CanvasEventType.AGENT_COMMAND, handler);
    return () => bus.off(CanvasEventType.AGENT_COMMAND, handler);
  }, []);

  const effectiveLayouts = useMemo(() => {
    const out: Record<string, CanvasLayout> = { ...DEFAULT_LAYOUTS };
    for (const slot of surface?.slots ?? []) {
      const key = `${slot.providerId}:${slot.slotId}`;
      out[key] = layouts[key] ?? out[slot.slotId] ?? { x: 0, y: 0, z: 0, w: 320, h: 240 };
    }
    return out;
  }, [surface, layouts]);

  const runLayout = useCallback((intent: LayoutIntent) => {
    if (!surface) return;
    const layoutNodes: LayoutNode[] = surface.slots.map((slot) => {
      const key = `${slot.providerId}:${slot.slotId}`;
      const l = effectiveLayouts[key] ?? { x: 0, y: 0, w: 320, h: 240 };
      return {
        id: key, x: l.x, y: l.y, w: l.w, h: l.h,
        pinned: pinnedNodes.has(key), category: slot.slotId.split('.')[0] ?? 'generic',
        providerId: slot.providerId, createdAt: Date.now() + surface.slots.indexOf(slot),
      };
    });
    const layoutEdges: LayoutEdge[] = connections.map((c) => ({ from: c.from.nodeId, to: c.to.nodeId, weight: 1 }));
    const result = computeLayout(layoutNodes, layoutEdges, intent, { width: containerSize.w, height: containerSize.h, iterations: 150 });
    setLayouts((prev) => {
      const next = { ...prev };
      for (const [id, pos] of Object.entries(result.positions)) {
        const existing = next[id] ?? { x: 0, y: 0, z: 0, w: 320, h: 240 };
        next[id] = { ...existing, x: pos.x, y: pos.y };
      }
      return next;
    });
    setLayoutIntent(intent);
  }, [surface, effectiveLayouts, pinnedNodes, connections, containerSize, slotsToResolve]);

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

  const onWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setViewport((vp) => ({ ...vp, zoom: Math.max(0.1, Math.min(5, vp.zoom * delta)) }));
    } else {
      setViewport((vp) => ({ x: vp.x + e.deltaX / vp.zoom, y: vp.y + e.deltaY / vp.zoom, zoom: vp.zoom }));
    }
  }, []);

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
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)', fontFamily: 'var(--font-sans)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 24, height: 24, border: '2px solid var(--border)', borderTopColor: 'var(--ring)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <span style={{ fontSize: 13, fontWeight: 500 }}>Resolving canvas</span>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }
  if (error) {
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--destructive)', fontFamily: 'var(--font-sans)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <Icon name="alert" size={24} />
          <span style={{ fontSize: 13, fontWeight: 500 }}>Canvas error: {String(error.message).slice(0, 80)}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      role="application"
      aria-label="Vivim Living Canvas"
      onWheel={onWheel}
      className="scrollbar-thin"
      style={{
        position: 'absolute', inset: 0, overflow: 'hidden',
        background: 'var(--background)',
        outline: 'none',
        cursor: 'default',
      }}
    >
      {/* Grid background */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `linear-gradient(to right, color-mix(in oklch, var(--border) 50%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklch, var(--border) 50%, transparent) 1px, transparent 1px)`,
        backgroundSize: `${40 * viewport.zoom}px ${40 * viewport.zoom}px`,
        backgroundPosition: `${-viewport.x * viewport.zoom + containerSize.w / 2}px ${-viewport.y * viewport.zoom + containerSize.h / 2}px`,
        opacity: 0.5,
      }} />

      {/* Connection lines */}
      <ConnectionLayer
        connections={connections}
        nodeLayouts={Object.fromEntries(visibleSlots.map((s) => {
          const key = `${s.providerId}:${s.slotId}`;
          const l = effectiveLayouts[key] ?? { x: 0, y: 0, w: 320, h: 240 };
          return [key, l];
        }))}
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
        const tierBadge = TIER_BADGE[slot.tier] ?? TIER_BADGE.system;
        const surfaceIcon = SURFACE_ICONS[slot.slotId.split('.')[0]] ?? 'circle';

        const vcardState: VCardState = {
          nodeId: key, collapsed: isCollapsed, pinned: isPinned, fullscreen: isFullscreen,
          locked: isLocked, connectionsVisible: true, detached: false,
          category: (slot.slotId.split('.')[0] as VCardCategory) ?? 'generic',
        };

        return (
          <div
            key={key}
            role="article"
            aria-label={`${slot.slotId} node`}
            data-node-id={key}
            data-tier={slot.tier}
            data-zoom-tier={zoomTier}
            data-pinned={isPinned}
            data-locked={isLocked}
            onPointerDown={(e) => onNodePointerDown(key, e)}
            className="node-surface fade-in-up"
            style={{
              position: 'absolute',
              left: screenX, top: screenY,
              width: screenW, height: screenH,
              zIndex: isFullscreen ? 200 : layout.z,
              overflow: 'hidden',
              borderRadius: 'var(--radius)',
              cursor: isPinned || isLocked ? 'default' : 'grab',
              userSelect: 'none',
              opacity: zoomTier === 'micro' ? 0.85 : 1,
            }}
          >
            <VCardMenu state={vcardState} onAction={(a) => handleVCardAction(key, a)}>
              {/* Node header */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0 10px', height: 32, flexShrink: 0,
                background: 'var(--secondary)',
                borderBottom: isCollapsed ? 'none' : '1px solid var(--border)',
                borderBottomLeftRadius: isCollapsed ? 'var(--radius)' : 0,
                borderBottomRightRadius: isCollapsed ? 'var(--radius)' : 0,
                fontFamily: 'var(--font-sans)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', minWidth: 0 }}>
                  <Icon name={surfaceIcon} size={14} className="text-muted-foreground shrink-0" />
                  <span style={{
                    fontSize: 11, fontWeight: 600, color: 'var(--foreground)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    letterSpacing: '-0.01em',
                  }}>
                    {slot.slotId.replace('chat.', '')}
                  </span>
                  {zoomTier !== 'micro' && (
                    <span style={{ fontSize: 10, color: 'var(--muted-foreground)', flexShrink: 0 }}>
                      {slot.providerId}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  {zoomTier !== 'micro' && (
                    <span className={`badge ${tierBadge.className}`}>{tierBadge.label}</span>
                  )}
                  {isPinned && <Icon name="pin" size={12} className="text-ring" />}
                  {isLocked && <Icon name="lock" size={12} style={{ color: 'var(--destructive)' }} />}
                </div>
              </div>

              {/* Node body — real component resolution + streaming */}
              {!isCollapsed && (
                <div style={{ position: 'absolute', inset: '32px 0 0 0', overflow: 'hidden' }}>
                  {zoomTier === 'micro' ? (
                    <div style={{ padding: 4, fontSize: 9, color: 'var(--muted-foreground)', fontFamily: 'var(--font-mono)', lineHeight: 1.3 }}>
                      {slot.component?.displayName ?? 'system default'}
                    </div>
                  ) : zoomTier === 'macro' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                      <div style={{ flex: 1, overflow: 'auto' }} className="scrollbar-thin">
                        {(() => {
                          const Resolved = getComponent(slot.slotId, slot.providerId);
                          if (!Resolved) return <div style={{ padding: 10, fontSize: 11, color: 'var(--muted-foreground)' }}>No component</div>;
                          const slotContext = { conversationId, activeId: conversationId, workspaceId };
                          return <Resolved {...slotContext} />;
                        })()}
                      </div>
                      {/* Real streaming integration for nodes with streaming capability */}
                      {slot.actions?.some((a) => a.capabilityId?.includes('stream') || a.capabilityId?.includes('send')) && (
                        <StreamingNodeWrapper
                          nodeId={`${slot.providerId}:${slot.slotId}`}
                          capabilityId={slot.actions.find((a) => a.capabilityId?.includes('stream') || a.capabilityId?.includes('send'))?.capabilityId ?? ''}
                          autoStart={false}
                          minHeight={120}
                        />
                      )}
                      <ObservabilityHUD streamState="idle" tokensIn={0} tokensOut={0} costUsd={0} latencyMs={0} traceId={surface?.traceId} />
                    </div>
                  ) : (
                    <div style={{ overflow: 'auto', height: '100%' }} className="scrollbar-thin">
                      {(() => {
                        const Resolved = getComponent(slot.slotId, slot.providerId);
                        if (!Resolved) return <div style={{ padding: 8, fontSize: 11, color: 'var(--muted-foreground)' }}>No component</div>;
                        const slotContext = { conversationId, activeId: conversationId, workspaceId };
                          return <Resolved {...slotContext} />;
                        })()}
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
        onAccept={(opId) => setAgentPlan((p) => p ? { ...p, ops: p.ops.map((o) => o.id === opId ? { ...o, status: 'accepted' as const } : o) } : null)}
        onReject={(opId) => setAgentPlan((p) => p ? { ...p, ops: p.ops.map((o) => o.id === opId ? { ...o, status: 'rejected' as const } : o) } : null)}
        onAcceptAll={() => setAgentPlan((p) => p ? { ...p, ops: p.ops.map((o) => ({ ...o, status: 'accepted' as const })), status: 'accepted' } : null)}
        onRejectAll={() => setAgentPlan(null)}
      />

      {/* HUD — viewport + layout controls */}
      <div style={{
        position: 'absolute', bottom: 12, left: 12,
        padding: '6px 10px', borderRadius: 'var(--radius)',
        background: 'color-mix(in oklch, var(--card) 90%, transparent)',
        backdropFilter: 'blur(8px)',
        border: '1px solid var(--border)',
        fontFamily: 'var(--font-sans)', fontSize: 10, color: 'var(--muted-foreground)',
        pointerEvents: 'auto', display: 'flex', gap: 8, alignItems: 'center',
      }}>
        <span style={{ fontFamily: 'var(--font-mono)' }}>{viewport.zoom.toFixed(2)}x</span>
        <span style={{ color: 'var(--border)' }}>|</span>
        <span>{visibleSlots.length}/{surface?.slots.length ?? 0} nodes</span>
        <span style={{ color: 'var(--border)' }}>|</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9 }}>{surface?.traceId.slice(0, 10)}</span>
        <div style={{ display: 'flex', gap: 2, marginLeft: 4 }}>
          {(['cluster', 'timeline', 'mindmap', 'kanban', 'grid', 'free'] as LayoutIntent[]).map((intent) => (
            <button
              key={intent}
              onClick={() => runLayout(intent)}
              title={LAYOUT_INTENT_LABELS[intent].label}
              style={{
                padding: '2px 5px', border: '1px solid',
                borderColor: layoutIntent === intent ? 'var(--ring)' : 'var(--border)',
                background: layoutIntent === intent ? 'color-mix(in oklch, var(--ring) 12%, transparent)' : 'transparent',
                color: layoutIntent === intent ? 'var(--ring)' : 'var(--muted-foreground)',
                borderRadius: 'calc(var(--radius) - 4px)',
                cursor: 'pointer', display: 'flex', alignItems: 'center',
              }}
            >
              <Icon name={LAYOUT_ICONS[intent] ?? 'grid'} size={11} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
