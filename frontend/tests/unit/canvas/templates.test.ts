import { describe, it, expect } from "bun:test";
import { TEMPLATES, getTemplate, type DeepPackageLite } from "@/canvas/templates";

const mockPackages: DeepPackageLite[] = [
  { slug: "pkg-a", index: 0, title: "Package A", shortTitle: "A", category: "Security" },
  { slug: "pkg-b", index: 1, title: "Package B", shortTitle: "B", category: "Reliability" },
];

describe("TEMPLATES", () => {
  it("has at least 3 built-in templates", () => {
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(3);
  });

  it("each template has a unique id", () => {
    const ids = TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("each template has name and description", () => {
    for (const template of TEMPLATES) {
      expect(template.name).toBeTruthy();
      expect(template.description).toBeTruthy();
    }
  });

  it("each template apply function returns partial state with nodes", () => {
    for (const template of TEMPLATES) {
      const result = template.apply(mockPackages);
      expect(result.nodes).toBeDefined();
      expect(Array.isArray(result.nodes)).toBe(true);
    }
  });
});

describe("getTemplate", () => {
  it("finds a template by id", () => {
    const first = TEMPLATES[0];
    const found = getTemplate(first.id);
    expect(found).toBe(first);
  });

  it("returns undefined for unknown id", () => {
    expect(getTemplate("nonexistent")).toBeUndefined();
  });
});
