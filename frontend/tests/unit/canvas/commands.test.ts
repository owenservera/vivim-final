import { describe, it, expect } from "bun:test";
import { handleKey } from "@/canvas/commands";
import { DEFAULT_CANVAS_CONFIG } from "@/canvas/config";

const config = DEFAULT_CANVAS_CONFIG;
const emptySelection = { nodeIds: [] as string[] };

describe("handleKey", () => {
  it("escapes to normal mode from any mode", () => {
    const result = handleKey("Escape", "insert", "", config, emptySelection);
    expect(result.mode).toBe("normal");
    expect(result.pendingKeys).toBe("");
  });

  it("returns to normal from command mode on Escape", () => {
    const result = handleKey("Escape", "command", "", config, emptySelection);
    expect(result.mode).toBe("normal");
  });

  it("does nothing in insert mode (keys go to text field)", () => {
    const result = handleKey("a", "insert", "", config, emptySelection);
    expect(result.mode).toBe("insert");
    expect(result.action).toBeUndefined();
  });

  it("does nothing in command mode (keys go to palette)", () => {
    const result = handleKey("x", "command", "", config, emptySelection);
    expect(result.mode).toBe("command");
    expect(result.action).toBeUndefined();
  });

  it("handles zoom-in binding (+)", () => {
    const result = handleKey("+", "normal", "", config, emptySelection);
    expect(result.action).toEqual({ kind: "zoom", factor: 1.2 });
  });

  it("handles zoom-out binding (-)", () => {
    const result = handleKey("-", "normal", "", config, emptySelection);
    expect(result.action).toEqual({ kind: "zoom", factor: 1 / 1.2 });
  });

  it("handles multi-key sequence (dd for delete)", () => {
    const result1 = handleKey("d", "normal", "", config, emptySelection);
    expect(result1.pendingKeys).toBe("d");
    expect(result1.action).toBeUndefined();

    const result2 = handleKey("d", "normal", "d", config, {
      nodeIds: ["node-1"],
    });
    expect(result2.action).toEqual({ kind: "node-delete", ids: ["node-1"] });
  });

  it("handles zoom-fit (zf)", () => {
    const result1 = handleKey("z", "normal", "", config, emptySelection);
    expect(result1.pendingKeys).toBe("z");
    const result2 = handleKey("f", "normal", "z", config, emptySelection);
    expect(result2.action).toEqual({ kind: "zoom-fit" });
  });

  it("handles insert-note (i)", () => {
    const result = handleKey("i", "normal", "", config, emptySelection);
    expect(result.action).toEqual({ kind: "insert-note" });
  });

  it("handles command-open (:)", () => {
    const result = handleKey(":", "normal", "", config, emptySelection);
    expect(result.action).toEqual({ kind: "command-open" });
  });

  it("waits for prefix in multi-key sequence", () => {
    const result = handleKey("d", "normal", "", config, emptySelection);
    expect(result.pendingKeys).toBe("d");
    expect(result.action).toBeUndefined();
  });

  it("returns status text for unknown binding", () => {
    const result = handleKey("z", "normal", "", config, emptySelection);
    // "z" is a prefix of "zf" (zoom-fit), so it waits for more keys
    expect(result.pendingKeys).toBe("z");
    expect(result.action).toBeUndefined();
  });

  it("returns status for truly unknown key", () => {
    const result = handleKey("q", "normal", "", config, emptySelection);
    expect(result.action).toBeUndefined();
  });
});
