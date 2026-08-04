'use client';

import { useCallback, useMemo } from 'react';
import { MinimapNode } from './MinimapNode';
import type { ResolvedSlot } from '../../shared/route-context';
import type { CanvasLayout } from '../../shared/canvas-types';

export interface MinimapProps {
  slots: ResolvedSlot[];
  layouts: Record<string, CanvasLayout>;
  viewport: { x: number; y: number; zoom: number };
  containerSize: { w: number; h: number };
  selectedNodes?: Set<string>;
  onNavigate?: (x: number, y: number) => void;
  onSelectNode?: (nodeId: string) => void;
}

const NODE_COLORS: Record<string, string> = {
  doc: 'var(--color-info)',
  media: 'var(--color-purple)',
  automation: 'var(--color-success)',
  agent: 'var(--color-warning)',
  shell: 'var(--color-error)',
  default: 'var(--text-muted)',
};

export function Minimap({ slots, layouts, viewport, containerSize, selectedNodes, onNavigate, onSelectNode }: MinimapProps) {
  const minimapSize = 160;
  const padding = 8;

  const worldBounds = useMemo(() => {
    if (slots.length === 0) return { minX: 0, minY: 0, maxX: 320, maxY: 240 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const slot of slots) {
      const key = `${slot.providerId}:${slot.slotId}`;
      const l = layouts[key];
      if (!l) continue;
      minX = Math.min(minX, l.x);
      minY = Math.min(minY, l.y);
      maxX = Math.max(maxX, l.x + l.w);
      maxY = Math.max(maxY, l.y + l.h);
    }
    if (!isFinite(minX)) return { minX: 0, minY: 0, maxX: 320, maxY: 240 };
    return { minX, minY, maxX, maxY };
  }, [slots, layouts]);

  const scale = useMemo(() => {
    const worldW = worldBounds.maxX - worldBounds.minX || 320;
    const worldH = worldBounds.maxY - worldBounds.minY || 240;
    const available = minimapSize - padding * 2;
    return Math.min(available / worldW, available / worldH);
  }, [worldBounds]);

  const offset = useMemo(() => ({
    x: padding - worldBounds.minX * scale + (minimapSize - padding * 2 - (worldBounds.maxX - worldBounds.minX) * scale) / 2,
    y: padding - worldBounds.minY * scale + (minimapSize - padding * 2 - (worldBounds.maxY - worldBounds.minY) * scale) / 2,
  }), [worldBounds, scale]);

  const viewportRect = useMemo(() => {
    const vpLeft = (viewport.x - containerSize.w / 2 / viewport.zoom) * scale + offset.x;
    const vpTop = (viewport.y - containerSize.h / 2 / viewport.zoom) * scale + offset.y;
    const vpWidth = (containerSize.w / viewport.zoom) * scale;
    const vpHeight = (containerSize.h / viewport.zoom) * scale;
    return { x: vpLeft, y: vpTop, width: vpWidth, height: vpHeight };
  }, [viewport, containerSize, scale, offset]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!onNavigate) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const worldX = (clickX - offset.x) / scale;
    const worldY = (clickY - offset.y) / scale;
    onNavigate(worldX, worldY);
  }, [onNavigate, scale, offset]);

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 12,
        right: 12,
        width: minimapSize,
        height: minimapSize,
        background: 'color-mix(in oklch, var(--card) 92%, transparent)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
        cursor: onNavigate ? 'pointer' : 'default',
      }}
      onClick={handleClick}
    >
      <svg width={minimapSize} height={minimapSize} style={{ display: 'block' }}>
        {slots.map((slot) => {
          const key = `${slot.providerId}:${slot.slotId}`;
          const layout = layouts[key];
          if (!layout) return null;
          const nodeType = slot.slotId.split('.')[0] ?? 'default';
          const color = NODE_COLORS[nodeType] ?? NODE_COLORS.default;
          const x = layout.x * scale + offset.x;
          const y = layout.y * scale + offset.y;
          const w = Math.max(layout.w * scale, 2);
          const h = Math.max(layout.h * scale, 2);
          const selected = selectedNodes?.has(key) ?? false;
          return (
            <rect
              key={key}
              x={x}
              y={y}
              width={w}
              height={h}
              rx={1}
              fill={color}
              fillOpacity={selected ? 0.9 : 0.5}
              stroke={selected ? 'var(--bg)' : 'none'}
              strokeWidth={selected ? 1 : 0}
              style={{ cursor: onSelectNode ? 'pointer' : 'default' }}
              onClick={(e) => {
                e.stopPropagation();
                onSelectNode?.(key);
              }}
            />
          );
        })}
        <rect
          x={viewportRect.x}
          y={viewportRect.y}
          width={viewportRect.width}
          height={viewportRect.height}
          fill="none"
          stroke="var(--text-muted)"
          strokeWidth={1}
          strokeDasharray="3 2"
        />
      </svg>
    </div>
  );
}
