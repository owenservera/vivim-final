'use client';

/**
 * components/builder/MutationEdge.tsx
 * --------------------------------------------------------------------
 * Phase 6 — Visual Builder. An SVG edge representing a SurfaceMutation
 * between two nodes. Labeled with `op` + target field.
 *
 * CONTRACT_VERSION: 1
 */

export interface MutationEdgeData {
  id: string;
  from: { nodeId: string; portId: string };
  to: { nodeId: string; portId: string };
  op: 'replace' | 'insert' | 'remove' | 'reorder' | 'restyle' | 'rebind' | 'set_property' | 'set_slot';
  target: string;
}

export interface MutationEdgeProps {
  edge: MutationEdgeData;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

const OP_COLORS: Record<string, string> = {
  replace: '#3b82f6',
  insert: '#22c55e',
  remove: '#ef4444',
  reorder: '#a855f7',
  restyle: '#f59e0b',
  rebind: '#06b6d4',
  set_property: '#6366f1',
  set_slot: '#ec4899',
};

export function MutationEdge({ edge, x1, y1, x2, y2 }: MutationEdgeProps) {
  const color = OP_COLORS[edge.op] ?? '#64748b';

  // Bezier control points for a smooth horizontal curve.
  const dx = Math.abs(x2 - x1);
  const cx1 = x1 + dx * 0.5;
  const cx2 = x2 - dx * 0.5;

  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;

  return (
    <g>
      <path
        d={`M ${x1} ${y1} C ${cx1} ${y1}, ${cx2} ${y2}, ${x2} ${y2}`}
        fill="none"
        stroke={color}
        strokeWidth={2}
        opacity={0.7}
      />
      <circle cx={x1} cy={y1} r={3} fill={color} />
      <circle cx={x2} cy={y2} r={3} fill={color} />
      <text
        x={midX}
        y={midY - 6}
        fill={color}
        fontSize={10}
        textAnchor="middle"
        style={{ pointerEvents: 'none', fontWeight: 600 }}
      >
        {edge.op}
      </text>
      <text
        x={midX}
        y={midY + 8}
        fill="var(--text-muted, #94a3b8)"
        fontSize={9}
        textAnchor="middle"
        style={{ pointerEvents: 'none' }}
      >
        → {edge.target}
      </text>
    </g>
  );
}
