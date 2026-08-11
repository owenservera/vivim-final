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
import { Spinner } from './Spinner';
import { Truncate } from './Truncate';
import { CommandStack } from './command-stack';
import { QuadTree } from './quad-tree';
import { getCanvasEventBus, CanvasEventType } from './event-bus';
import { computeLayout, type LayoutIntent, type LayoutNode, type LayoutEdge, LAYOUT_INTENT_LABELS } from '../../shared/layout-intent';
import { useResolvedNodes } from './use-resolved-nodes';
import type { VCardState, VCardCategory } from '../../shared/vcard';
import type { ConnectionLine } from '../../shared/connection-line';
import type { ResolvedSlot } from '../../shared/route-context';
import type { CanvasLayout } from '../../shared/canvas-types';
import type { AgentCanvasPlan } from '@/shared/agent-canvas';
import type { AgentCanvasCommand, AgentCanvasResponse, AgentCanvasPolicy, CanvasState, DEFAULT_POLICY } from '@/shared/agent-canvas';
import { Minimap } from './Minimap';
import { CanvasSearch } from './CanvasSearch';

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
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set());
  const [rubberBand, setRubberBand] = useState<{ startX: number; startY: number; endX: number; endY: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<{
    id: string;
    ids: string[];
    startX: number;
    startY: number;
    origins: Record<string, { x: number; y: number }>;
    snapshot: Record<string, CanvasLayout>;
  } | null>(null);
  const rubberBandRef = useRef<{ startX: number; startY: number; endX: number; endY: number } | null>(null);
  const layoutsRef = useRef<Record<string, CanvasLayout>>(layouts);

  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    layoutsRef.current = layouts;
  }, [layouts]);

  // Keyboard handler for Ctrl+F, Ctrl+Z/Y, Escape
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Don't intercept shortcuts when user is typing in inputs/textareas
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setSearchOpen(true);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        history.undo();
      }
      if (((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) || ((e.ctrlKey || e.metaKey) && e.key === 'y')) {
        e.preventDefault();
        history.redo();
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
        if (selectedNodes.size > 0) setSelectedNodes(new Set());
        if (rubberBand) setRubberBand(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [history, selectedNodes, rubberBand]);

  const slotsToResolve = slotIds ?? Object.keys(DEFAULT_LAYOUTS);
  const { data: surface, isLoading, error } = useResolvedNodes({
    workspaceId,
    userId: 'user:demo',
    providerIds,
    accounts: [],
    slotIds: slotsToResolve,
    variant,
  });

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
    const prev = { ...layouts };
    const next = { ...layouts };
    for (const [id, pos] of Object.entries(result.positions)) {
      const existing = next[id] ?? { x: 0, y: 0, z: 0, w: 320, h: 240 };
      next[id] = { ...existing, x: pos.x, y: pos.y };
    }
    history.execute({
      id: `layout:${intent}:${Date.now()}`,
      description: `layout ${intent}`,
      execute: () => setLayouts(next),
      undo: () => setLayouts(prev),
    });
    setLayoutIntent(intent);
  }, [surface, effectiveLayouts, pinnedNodes, connections, containerSize, slotsToResolve, layouts, history]);

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

  const zoomToFit = useCallback(() => {
    if (!surface || surface.slots.length === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const slot of surface.slots) {
      const key = `${slot.providerId}:${slot.slotId}`;
      const l = effectiveLayouts[key];
      if (!l) continue;
      minX = Math.min(minX, l.x);
      minY = Math.min(minY, l.y);
      maxX = Math.max(maxX, l.x + l.w);
      maxY = Math.max(maxY, l.y + l.h);
    }
    if (!isFinite(minX)) return;
    const worldW = maxX - minX || 320;
    const worldH = maxY - minY || 240;
    const zoom = Math.min(containerSize.w / worldW, containerSize.h / worldH, 1.5);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    setViewport({ x: cx, y: cy, zoom });
  }, [surface, effectiveLayouts, containerSize]);

  const zoomToSelection = useCallback(() => {
    if (selectedNodes.size === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const key of selectedNodes) {
      const l = effectiveLayouts[key];
      if (!l) continue;
      minX = Math.min(minX, l.x);
      minY = Math.min(minY, l.y);
      maxX = Math.max(maxX, l.x + l.w);
      maxY = Math.max(maxY, l.y + l.h);
    }
    if (!isFinite(minX)) return;
    const worldW = maxX - minX || 320;
    const worldH = maxY - minY || 240;
    const zoom = Math.min(containerSize.w / worldW, containerSize.h / worldH, 1.5);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    setViewport({ x: cx, y: cy, zoom });
  }, [selectedNodes, effectiveLayouts, containerSize]);

  const handleNodePointerDown = useCallback((key: string, e: React.PointerEvent, locked: boolean, pinned: boolean) => {
    if (e.button !== 0) return;

    let newSelected: Set<string>;
    if (e.shiftKey) {
      e.stopPropagation();
      newSelected = new Set(selectedNodes);
      if (newSelected.has(key)) newSelected.delete(key);
      else newSelected.add(key);
    } else {
      newSelected = new Set([key]);
    }
    setSelectedNodes(newSelected);

    if (locked || pinned) return;

    const currentLayouts = layoutsRef.current;
    const layout = currentLayouts[key];
    if (!layout) return;

    const ids = Array.from(newSelected);
    const origins: Record<string, { x: number; y: number }> = {};
    const snapshot: Record<string, CanvasLayout> = {};
    for (const id of ids) {
      const l = currentLayouts[id];
      if (l) {
        origins[id] = { x: l.x, y: l.y };
        snapshot[id] = { ...l };
      }
    }

    dragStateRef.current = {
      id: key,
      ids,
      startX: e.clientX,
      startY: e.clientY,
      origins,
      snapshot,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, [selectedNodes]);

  // Drag-and-drop lifecycle (window-level pointermove/pointerup)
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!dragStateRef.current) return;
      const drag = dragStateRef.current;
      const dx = (e.clientX - drag.startX) / viewport.zoom;
      const dy = (e.clientY - drag.startY) / viewport.zoom;
      setLayouts((prev) => {
        const next = { ...prev };
        for (const id of drag.ids) {
          const origin = drag.origins[id];
          if (!origin) continue;
          const l = next[id];
          if (!l) continue;
          next[id] = { ...l, x: origin.x + dx, y: origin.y + dy };
        }
        return next;
      });
    };

    const onUp = (e: PointerEvent) => {
      if (!dragStateRef.current) return;
      const drag = dragStateRef.current;
      const dx = (e.clientX - drag.startX) / viewport.zoom;
      const dy = (e.clientY - drag.startY) / viewport.zoom;
      const moved = Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5;

      if (moved) {
        const nextLayouts = { ...layoutsRef.current };
        const prevLayouts = { ...layoutsRef.current };
        for (const id of drag.ids) {
          const snap = drag.snapshot[id];
          if (snap) prevLayouts[id] = { ...snap };
        }
        history.execute({
          id: `drag:${Date.now()}`,
          description: `move ${drag.ids.length} node(s)`,
          execute: () => setLayouts(nextLayouts),
          undo: () => setLayouts(prevLayouts),
        });
      }

      dragStateRef.current = null;
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [viewport.zoom, history]);

  const handleCanvasPointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('[data-node-id]')) return;
    if (e.button !== 0) return;
    rubberBandRef.current = { startX: e.clientX, startY: e.clientY, endX: e.clientX, endY: e.clientY };
    setRubberBand({ startX: e.clientX, startY: e.clientY, endX: e.clientX, endY: e.clientY });
    setSelectedNodes(new Set());
  }, []);

  useEffect(() => {
    if (!rubberBandRef.current) return;
    const onMove = (e: PointerEvent) => {
      const current = rubberBandRef.current;
      if (!current) return;
      rubberBandRef.current = { ...current, endX: e.clientX, endY: e.clientY };
      setRubberBand({ ...current, endX: e.clientX, endY: e.clientY });
    };
const onUp = () => {
       if (!rubberBandRef.current) return;
       const rb = rubberBandRef.current;
       const minX = Math.min(rb.startX, rb.endX);
       const maxX = Math.max(rb.startX, rb.endX);
       const minY = Math.min(rb.startY, rb.endY);
       const maxY = Math.max(rb.startY, rb.endY);
       const selected = new Set<string>();
       for (const slot of visibleSlots) {
         const key = `${slot.providerId}:${slot.slotId}`;
         const l = effectiveLayouts[key];
         if (!l) continue;
         const sx = (l.x - viewport.x) * viewport.zoom + containerSize.w / 2;
         const sy = (l.y - viewport.y) * viewport.zoom + containerSize.h / 2;
         if (sx >= minX && sx <= maxX && sy >= minY && sy <= maxY) {
           selected.add(key);
         }
       }
       setSelectedNodes(selected);
       rubberBandRef.current = null;
       setRubberBand(null);
     };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, []);

  const handleVCardAction = useCallback((key: string, actionId: string) => {
    const prev = {
      collapsed: new Set(collapsedNodes),
      pinned: new Set(pinnedNodes),
      locked: new Set(lockedNodes),
      layouts: { ...layouts },
    };
    const next = { ...prev };
    switch (actionId) {
      case 'collapse':
        next.collapsed = new Set(prev.collapsed); next.collapsed.add(key); break;
      case 'expand':
        next.collapsed = new Set(prev.collapsed); next.collapsed.delete(key); break;
      case 'pin':
        next.pinned = new Set(prev.pinned); next.pinned.add(key); break;
      case 'fullscreen': setFullscreenNode((f) => (f === key ? null : key)); return;
      case 'lock':
        next.locked = new Set(prev.locked); next.locked.add(key); break;
      case 'remove':
        delete next.layouts[key]; break;
      default: break;
    }
    history.execute({
      id: `vcard:${actionId}:${key}:${Date.now()}`,
      description: `${actionId} ${key}`,
      execute: () => {
        setCollapsedNodes(next.collapsed as Set<string>);
        setPinnedNodes(next.pinned as Set<string>);
        setLockedNodes(next.locked as Set<string>);
        setLayouts(next.layouts as Record<string, CanvasLayout>);
      },
      undo: () => {
        setCollapsedNodes(prev.collapsed);
        setPinnedNodes(prev.pinned);
        setLockedNodes(prev.locked);
        setLayouts(prev.layouts);
      },
    });
  }, [collapsedNodes, pinnedNodes, lockedNodes, layouts, history]);

  if (isLoading) {
    return (
      <div role="status" aria-live="polite" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-foreground)', fontFamily: 'var(--font-sans)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <Spinner size={24} />
          <span style={{ fontSize: 13, fontWeight: 500 }}>Resolving canvas</span>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div role="alert" aria-live="assertive" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--destructive)', fontFamily: 'var(--font-sans)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <Icon name="alert" size={24} />
          <span style={{ fontSize: 13, fontWeight: 500 }}>Canvas error: {String(error.message).slice(0, 80)}</span>
          <button
            onClick={() => window.location.reload()}
            style={{ padding: '6px 16px', borderRadius: 'var(--radius)', background: 'var(--primary)', color: 'var(--primary-foreground)', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer' }}
          >
            Retry
          </button>
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
      onPointerDown={handleCanvasPointerDown}
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
             onPointerDown={(e) => handleNodePointerDown(key, e, isLocked, isPinned)}
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
               opacity: searchQuery.trim() === '' ? (zoomTier === 'micro' ? 0.85 : 1) : (slot.slotId.toLowerCase().includes(searchQuery.toLowerCase()) || slot.providerId.toLowerCase().includes(searchQuery.toLowerCase()) ? 1 : 0.3),
               boxShadow: ((searchQuery.trim() !== '' && (slot.slotId.toLowerCase().includes(searchQuery.toLowerCase()) || slot.providerId.toLowerCase().includes(searchQuery.toLowerCase()))) || selectedNodes.has(key)) ? '0 0 0 2px var(--ring)' : undefined,
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
                  <Truncate as="span" style={{
                    fontSize: 11, fontWeight: 600, color: 'var(--foreground)',
                    letterSpacing: '-0.01em',
                  }}>
                    {slot.slotId.replace('chat.', '')}
                  </Truncate>
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

{/* Rubber-band selection overlay */}
      {rubberBand && (
        <div
          style={{
            position: 'absolute',
            left: Math.min(rubberBand.startX, rubberBand.endX),
            top: Math.min(rubberBand.startY, rubberBand.endY),
            width: Math.abs(rubberBand.endX - rubberBand.startX),
            height: Math.abs(rubberBand.endY - rubberBand.startY),
            background: 'color-mix(in oklch, var(--ring) 15%, transparent)',
            border: '1px solid var(--ring)',
            borderRadius: 2,
            pointerEvents: 'none',
            zIndex: 50,
          }}
        />
      )}

{/* Minimap */}
      <Minimap
        slots={visibleSlots}
        layouts={effectiveLayouts}
        viewport={viewport}
        containerSize={containerSize}
        selectedNodes={selectedNodes}
        onNavigate={(x, y) => setViewport((vp) => ({ ...vp, x, y }))}
        onSelectNode={(nodeId) => setSelectedNodes(new Set([nodeId]))}
      />

{/* Canvas Search */}
      <CanvasSearch
        nodes={visibleSlots.map((s) => ({ id: `${s.providerId}:${s.slotId}`, label: s.slotId.replace('chat.', '') }))}
        onSelect={(nodeId) => {
          const layout = effectiveLayouts[nodeId];
          if (layout) setViewport({ x: layout.x, y: layout.y, zoom: viewport.zoom });
        }}
        onQueryChange={setSearchQuery}
      />

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
         <button
           onClick={zoomToFit}
           title="Zoom to fit"
           style={{
             padding: '2px 5px', border: '1px solid var(--border)',
             background: 'transparent', color: 'var(--muted-foreground)',
             borderRadius: 'calc(var(--radius) - 4px)', cursor: 'pointer',
             display: 'flex', alignItems: 'center',
           }}
         >
           <Icon name="expand" size={11} />
         </button>
         {selectedNodes.size > 0 && (
           <button
             onClick={zoomToSelection}
             title="Zoom to selection"
             style={{
               padding: '2px 5px', border: '1px solid var(--border)',
               background: 'transparent', color: 'var(--muted-foreground)',
               borderRadius: 'calc(var(--radius) - 4px)', cursor: 'pointer',
               display: 'flex', alignItems: 'center',
             }}
           >
             <Icon name="move" size={11} />
           </button>
         )}
         <button
           onClick={() => history.undo()}
           disabled={!history.canUndo()}
           title="Undo (Ctrl+Z)"
           style={{
             padding: '2px 5px', border: '1px solid var(--border)',
             background: 'transparent', color: history.canUndo() ? 'var(--foreground)' : 'var(--text-muted)',
             borderRadius: 'calc(var(--radius) - 4px)', cursor: history.canUndo() ? 'pointer' : 'default',
             display: 'flex', alignItems: 'center', opacity: history.canUndo() ? 1 : 0.4,
           }}
         >
           <Icon name="undo" size={11} />
         </button>
         <button
           onClick={() => history.redo()}
           disabled={!history.canRedo()}
           title="Redo (Ctrl+Y)"
           style={{
             padding: '2px 5px', border: '1px solid var(--border)',
             background: 'transparent', color: history.canRedo() ? 'var(--foreground)' : 'var(--text-muted)',
             borderRadius: 'calc(var(--radius) - 4px)', cursor: history.canRedo() ? 'pointer' : 'default',
             display: 'flex', alignItems: 'center', opacity: history.canRedo() ? 1 : 0.4,
           }}
         >
           <Icon name="redo" size={11} />
         </button>
        <span style={{ fontFamily: 'var(--font-mono)' }}>{viewport.zoom.toFixed(2)}x</span>
        <span style={{ color: 'var(--border)' }}>|</span>
        <span>{visibleSlots.length}/{surface?.slots.length ?? 0} nodes</span>
        {selectedNodes.size > 0 && (
          <>
            <span style={{ color: 'var(--border)' }}>|</span>
            <span style={{ color: 'var(--ring)' }}>{selectedNodes.size} selected</span>
          </>
        )}
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
