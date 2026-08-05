/**
 * shared/layout-intent.ts
 * --------------------------------------------------------------------
 * V6 #5 — Intent-Based Auto Layout.
 *
 * The resolver returns layout intent (not coordinates). A force-directed
 * layout engine (d3-force style, client-side) places nodes.
 *
 * Intent types:
 *   cluster  — group by provider/category
 *   timeline — left-to-right chronological
 *   mindmap  — radial from a center node
 *   kanban   — columns by status
 *   grid     — uniform grid
 *
 * User can pin nodes; pinned nodes don't move on re-layout.
 */

export type LayoutIntent = 'cluster' | 'timeline' | 'mindmap' | 'kanban' | 'grid' | 'free';

export interface LayoutNode {
  id: string;
  /** Current position (world-space). */
  x: number;
  y: number;
  /** Whether the node is pinned (won't move on re-layout). */
  pinned: boolean;
  /** Node size. */
  w: number;
  h: number;
  /** Category for clustering. */
  category: string;
  /** Provider for clustering. */
  providerId?: string;
  /** Status for kanban layout. */
  status?: string;
  /** Timestamp for timeline layout. */
  createdAt?: number;
}

export interface LayoutEdge {
  from: string;
  to: string;
  /** Edge weight (stronger = closer). */
  weight?: number;
}

export interface LayoutResult {
  positions: Record<string, { x: number; y: number }>;
  intent: LayoutIntent;
  iterations: number;
  converged: boolean;
}

export const LAYOUT_INTENT_LABELS: Record<LayoutIntent, { label: string; icon: string }> = {
  cluster: { label: 'Cluster', icon: '' },
  timeline: { label: 'Timeline', icon: 'calendar' },
  mindmap: { label: 'Mind Map', icon: '' },
  kanban: { label: 'Kanban', icon: '' },
  grid: { label: 'Grid', icon: 'grid' },
  free: { label: 'Free', icon: 'free' },
};

/**
 * Force-directed layout engine (simplified d3-force).
 * Runs N iterations of: repulsion (all pairs) + attraction (edges) +
 * centering gravity. Pinned nodes don't move.
 */
export function computeLayout(
  nodes: LayoutNode[],
  edges: LayoutEdge[],
  intent: LayoutIntent,
  opts?: { iterations?: number; width?: number; height?: number },
): LayoutResult {
  const iterations = opts?.iterations ?? 200;
  const width = opts?.width ?? 1200;
  const height = opts?.height ?? 800;
  const cx = width / 2;
  const cy = height / 2;

  // Initialize positions based on intent.
  const positions: Record<string, { x: number; y: number; vx: number; vy: number }> = {};
  for (const n of nodes) {
    if (n.pinned) {
      positions[n.id] = { x: n.x, y: n.y, vx: 0, vy: 0 };
    } else {
      // Intent-specific initial layout.
      switch (intent) {
        case 'timeline':
          positions[n.id] = { x: 100 + (n.createdAt ?? Date.now()) % width, y: cy + (Math.random() - 0.5) * 200, vx: 0, vy: 0 };
          break;
        case 'mindmap':
          positions[n.id] = { x: cx + (Math.random() - 0.5) * 600, y: cy + (Math.random() - 0.5) * 400, vx: 0, vy: 0 };
          break;
        case 'kanban': {
          const cols = ['pending', 'running', 'complete', 'error'];
          const colIdx = cols.indexOf(n.status ?? 'pending');
          positions[n.id] = { x: 100 + (colIdx >= 0 ? colIdx : 0) * 280, y: 100 + Math.random() * 400, vx: 0, vy: 0 };
          break;
        }
        case 'grid': {
          const idx = nodes.indexOf(n);
          const cols = Math.ceil(Math.sqrt(nodes.length));
          positions[n.id] = { x: 100 + (idx % cols) * 340, y: 100 + Math.floor(idx / cols) * 280, vx: 0, vy: 0 };
          break;
        }
        default:
          positions[n.id] = { x: n.x || cx + (Math.random() - 0.5) * 400, y: n.y || cy + (Math.random() - 0.5) * 300, vx: 0, vy: 0 };
      }
    }
  }

  // Category centers for cluster intent.
  const categoryCenters = new Map<string, { x: number; y: number }>();
  if (intent === 'cluster') {
    const categories = [...new Set(nodes.map((n) => n.category))];
    categories.forEach((cat, i) => {
      const angle = (i / categories.length) * Math.PI * 2;
      categoryCenters.set(cat, { x: cx + Math.cos(angle) * 300, y: cy + Math.sin(angle) * 250 });
    });
  }

  let converged = false;
  for (let iter = 0; iter < iterations; iter++) {
    let maxDelta = 0;

    // Repulsion (all pairs).
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i]!;
      if (a.pinned) continue;
      const pa = positions[a.id]!;
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j]!;
        const pb = positions[b.id]!;
        const dx = pa.x - pb.x;
        const dy = pa.y - pb.y;
        const dist2 = Math.max(100, dx * dx + dy * dy);
        const force = 8000 / dist2;
        const dist = Math.sqrt(dist2);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        pa.vx += fx;
        pa.vy += fy;
        if (!b.pinned) {
          pb.vx -= fx;
          pb.vy -= fy;
        }
      }
    }

    // Attraction (edges).
    for (const e of edges) {
      const pa = positions[e.from];
      const pb = positions[e.to];
      if (!pa || !pb) continue;
      const dx = pb.x - pa.x;
      const dy = pb.y - pa.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const force = (dist - 200) * 0.01 * (e.weight ?? 1);
      const fx = (dx / Math.max(1, dist)) * force;
      const fy = (dy / Math.max(1, dist)) * force;
      if (!nodes.find((n) => n.id === e.from)?.pinned) {
        pa.vx += fx;
        pa.vy += fy;
      }
      if (!nodes.find((n) => n.id === e.to)?.pinned) {
        pb.vx -= fx;
        pb.vy -= fy;
      }
    }

    // Cluster attraction (pull toward category center).
    if (intent === 'cluster') {
      for (const n of nodes) {
        if (n.pinned) continue;
        const center = categoryCenters.get(n.category);
        if (!center) continue;
        const pa = positions[n.id]!;
        pa.vx += (center.x - pa.x) * 0.02;
        pa.vy += (center.y - pa.y) * 0.02;
      }
    }

    // Centering gravity.
    for (const n of nodes) {
      if (n.pinned) continue;
      const pa = positions[n.id]!;
      pa.vx += (cx - pa.x) * 0.005;
      pa.vy += (cy - pa.y) * 0.005;
    }

    // Apply velocity with damping.
    for (const n of nodes) {
      if (n.pinned) continue;
      const pa = positions[n.id]!;
      pa.vx *= 0.85;
      pa.vy *= 0.85;
      const deltaX = pa.vx;
      const deltaY = pa.vy;
      pa.x += deltaX;
      pa.y += deltaY;
      maxDelta = Math.max(maxDelta, Math.abs(deltaX), Math.abs(deltaY));
    }

    if (iter > 50 && maxDelta < 0.5) {
      converged = true;
      break;
    }
  }

  const result: Record<string, { x: number; y: number }> = {};
  for (const [id, p] of Object.entries(positions)) {
    result[id] = { x: p.x, y: p.y };
  }

  return { positions: result, intent, iterations, converged };
}
