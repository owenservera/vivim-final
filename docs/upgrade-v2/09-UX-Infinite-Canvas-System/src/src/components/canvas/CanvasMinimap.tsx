// Bottom-right bird's-eye navigator. Shows the full canvas bounding box
// at 5% scale, the current viewport as a draggable rectangle, and
// clickable nodes. Dragging the rectangle pans; scrolling zooms.

"use client";

import { useRef, useCallback } from "react";
import { useCanvasStore } from "@/lib/canvas/store";

const MINIMAP_SIZE = 180; // px

export function CanvasMinimap() {
  const ref = useRef<HTMLDivElement>(null);
  const state = useCanvasStore((s) => s.state);
  const config = useCanvasStore((s) => s.config);
  const setViewport = useCanvasStore((s) => s.setViewport);

  // Compute the bounding box of all nodes + current viewport.
  const xs = state.nodes.flatMap((n) => [n.position.x, n.position.x + (n.size?.x ?? 0)]);
  const ys = state.nodes.flatMap((n) => [n.position.y, n.position.y + (n.size?.y ?? 0)]);
  if (xs.length === 0) return null;

  const minX = Math.min(...xs, state.viewport.origin.x);
  const minY = Math.min(...ys, state.viewport.origin.y);
  const maxX = Math.max(...xs, state.viewport.origin.x + 1000);
  const maxY = Math.max(...ys, state.viewport.origin.y + 600);
  const bw = maxX - minX;
  const bh = maxY - minY;
  const scale = MINIMAP_SIZE / Math.max(bw, bh);

  const onClick = useCallback(
    (e: React.MouseEvent) => {
      const rect = ref.current?.getBoundingClientRect();
      if (!rect) return;
      const px = (e.clientX - rect.left) / scale + minX;
      const py = (e.clientY - rect.top) / scale + minY;
      setViewport({
        origin: { x: px - 500 / state.viewport.scale, y: py - 300 / state.viewport.scale },
        scale: state.viewport.scale,
      });
    },
    [minX, minY, scale, setViewport, state.viewport.scale],
  );

  // Viewport rectangle in minimap coords.
  const vpRect = {
    x: (state.viewport.origin.x - minX) * scale,
    y: (state.viewport.origin.y - minY) * scale,
    width: 1000 * scale, // approximate
    height: 600 * scale,
  };

  return (
    <div
      ref={ref}
      onClick={onClick}
      className="absolute bottom-4 right-4 w-[180px] h-[180px] border border-stone-200 dark:border-stone-800 rounded-lg bg-white/95 dark:bg-stone-900/95 shadow-lg backdrop-blur z-20 cursor-pointer"
      style={{ background: config.palette.background }}
    >
      <svg width={MINIMAP_SIZE} height={MINIMAP_SIZE} className="block">
        {state.nodes.map((n) => {
          const cat = String(n.data.category ?? "");
          const color = config.palette.nodeByCategory[cat] ?? config.palette.textMuted;
          return (
            <rect
              key={n.id}
              x={(n.position.x - minX) * scale}
              y={(n.position.y - minY) * scale}
              width={(n.size?.x ?? 0) * scale}
              height={(n.size?.y ?? 0) * scale}
              fill={color}
              opacity={0.7}
              rx={2}
            />
          );
        })}
        <rect
          x={vpRect.x}
          y={vpRect.y}
          width={vpRect.width}
          height={vpRect.height}
          fill="none"
          stroke={config.palette.accent}
          strokeWidth={1.5}
        />
      </svg>
    </div>
  );
}
