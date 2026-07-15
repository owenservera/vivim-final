// web/sandbox/src/surfaces/memory-browser/api.ts
// Typed client for the memory visualization API (src/server/memory-viz-router.ts).

export interface MemoryConnection {
  predicate: string
  value: string
  confidence: number
}

export interface MemoryGraph {
  entity: string
  connections: MemoryConnection[]
}

export interface CuratedEntry {
  id: string
  subject: string
  predicate: string
  value: string
  confidence: number
}

export interface TimelineEvent {
  id: string
  action: string
  timestamp: number
  success: boolean
}

export type CurationAction = "pin" | "hide" | "merge"

export interface MemoryBrowserApi {
  baseUrl: string
  fetchGraph(entityId: string): Promise<MemoryGraph>
  fetchCurated(): Promise<CuratedEntry[]>
  fetchTimeline(from?: number, to?: number): Promise<TimelineEvent[]>
  curate(args: {
    memoryType?: string
    memoryId: string
    action: CurationAction
  }): Promise<{ ok: boolean }>
}

export function createMemoryBrowserApi(baseUrl = ""): MemoryBrowserApi {
  async function getJson<T>(path: string): Promise<T> {
    const res = await fetch(`${baseUrl}${path}`)
    if (!res.ok) throw new Error(`memory api ${path} failed: ${res.status}`)
    return (await res.json()) as T
  }

  return {
    baseUrl,
    fetchGraph(entityId: string) {
      return getJson<MemoryGraph>(`/api/memory/graph?entityId=${encodeURIComponent(entityId)}`)
    },
    fetchCurated() {
      return getJson<{ entries: CuratedEntry[] }>(`/api/memory/curated`).then((r) => r.entries)
    },
    fetchTimeline(from?: number, to?: number) {
      const params = new URLSearchParams()
      if (from !== undefined) params.set("from", String(from))
      if (to !== undefined) params.set("to", String(to))
      const qs = params.toString()
      return getJson<{ events: TimelineEvent[] }>(
        `/api/memory/timeline${qs ? `?${qs}` : ""}`,
      ).then((r) => r.events)
    },
    async curate(args) {
      const res = await fetch(`${baseUrl}/api/memory/curate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(args),
      })
      if (!res.ok) throw new Error(`curate failed: ${res.status}`)
      return (await res.json()) as { ok: boolean }
    },
  }
}

// Pure, testable text filter over a list of searchable memory entries.
// Matches when the query is a case-insensitive substring of any field.
export function filterMemories<T extends Record<string, unknown>>(
  query: string,
  items: T[],
): T[] {
  const q = query.trim().toLowerCase()
  if (!q) return items
  return items.filter((item) =>
    Object.values(item).some((v) => String(v ?? "").toLowerCase().includes(q)),
  )
}

// Normalize a graph + curated payload into a flat list of browser rows.
export function toMemoryRows(
  graph: MemoryGraph | null,
  curated: CuratedEntry[],
): CuratedEntry[] {
  const fromGraph = graph
    ? graph.connections.map<CuratedEntry>((c) => ({
        id: `${graph.entity}:${c.predicate}`,
        subject: graph.entity,
        predicate: c.predicate,
        value: c.value,
        confidence: c.confidence,
      }))
    : []
  const merged = [...curated, ...fromGraph]
  const seen = new Set<string>()
  return merged.filter((r) => {
    if (seen.has(r.id)) return false
    seen.add(r.id)
    return true
  })
}
