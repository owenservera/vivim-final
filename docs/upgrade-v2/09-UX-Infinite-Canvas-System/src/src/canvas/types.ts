// Core type definitions for the infinite canvas system.
// All canvas modules import from here so the shape is stable.

export type NodeType =
  | "package" // a deep-analysis package
  | "note" // free-text sticky
  | "code" // code snippet with syntax highlighting
  | "image" // raster image (PNG/JPEG/WebP)
  | "link" // external URL embed
  | "group" // frame that contains other nodes
  | "marker"; // pin/flag for callouts

export type EdgeKind =
  | "depends-on" // A must be applied before B
  | "conflicts" // A and B touch the same files; order matters
  | "relates" // soft semantic link
  | "references"; // A's note mentions B

export interface Vec2 {
  x: number;
  y: number;
}

export interface Viewport {
  // Top-left of the visible area in canvas coordinates.
  origin: Vec2;
  // Scale factor: 1.0 = 100%, 0.1 = 10% (bird's-eye), 10 = 1000% (pixel).
  scale: number;
}

export interface CanvasNode {
  id: string;
  type: NodeType;
  // Top-left position in canvas coordinates (not screen pixels).
  position: Vec2;
  // Size in canvas units. Auto-sized if omitted.
  size?: Vec2;
  // Per-type payload (a package slug, note text, code language, image URL, etc.).
  data: Record<string, unknown>;
  // Visual overrides; null means inherit from config + category.
  color?: string;
  label?: string;
  // Group parenting: if set, position is relative to the group's origin.
  parentId?: string;
  // CRDT logical clock for collaboration merge.
  revision: number;
}

export interface CanvasEdge {
  id: string;
  from: string; // node id
  to: string; // node id
  kind: EdgeKind;
  label?: string;
  // Optional control points for curved edges.
  bends?: Vec2[];
  revision: number;
}

export interface CanvasBookmark {
  id: string;
  name: string;
  hotkey?: string; // "1".."9"
  viewport: Viewport;
}

export interface CanvasState {
  schema: "vivim.canvas/v1";
  id: string; // unique canvas id
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  bookmarks: CanvasBookmark[];
  viewport: Viewport;
  // User-set per-canvas config overrides (merged over the global config).
  configOverrides?: Partial<CanvasConfig>;
  updatedAt: string; // ISO timestamp
}

// Re-exported from config.ts to keep a single import surface.
import type { CanvasConfig } from "./config";
export type { CanvasConfig };
