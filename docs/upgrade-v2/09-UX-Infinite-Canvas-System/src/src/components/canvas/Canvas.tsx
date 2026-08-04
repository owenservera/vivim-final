// The main infinite canvas component.
//
// Renders the canvas surface, grid, nodes, and edges. Handles pan/zoom
// via the Zustand store. Does NOT handle keyboard (that's a separate hook)
// or the config panel / minimap / palette (separate components).
//
// Performance strategy:
//   - Offscreen nodes are virtualized (not rendered) when beyond margin.
//   - Edges are drawn in a single SVG layer (not one SVG per edge).
//   - The grid is a CSS background-image that pans with the viewport.
//   - Pan/zoom uses CSS transform (GPU-accelerated).

"use client";

import { useEffect, useRef, useCallback } from "react";
import { useCanvasStore } from "@/lib/canvas/store";
import { CanvasNodeView } from "./CanvasNodeView";
import { CanvasEdgeLayer } from "./CanvasEdgeLayer";
import { CanvasGrid } from "./CanvasGrid";

export function Canvas() {
  const rootRef = useRef<HTMLDivElement>(null);
  const state = useCanvasStore((s) => s.state);
  const config = useCanvasStore((s) => s.config);
  const panBy = useCanvasStore((s) => s.panBy);
  const zoomBy = useCanvasStore((s) => s.zoomBy);
  const selectedNodeIds = useCanvasStore((s) => s.selectedNodeIds);

  // Wheel handler: zoom (cmd+scroll) or pan (plain scroll), per config.
  const onWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      const isZoom =
        (config.zoom.wheelMode === "cmd-scroll" && (e.metaKey || e.ctrlKey)) ||
        config.zoom.wheelMode === "wheel";
      if (isZoom) {
        const factor = Math.pow(2, -e.deltaY * 0.001);
        const rect = rootRef.current?.getBoundingClientRect();
        const anchor = rect
          ? { x: e.clientX - rect.left, y: e.clientY - rect.top }
          : undefined;
        zoomBy(factor, anchor);
      } else {
        panBy(e.deltaX, e.deltaY);
      }
    },
    [config.zoom.wheelMode, panBy, zoomBy],
  );

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [onWheel]);

  // Drag handler: space-drag or middle-mouse pans.
  const draggingRef = useRef<{ startX: number; startY: number } | null>(null);
  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 1 || (e.button === 0 && e.altKey)) {
        draggingRef.current = { startX: e.clientX, startY: e.clientY };
      }
    },
    [],
  );
  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!draggingRef.current) return;
      const dx = e.clientX - draggingRef.current.startX;
      const dy = e.clientY - draggingRef.current.startY;
      draggingRef.current = { startX: e.clientX, startY: e.clientY };
      panBy(dx, dy);
    },
    [panBy],
  );
  const onMouseUp = useCallback(() => {
    draggingRef.current = null;
  }, []);

  // Visible bounding box (for virtualization).
  const rect = rootRef.current?.getBoundingClientRect();
  const margin = config.performance.offscreenMargin;
  const visibleLeft = state.viewport.origin.x - margin / state.viewport.scale;
  const visibleTop = state.viewport.origin.y - margin / state.viewport.scale;
  const visibleRight =
    state.viewport.origin.x + (rect?.width ?? 0) / state.viewport.scale + margin / state.viewport.scale;
  const visibleBottom =
    state.viewport.origin.y + (rect?.height ?? 0) / state.viewport.scale + margin / state.viewport.scale;

  const visibleNodes = config.performance.virtualizeOffscreen
    ? state.nodes.filter((n) => {
        const x2 = n.position.x + (n.size?.x ?? 0);
        const y2 = n.position.y + (n.size?.y ?? 0);
        return (
          x2 >= visibleLeft && n.position.x <= visibleRight &&
          y2 >= visibleTop && n.position.y <= visibleBottom
        );
      })
    : state.nodes;

  const { origin, scale } = state.viewport;
  // CSS transform: scale first, then translate, so origin is in canvas units.
  const transform = `translate(${-origin.x * scale}px, ${-origin.y * scale}px) scale(${scale})`;

  return (
    <div
      ref={rootRef}
      data-canvas-root
      className="relative w-full h-full overflow-hidden touch-none select-none"
      style={{ background: config.palette.background, cursor: draggingRef.current ? "grabbing" : "default" }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      <CanvasGrid
        viewport={state.viewport}
        config={config}
        width={rect?.width ?? 0}
        height={rect?.height ?? 0}
      />
      <div
        className="absolute top-0 left-0 origin-top-left"
        style={{ transform, transformOrigin: "0 0" }}
      >
        <CanvasEdgeLayer edges={state.edges} nodes={state.nodes} config={config} />
        {visibleNodes.map((node) => (
          <CanvasNodeView
            key={node.id}
            node={node}
            config={config}
            selected={selectedNodeIds.includes(node.id)}
          />
        ))}
      </div>
    </div>
  );
}
