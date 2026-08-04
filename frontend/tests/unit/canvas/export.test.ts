import { describe, it, expect } from "bun:test";
import { serializeCanvas, deserializeCanvas } from "@/canvas/persistence";
import type { CanvasState } from "@/canvas/types";

const testState: CanvasState = {
  schema: "vivim.canvas/v1",
  id: "test-export",
  nodes: [
    {
      id: "n1",
      type: "note",
      position: { x: 100, y: 200 },
      data: { text: "hello" },
      label: "Note 1",
      revision: 1,
    },
  ],
  edges: [],
  bookmarks: [],
  viewport: { origin: { x: 0, y: 0 }, scale: 1 },
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("serializeCanvas / deserializeCanvas", () => {
  it("round-trips canvas state", () => {
    const json = serializeCanvas(testState);
    const restored = deserializeCanvas(json);
    expect(restored.id).toBe(testState.id);
    expect(restored.nodes).toHaveLength(1);
    expect(restored.nodes[0].id).toBe("n1");
  });

  it("produces valid JSON", () => {
    const json = serializeCanvas(testState);
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it("rejects unknown schema versions", () => {
    const bad = JSON.stringify({ schema: "unknown/v1" });
    expect(() => deserializeCanvas(bad)).toThrow("Unknown canvas schema");
  });
});
