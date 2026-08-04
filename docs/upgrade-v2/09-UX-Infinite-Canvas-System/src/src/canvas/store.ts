// Zustand store for canvas state + viewport + selection + config.
//
// Single source of truth for the canvas page. Components subscribe to
// slices; the store applies actions immutably and triggers persistence.

import { create } from "zustand";
import type {
  CanvasState,
  CanvasNode,
  CanvasEdge,
  Viewport,
  CanvasBookmark,
} from "./types";
import { DEFAULT_CANVAS_CONFIG, mergeConfigs, type CanvasConfig } from "./config";

interface CanvasStore {
  // --- State ---
  state: CanvasState;
  config: CanvasConfig;
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  mode: "normal" | "insert" | "visual" | "command";
  history: CanvasState[];
  future: CanvasState[];

  // --- Viewport actions ---
  setViewport: (vp: Viewport) => void;
  panBy: (dx: number, dy: number) => void;
  zoomBy: (factor: number, anchor?: { x: number; y: number }) => void;
  fitToContent: (padding?: number) => void;

  // --- Node actions ---
  addNode: (node: Omit<CanvasNode, "id" | "revision">) => string;
  updateNode: (id: string, patch: Partial<CanvasNode>) => void;
  removeNode: (id: string) => void;
  moveNode: (id: string, position: CanvasNode["position"]) => void;

  // --- Edge actions ---
  addEdge: (edge: Omit<CanvasEdge, "id" | "revision">) => string;
  removeEdge: (id: string) => void;

  // --- Selection ---
  select: (nodeIds: string[], edgeIds?: string[]) => void;
  selectAll: () => void;
  clearSelection: () => void;

  // --- Bookmarks ---
  addBookmark: (b: Omit<CanvasBookmark, "id">) => void;
  gotoBookmark: (id: string) => void;

  // --- History ---
  undo: () => void;
  redo: () => void;
  commit: () => void; // snapshot current state to history

  // --- Mode ---
  setMode: (m: CanvasStore["mode"]) => void;

  // --- Config ---
  setConfig: (patch: Partial<CanvasConfig>) => void;
  resetConfig: () => void;

  // --- Bulk ---
  loadState: (s: CanvasState) => void;
}

