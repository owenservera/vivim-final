/**
 * shared/connection-line.ts
 * --------------------------------------------------------------------
 * V6 — Visual I/O connection lines between node ports.
 *
 * 5 line types: data (solid), reference (dashed), stream (wavy),
 * control (dotted), feedback (reverse).
 *
 * Each node has 6 standardized ports: input (left), config (left),
 * context (left), output (right), stream (right), error (bottom).
 */

export type LineType = 'data' | 'reference' | 'stream' | 'control' | 'feedback';

export type NodePort = 'input' | 'config' | 'context' | 'output' | 'stream' | 'error';

export interface ConnectionLine {
  id: string;
  from: { nodeId: string; port: NodePort };
  to: { nodeId: string; port: NodePort };
  type: LineType;
  label?: string;
  color?: string;
  animated?: boolean;
  throttleMs?: number;
  transform?: string;
  conditional?: string;
  createdAt: number;
}

export interface PortPosition {
  x: number;
  y: number;
}

export const LINE_TYPE_STYLE: Record<LineType, { strokeDasharray: string; strokeWidth: number; color: string; label: string }> = {
  data: { strokeDasharray: 'none', strokeWidth: 2, color: '#3b82f6', label: 'Data Flow' },
  reference: { strokeDasharray: '6 4', strokeWidth: 1.5, color: '#8b5cf6', label: 'Reference' },
  stream: { strokeDasharray: '4 2 2 2', strokeWidth: 2, color: '#0ea5e9', label: 'Stream' },
  control: { strokeDasharray: '2 4', strokeWidth: 1.5, color: '#f59e0b', label: 'Control' },
  feedback: { strokeDasharray: 'none', strokeWidth: 2, color: '#ef4444', label: 'Feedback' },
};

export const PORT_SIDE: Record<NodePort, 'left' | 'right' | 'bottom'> = {
  input: 'left',
  config: 'left',
  context: 'left',
  output: 'right',
  stream: 'right',
  error: 'bottom',
};

export const PORT_LABEL: Record<NodePort, string> = {
  input: 'Input',
  config: 'Config',
  context: 'Context',
  output: 'Output',
  stream: 'Stream',
  error: 'Error',
};

/** Compute a port's screen-space position from a node's layout. */
export function portPosition(
  nodeLayout: { x: number; y: number; w: number; h: number },
  port: NodePort,
): PortPosition {
  const side = PORT_SIDE[port];
  switch (side) {
    case 'left':
      return { x: nodeLayout.x, y: nodeLayout.y + nodeLayout.h / 2 };
    case 'right':
      return { x: nodeLayout.x + nodeLayout.w, y: nodeLayout.y + nodeLayout.h / 2 };
    case 'bottom':
      return { x: nodeLayout.x + nodeLayout.w / 2, y: nodeLayout.y + nodeLayout.h };
  }
}

/** Compute a bezier path between two port positions. */
export function bezierPath(from: PortPosition, to: PortPosition): string {
  const dx = Math.abs(to.x - from.x);
  const cp = Math.max(40, dx * 0.4);
  const sideFrom = from.x < to.x ? 1 : -1;
  const sideTo = from.x < to.x ? -1 : 1;
  return `M ${from.x} ${from.y} C ${from.x + cp * sideFrom} ${from.y}, ${to.x + cp * sideTo} ${to.y}, ${to.x} ${to.y}`;
}
