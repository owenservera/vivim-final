import { describe, it, expect, beforeEach } from "bun:test";
import { useCanvasStore } from "@/canvas/store";

describe("useCanvasStore", () => {
  beforeEach(() => {
    const store = useCanvasStore.getState();
    store.loadState({
      schema: "vivim.canvas/v1",
      id: "test-canvas",
      nodes: [],
      edges: [],
      bookmarks: [],
      viewport: { origin: { x: 0, y: 0 }, scale: 1 },
      updatedAt: new Date().toISOString(),
    });
  });

  it("has initial state with empty nodes", () => {
    const { state } = useCanvasStore.getState();
    expect(state.nodes).toEqual([]);
    expect(state.edges).toEqual([]);
    expect(state.schema).toBe("vivim.canvas/v1");
  });

  it("adds a node", () => {
    const { addNode } = useCanvasStore.getState();
    const id = addNode({
      type: "note",
      position: { x: 100, y: 200 },
      data: { text: "hello" },
      label: "Test Note",
    });
    expect(id).toBeTruthy();
    const { state } = useCanvasStore.getState();
    expect(state.nodes).toHaveLength(1);
    expect(state.nodes[0].position).toEqual({ x: 100, y: 200 });
  });

  it("removes a node and its edges", () => {
    const { addNode, addEdge, removeNode } = useCanvasStore.getState();
    const id1 = addNode({
      type: "note",
      position: { x: 0, y: 0 },
      data: {},
    });
    const id2 = addNode({
      type: "note",
      position: { x: 100, y: 0 },
      data: {},
    });
    addEdge({ from: id1, to: id2, kind: "relates" });

    removeNode(id1);
    const { state } = useCanvasStore.getState();
    expect(state.nodes).toHaveLength(1);
    expect(state.edges).toHaveLength(0);
  });

  it("pans viewport", () => {
    const { panBy } = useCanvasStore.getState();
    panBy(50, 30);
    const { state } = useCanvasStore.getState();
    expect(state.viewport.origin.x).toBe(-50);
    expect(state.viewport.origin.y).toBe(-30);
  });

  it("zooms viewport", () => {
    const { zoomBy } = useCanvasStore.getState();
    zoomBy(2);
    const { state } = useCanvasStore.getState();
    expect(state.viewport.scale).toBe(2);
  });

  it("clamps zoom to config limits", () => {
    const { zoomBy } = useCanvasStore.getState();
    zoomBy(100);
    const { state, config } = useCanvasStore.getState();
    expect(state.viewport.scale).toBe(config.zoom.max);
  });

  it("selects and clears selection", () => {
    const { addNode, select, clearSelection } = useCanvasStore.getState();
    const id = addNode({
      type: "note",
      position: { x: 0, y: 0 },
      data: {},
    });
    select([id]);
    expect(useCanvasStore.getState().selectedNodeIds).toContain(id);

    clearSelection();
    expect(useCanvasStore.getState().selectedNodeIds).toEqual([]);
  });

  it("undoes and redoes", () => {
    const { commit, addNode, undo, redo } = useCanvasStore.getState();
    // Commit the initial empty state
    commit();
    // Now add a node
    addNode({ type: "note", position: { x: 0, y: 0 }, data: {} });
    expect(useCanvasStore.getState().state.nodes).toHaveLength(1);

    // Undo should restore the empty state
    undo();
    expect(useCanvasStore.getState().state.nodes).toHaveLength(0);

    // Redo should restore the state with 1 node
    redo();
    expect(useCanvasStore.getState().state.nodes).toHaveLength(1);
  });

  it("snaps node to grid when snap is enabled", () => {
    const { addNode, moveNode } = useCanvasStore.getState();
    const id = addNode({
      type: "note",
      position: { x: 0, y: 0 },
      data: {},
    });
    // Grid size is 24, so 25 should snap to 24
    moveNode(id, { x: 25, y: 25 });
    const { state } = useCanvasStore.getState();
    expect(state.nodes[0].position).toEqual({ x: 24, y: 24 });
  });
});