let nodeCounter = 0;
const nextId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}_${(nodeCounter++).toString(36)}`;

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  state: {
    schema: "vivim.canvas/v1",
    id: nextId("canvas"),
    nodes: [],
    edges: [],
    bookmarks: [],
    viewport: { origin: { x: 0, y: 0 }, scale: 1 },
    updatedAt: new Date().toISOString(),
  },
  config: DEFAULT_CANVAS_CONFIG,
  selectedNodeIds: [],
  selectedEdgeIds: [],
  mode: "normal",
  history: [],
  future: [],

  setViewport: (vp) =>
    set((s) => ({ state: { ...s.state, viewport: vp, updatedAt: new Date().toISOString() } })),

  panBy: (dx, dy) =>
    set((s) => {
      const vp = s.state.viewport;
      return {
        state: {
          ...s.state,
          viewport: {
            ...vp,
            origin: { x: vp.origin.x - dx / vp.scale, y: vp.origin.y - dy / vp.scale },
          },
        },
      };
    }),

  zoomBy: (factor, anchor) =>
    set((s) => {
      const vp = s.state.viewport;
      const newScale = Math.max(
        s.config.zoom.min,
        Math.min(s.config.zoom.max, vp.scale * factor),
      );
      // Zoom toward anchor (screen coords) so the point under the cursor stays fixed.
      let newOrigin = vp.origin;
      if (anchor) {
        const canvasX = vp.origin.x + anchor.x / vp.scale;
        const canvasY = vp.origin.y + anchor.y / vp.scale;
        newOrigin = {
          x: canvasX - anchor.x / newScale,
          y: canvasY - anchor.y / newScale,
        };
      }
      return {
        state: {
          ...s.state,
          viewport: { origin: newOrigin, scale: newScale },
        },
      };
    }),

  fitToContent: (padding = 100) =>
    set((s) => {
      if (s.state.nodes.length === 0) return s;
      const xs = s.state.nodes.flatMap((n) => [n.position.x, n.position.x + (n.size?.width ?? 0)]);
      const ys = s.state.nodes.flatMap((n) => [n.position.y, n.position.y + (n.size?.height ?? 0)]);
      const minX = Math.min(...xs) - padding;
      const minY = Math.min(...ys) - padding;
      const maxX = Math.max(...xs) + padding;
      const maxY = Math.max(...ys) + padding;
      const w = maxX - minX;
      const h = maxY - minY;
      // TODO: divide by viewport size in screen px to get scale.
      return {
        state: {
          ...s.state,
          viewport: { origin: { x: minX, y: minY }, scale: 1 },
        },
      };
    }),

  addNode: (node) => {
    const id = nextId("n");
    set((s) => ({
      state: {
        ...s.state,
        nodes: [...s.state.nodes, { ...node, id, revision: 1 }],
        updatedAt: new Date().toISOString(),
      },
    }));
    return id;
  },

  updateNode: (id, patch) =>
    set((s) => ({
      state: {
        ...s.state,
        nodes: s.state.nodes.map((n) =>
          n.id === id ? { ...n, ...patch, revision: n.revision + 1 } : n,
        ),
        updatedAt: new Date().toISOString(),
      },
    })),

  removeNode: (id) =>
    set((s) => ({
      state: {
        ...s.state,
        nodes: s.state.nodes.filter((n) => n.id !== id),
        edges: s.state.edges.filter((e) => e.from !== id && e.to !== id),
        updatedAt: new Date().toISOString(),
      },
    })),

  moveNode: (id, position) =>
    set((s) => {
      const snap = s.config.snap;
      let pos = position;
      if (snap.enabled) {
        pos = {
          x: Math.round(position.x / snap.gridSize) * snap.gridSize,
          y: Math.round(position.y / snap.gridSize) * snap.gridSize,
        };
      }
      return {
        state: {
          ...s.state,
          nodes: s.state.nodes.map((n) =>
            n.id === id ? { ...n, position: pos, revision: n.revision + 1 } : n,
          ),
        },
      };
    }),

  addEdge: (edge) => {
    const id = nextId("e");
    set((s) => ({
      state: {
        ...s.state,
        edges: [...s.state.edges, { ...edge, id, revision: 1 }],
        updatedAt: new Date().toISOString(),
      },
    }));
    return id;
  },

  removeEdge: (id) =>
    set((s) => ({
      state: {
        ...s.state,
        edges: s.state.edges.filter((e) => e.id !== id),
        updatedAt: new Date().toISOString(),
      },
    })),

  select: (nodeIds, edgeIds = []) =>
    set({ selectedNodeIds: nodeIds, selectedEdgeIds: edgeIds }),

  selectAll: () =>
    set((s) => ({
      selectedNodeIds: s.state.nodes.map((n) => n.id),
      selectedEdgeIds: s.state.edges.map((e) => e.id),
    })),

  clearSelection: () => set({ selectedNodeIds: [], selectedEdgeIds: [] }),

  addBookmark: (b) =>
    set((s) => ({
      state: {
        ...s.state,
        bookmarks: [...s.state.bookmarks, { ...b, id: nextId("bm") }],
      },
    })),

  gotoBookmark: (id) =>
    set((s) => {
      const bm = s.state.bookmarks.find((b) => b.id === id);
      if (!bm) return s;
      return { state: { ...s.state, viewport: bm.viewport } };
    }),

  undo: () =>
    set((s) => {
      if (s.history.length === 0) return s;
      const prev = s.history[s.history.length - 1];
      return {
        state: prev,
        history: s.history.slice(0, -1),
        future: [s.state, ...s.future],
      };
    }),

  redo: () =>
    set((s) => {
      if (s.future.length === 0) return s;
      const next = s.future[0];
      return {
        state: next,
        future: s.future.slice(1),
        history: [...s.history, s.state],
      };
    }),

  commit: () =>
    set((s) => ({
      history: [...s.history.slice(-s.config.persistence.versionHistory + 1), s.state],
      future: [],
    })),

  setMode: (m) => set({ mode: m }),

  setConfig: (patch) =>
    set((s) => ({ config: mergeConfigs(s.config, patch) })),

  resetConfig: () => set({ config: DEFAULT_CANVAS_CONFIG }),

  loadState: (newState) =>
    set((s) => ({
      state: newState,
      history: [...s.history.slice(-s.config.persistence.versionHistory + 1), s.state],
      future: [],
      selectedNodeIds: [],
      selectedEdgeIds: [],
    })),
}));
