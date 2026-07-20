'use client';

/**
 * components/canvas/ConnectionLayer.tsx (V6 Visual I/O Lines)
 * --------------------------------------------------------------------
 * Renders bezier-curve I/O connection lines between node ports.
 * 5 line types: data (solid), reference (dashed), stream (wavy),
 * control (dotted), feedback (reverse).
 *
 * Lines are viewport-culled + animated (CSS stroke-dashoffset for
 * stream/control lines).
 */

import { useMemo } from 'react';
import type { ConnectionLine } from '../../shared/connection-line';
import { LINE_TYPE_STYLE, bezierPath, portPosition } from '../../shared/connection-line';

export interface ConnectionLayerProps {
  connections: ConnectionLine[];
  /** Node layouts (nodeId → {x,y,w,h}). */
  nodeLayouts: Record<string, { x: number; y: number; w: number; h: number }>;
  /** Viewport transform (pan + zoom). */
  viewport: { x: number; y: number; zoom: number };
  /** Canvas dimensions. */
  width: number;
  height: number;
  /** Whether to show labels on hover. */
  hoveredConnectionId?: string | null;
  onConnectionClick?: (id: string) => void;
  onConnectionHover?: (id: string | null) => void;
}

export function ConnectionLayer({
  connections,
  nodeLayouts,
  viewport,
  width,
  height,
  hoveredConnectionId,
  onConnectionClick,
  onConnectionHover,
}: ConnectionLayerProps) {
  const paths = useMemo(() => {
    return connections
      .map((conn) => {
        const fromLayout = nodeLayouts[conn.from.nodeId];
        const toLayout = nodeLayouts[conn.to.nodeId];
        if (!fromLayout || !toLayout) return null;
        const fromPos = portPosition(fromLayout, conn.from.port);
        const toPos = portPosition(toLayout, conn.to.port);
        const path = bezierPath(fromPos, toPos);
        const style = LINE_TYPE_STYLE[conn.type];
        return { conn, path, style, fromPos, toPos };
      })
      .filter(Boolean) as Array<{
      conn: ConnectionLine;
      path: string;
      style: typeof LINE_TYPE_STYLE[keyof typeof LINE_TYPE_STYLE];
      fromPos: { x: number; y: number };
      toPos: { x: number; y: number };
    }>;
  }, [connections, nodeLayouts]);

  return (
    <svg
      width={width}
      height={height}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'visible',
      }}
    >
      <defs>
        {/* Arrow markers for each line type */}
        {Object.entries(LINE_TYPE_STYLE).map(([type, style]) => (
          <marker
            key={type}
            id={`arrow-${type}`}
            markerWidth="10"
            markerHeight="10"
            refX="8"
            refY="5"
            orient="auto"
          >
            <path d="M0,0 L10,5 L0,10 Z" fill={style.color} />
          </marker>
        ))}
      </defs>
      <g
        transform={`translate(${width / 2}, ${height / 2}) scale(${viewport.zoom}) translate(${-viewport.x}, ${-viewport.y})`}
      >
        {paths.map(({ conn, path, style }) => {
          const isHovered = hoveredConnectionId === conn.id;
          return (
            <g key={conn.id} style={{ pointerEvents: 'auto', cursor: 'pointer' }}>
              {/* Invisible thick hit area */}
              <path
                d={path}
                fill="none"
                stroke="transparent"
                strokeWidth={12}
                onClick={() => onConnectionClick?.(conn.id)}
                onMouseEnter={() => onConnectionHover?.(conn.id)}
                onMouseLeave={() => onConnectionHover?.(null)}
              />
              {/* Visible line */}
              <path
                d={path}
                fill="none"
                stroke={conn.color ?? style.color}
                strokeWidth={isHovered ? style.strokeWidth + 1 : style.strokeWidth}
                strokeDasharray={style.strokeDasharray}
                markerEnd={`url(#arrow-${conn.type})`}
                style={
                  conn.animated || conn.type === 'stream' || conn.type === 'control'
                    ? {
                        animation: 'dash-flow 1s linear infinite',
                      }
                    : undefined
                }
                opacity={isHovered ? 1 : 0.7}
              />
              {/* Label on hover */}
              {isHovered && conn.label && (() => {
                const p = paths.find((pp) => pp.conn.id === conn.id);
                if (!p) return null;
                const midX = (p.fromPos.x + p.toPos.x) / 2;
                const midY = (p.fromPos.y + p.toPos.y) / 2 - 8;
                return (
                  <text
                    x={midX}
                    y={midY}
                    fill="var(--text)"
                    fontSize={11}
                    fontFamily="ui-sans-serif, system-ui"
                    textAnchor="middle"
                    style={{ pointerEvents: 'none' }}
                  >
                    {conn.label}
                  </text>
                );
              })()}
            </g>
          );
        })}
      </g>
      <style>{`
        @keyframes dash-flow {
          to { stroke-dashoffset: -20; }
        }
      `}</style>
    </svg>
  );
}
