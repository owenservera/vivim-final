import { describe, it, expect } from "bun:test";
import { DEFAULT_CANVAS_CONFIG, mergeConfigs } from "@/canvas/config";

describe("DEFAULT_CANVAS_CONFIG", () => {
  it("has correct schema version", () => {
    expect(DEFAULT_CANVAS_CONFIG.schema).toBe("vivim.canvas.config/v1");
  });

  it("has valid zoom range", () => {
    expect(DEFAULT_CANVAS_CONFIG.zoom.min).toBeLessThan(DEFAULT_CANVAS_CONFIG.zoom.max);
    expect(DEFAULT_CANVAS_CONFIG.zoom.min).toBeGreaterThan(0);
  });

  it("has valid grid settings", () => {
    expect(DEFAULT_CANVAS_CONFIG.grid.size).toBeGreaterThan(0);
    expect(DEFAULT_CANVAS_CONFIG.grid.majorEvery).toBeGreaterThan(0);
  });

  it("has node size presets", () => {
    const { compact, comfortable, spacious } = DEFAULT_CANVAS_CONFIG.nodes;
    expect(compact.width).toBeLessThan(comfortable.width);
    expect(comfortable.width).toBeLessThan(spacious.width);
  });
});

describe("mergeConfigs", () => {
  it("returns base config when no overrides", () => {
    const result = mergeConfigs(DEFAULT_CANVAS_CONFIG);
    expect(result).toEqual(DEFAULT_CANVAS_CONFIG);
  });

  it("overrides primitive values", () => {
    const result = mergeConfigs(DEFAULT_CANVAS_CONFIG, { theme: "dark" });
    expect(result.theme).toBe("dark");
    expect(result.schema).toBe(DEFAULT_CANVAS_CONFIG.schema);
  });

  it("deep-merges nested objects", () => {
    const result = mergeConfigs(DEFAULT_CANVAS_CONFIG, {
      zoom: { min: 0.1, max: DEFAULT_CANVAS_CONFIG.zoom.max, wheelMode: DEFAULT_CANVAS_CONFIG.zoom.wheelMode, invertDirection: DEFAULT_CANVAS_CONFIG.zoom.invertDirection, smoothingMs: DEFAULT_CANVAS_CONFIG.zoom.smoothingMs },
    });
    expect(result.zoom.min).toBe(0.1);
    expect(result.zoom.max).toBe(DEFAULT_CANVAS_CONFIG.zoom.max);
  });

  it("ignores undefined values", () => {
    const result = mergeConfigs(DEFAULT_CANVAS_CONFIG, { theme: undefined });
    expect(result.theme).toBe(DEFAULT_CANVAS_CONFIG.theme);
  });

  it("applies multiple overrides in order", () => {
    const result = mergeConfigs(
      DEFAULT_CANVAS_CONFIG,
      { theme: "dark" },
      { theme: "light" },
    );
    expect(result.theme).toBe("light");
  });
});
