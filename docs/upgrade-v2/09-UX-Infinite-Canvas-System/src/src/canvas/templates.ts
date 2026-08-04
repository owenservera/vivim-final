// Built-in canvas templates.
//
// A template is a function (packages, viewport) => Partial<CanvasState>
// that takes the current package list and produces a starter layout.
// The user applies a template via the palette (:t kanban) or the
// Templates panel. Applying a template preserves user notes/groups
// and only repositions package nodes.

import type { CanvasEdge, CanvasNode, CanvasState, Vec2 } from './types'

export interface DeepPackageLite {
  slug: string
  index: number
  title: string
  shortTitle: string
  category: string
}

export interface Template {
  id: string
  name: string
  description: string
  apply: (packages: DeepPackageLite[]) => Partial<CanvasState>
}

// --- Helpers ---

function packageNode(pkg: DeepPackageLite, position: Vec2, size?: Vec2): CanvasNode {
  return {
    id: `pkg_${pkg.slug}`,
    type: 'package',
    position,
    size: size ?? { x: 320, y: 200 },
    data: { slug: pkg.slug, index: pkg.index, title: pkg.title, category: pkg.category },
    label: pkg.shortTitle,
    revision: 1,
  }
}

// --- Templates ---

export const TEMPLATES: Template[] = [
  {
    id: 'kanban',
    name: 'Kanban',
    description: 'To Do / Doing / Blocked / Done columns. Drag packages across as you apply them.',
    apply: (packages) => {
      const colWidth = 360
      const colGap = 40
      const colXs = [0, colWidth + colGap, 2 * (colWidth + colGap), 3 * (colWidth + colGap)]
      const colTitles = ['To Do', 'Doing', 'Blocked', 'Done']
      const groupNodes: CanvasNode[] = colTitles.map((title, i) => ({
        id: `col_${i}`,
        type: 'group',
        position: { x: colXs[i], y: 0 },
        size: { x: colWidth, y: 800 },
        data: { title },
        label: title,
        revision: 1,
      }))
      const packageNodes: CanvasNode[] = packages.map((pkg, i) =>
        packageNode(pkg, { x: colXs[0] + 20, y: 60 + i * 220 }, { x: colWidth - 40, y: 200 }),
      )
      return {
        nodes: [...groupNodes, ...packageNodes],
        edges: [],
        viewport: { origin: { x: -100, y: -100 }, scale: 0.8 },
      }
    },
  },
  {
    id: 'dependency-graph',
    name: 'Dependency Graph',
    description: 'DAG layout: package index 1 at the top, dependencies flowing downward.',
    apply: (packages) => {
      // Simple layered layout: index 1 at y=0, index 2 at y=300, etc.
      const nodes: CanvasNode[] = packages.map((pkg, i) =>
        packageNode(pkg, { x: 200 + (i % 3) * 400, y: Math.floor(i / 3) * 280 }),
      )
      // Auto-edges: each package depends-on the previous one in its category.
      const edges: CanvasEdge[] = []
      for (let i = 1; i < packages.length; i++) {
        const prev = packages[i - 1]
        const curr = packages[i]
        if (prev.category === curr.category) {
          edges.push({
            id: `e_${prev.slug}_${curr.slug}`,
            from: `pkg_${prev.slug}`,
            to: `pkg_${curr.slug}`,
            kind: 'depends-on',
            revision: 1,
          })
        }
      }
      return {
        nodes,
        edges,
        viewport: { origin: { x: 0, y: 0 }, scale: 0.7 },
      }
    },
  },
  {
    id: 'mind-map',
    name: 'Mind Map',
    description: 'Repo root in the center, packages radiating outward by category.',
    apply: (packages) => {
      const center: Vec2 = { x: 0, y: 0 }
      const root: CanvasNode = {
        id: 'root_repo',
        type: 'group',
        position: { x: center.x - 120, y: center.y - 40 },
        size: { x: 240, y: 80 },
        data: { title: 'vivim repo' },
        label: 'vivim',
        revision: 1,
      }
      const radius = 600
      const nodes: CanvasNode[] = packages.map((pkg, i) => {
        const angle = (i / packages.length) * 2 * Math.PI
        return packageNode(pkg, {
          x: center.x + radius * Math.cos(angle) - 160,
          y: center.y + radius * Math.sin(angle) - 100,
        })
      })
      const edges: CanvasEdge[] = packages.map((pkg) => ({
        id: `e_root_${pkg.slug}`,
        from: 'root_repo',
        to: `pkg_${pkg.slug}`,
        kind: 'relates',
        revision: 1,
      }))
      return {
        nodes: [root, ...nodes],
        edges,
        viewport: { origin: { x: -700, y: -500 }, scale: 0.6 },
      }
    },
  },
  {
    id: 'severity-matrix',
    name: 'Severity Matrix',
    description: '2x2: critical/high on the left, medium/low on the right. Top = high impact.',
    apply: (packages) => {
      // We don't have severity counts here; just lay out by index for the demo.
      const cellW = 480
      const cellH = 360
      const quadrants = [
        { x: 0, y: 0, title: 'Critical / High' },
        { x: cellW, y: 0, title: 'Medium / Low' },
        { x: 0, y: cellH, title: 'Apply last' },
        { x: cellW, y: cellH, title: 'Optional' },
      ]
      const groups: CanvasNode[] = quadrants.map((q, i) => ({
        id: `q_${i}`,
        type: 'group',
        position: { x: q.x, y: q.y },
        size: { x: cellW, y: cellH },
        data: { title: q.title },
        label: q.title,
        revision: 1,
      }))
      const nodes: CanvasNode[] = packages.map((pkg, i) =>
        packageNode(pkg, {
          x: quadrants[i % 4].x + 40,
          y: quadrants[i % 4].y + 60 + Math.floor(i / 4) * 220,
        }),
      )
      return {
        nodes: [...groups, ...nodes],
        edges: [],
        viewport: { origin: { x: -50, y: -50 }, scale: 0.7 },
      }
    },
  },
  {
    id: 'timeline',
    name: 'Timeline',
    description: 'Horizontal timeline: week 1, week 2, etc. Package nodes stacked by week.',
    apply: (packages) => {
      const weekWidth = 480
      const weekNodes: CanvasNode[] = Array.from({ length: 4 }).map((_, i) => ({
        id: `week_${i + 1}`,
        type: 'group',
        position: { x: i * weekWidth, y: 0 },
        size: { x: weekWidth - 40, y: 600 },
        data: { title: `Week ${i + 1}` },
        label: `Week ${i + 1}`,
        revision: 1,
      }))
      const nodes: CanvasNode[] = packages.map((pkg, i) =>
        packageNode(pkg, {
          x: (i % 4) * weekWidth + 20,
          y: 60 + Math.floor(i / 4) * 220,
        }),
      )
      return {
        nodes: [...weekNodes, ...nodes],
        edges: [],
        viewport: { origin: { x: -50, y: -50 }, scale: 0.6 },
      }
    },
  },
  {
    id: 'swimlane',
    name: 'Swimlane by Team',
    description:
      "Horizontal lanes per team (security, eng, design, ops). Packages in their owner's lane.",
    apply: (packages) => {
      const lanes = [
        { id: 'sec', title: 'Security', ownerCategories: ['Security'] },
        { id: 'eng', title: 'Engineering', ownerCategories: ['Code Quality', 'Reliability'] },
        { id: 'web', title: 'Web', ownerCategories: ['Web Presence'] },
        { id: 'ux', title: 'UX', ownerCategories: ['UX & Features'] },
      ]
      const laneHeight = 280
      const laneNodes: CanvasNode[] = lanes.map((l, i) => ({
        id: `lane_${l.id}`,
        type: 'group',
        position: { x: 0, y: i * laneHeight },
        size: { x: 1600, y: laneHeight - 20 },
        data: { title: l.title },
        label: l.title,
        revision: 1,
      }))
      const nodes: CanvasNode[] = packages.map((pkg) => {
        const laneIdx = lanes.findIndex((l) => l.ownerCategories.includes(pkg.category))
        const laneIdxFinal = laneIdx === -1 ? 0 : laneIdx
        // Approximate horizontal position by index within the lane.
        const sameLaneBefore = packages
          .slice(0, pkg.index - 1)
          .filter((p) => lanes[laneIdxFinal].ownerCategories.includes(p.category)).length
        return packageNode(pkg, {
          x: 160 + sameLaneBefore * 360,
          y: laneIdxFinal * laneHeight + 40,
        })
      })
      return {
        nodes: [...laneNodes, ...nodes],
        edges: [],
        viewport: { origin: { x: -50, y: -50 }, scale: 0.6 },
      }
    },
  },
]

export function getTemplate(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id)
}
