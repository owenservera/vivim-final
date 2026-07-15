// web/sandbox/src/surfaces/memory-browser/__tests__/memory-browser.test.ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import {
  createMemoryBrowserApi,
  filterMemories,
  toMemoryRows,
  type CuratedEntry,
  type MemoryGraph,
} from "../api.js"

describe("filterMemories", () => {
  const items: CuratedEntry[] = [
    { id: "1", subject: "vite", predicate: "is", value: "fast", confidence: 0.9 },
    { id: "2", subject: "react", predicate: "uses", value: "hooks", confidence: 0.8 },
    { id: "3", subject: "bun", predicate: "runs", value: "tests", confidence: 0.7 },
  ]

  test("returns all when query empty", () => {
    expect(filterMemories("", items)).toHaveLength(3)
  })

  test("matches case-insensitively across fields", () => {
    expect(filterMemories("FAST", items).map((i) => i.id)).toEqual(["1"])
    expect(filterMemories("hooks", items).map((i) => i.id)).toEqual(["2"])
  })

  test("returns none when no match", () => {
    expect(filterMemories("zzz", items)).toHaveLength(0)
  })
})

describe("toMemoryRows", () => {
  test("merges curated + graph rows", () => {
    const curated: CuratedEntry[] = [
      { id: "a", subject: "x", predicate: "p", value: "1", confidence: 0.9 },
    ]
    const graph: MemoryGraph = {
      entity: "x",
      connections: [
        { predicate: "q", value: "2", confidence: 0.5 },
        { predicate: "r", value: "3", confidence: 0.4 },
      ],
    }
    const rows = toMemoryRows(graph, curated)
    expect(rows).toHaveLength(3)
  })

  test("dedupes rows with identical ids", () => {
    const curated: CuratedEntry[] = [
      { id: "x:p", subject: "x", predicate: "p", value: "1", confidence: 0.9 },
    ]
    const graph: MemoryGraph = {
      entity: "x",
      connections: [{ predicate: "p", value: "1", confidence: 0.9 }],
    }
    const rows = toMemoryRows(graph, curated)
    expect(rows).toHaveLength(1)
  })

  test("uses only curated when no graph", () => {
    expect(toMemoryRows(null, [])).toHaveLength(0)
  })
})

describe("createMemoryBrowserApi", () => {
  const original = globalThis.fetch

  beforeEach(() => {
    // @ts-expect-error override for test
    globalThis.fetch = (input: string) =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve(
            input.includes("/curated")
              ? { entries: [{ id: "1", subject: "s", predicate: "p", value: "v", confidence: 0.9 }] }
              : input.includes("/curate")
                ? { ok: true }
                : { events: [] },
          ),
      }) as unknown as Response
  })

  afterEach(() => {
    globalThis.fetch = original
  })

  test("fetchCurated returns entries", async () => {
    const api = createMemoryBrowserApi("/api")
    const entries = await api.fetchCurated()
    expect(entries).toHaveLength(1)
    expect(entries[0].subject).toBe("s")
  })

  test("curate posts and returns ok", async () => {
    let posted = false
    // @ts-expect-error override for test
    globalThis.fetch = (input: string, init?: RequestInit) => {
      if (input.includes("/curate")) posted = true
      expect(init?.method).toBe("POST")
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ ok: true }),
      }) as unknown as Response
    }
    const api = createMemoryBrowserApi("/api")
    const res = await api.curate({ memoryId: "1", action: "pin" })
    expect(res.ok).toBe(true)
    expect(posted).toBe(true)
  })
})
