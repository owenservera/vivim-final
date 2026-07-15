// web/sandbox/src/surfaces/memory-browser/MemoryBrowser.tsx
// Full memory browser surface: list + search + drill-down + curation.

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  createMemoryBrowserApi,
  filterMemories,
  toMemoryRows,
  type CuratedEntry,
  type CurationAction,
  type MemoryGraph,
} from "./api.js"

export function MemoryBrowser({ baseUrl = "" }: { baseUrl?: string }) {
  const api = useMemo(() => createMemoryBrowserApi(baseUrl), [baseUrl])
  const [curated, setCurated] = useState<CuratedEntry[]>([])
  const [graph, setGraph] = useState<MemoryGraph | null>(null)
  const [drillEntity, setDrillEntity] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const entries = await api.fetchCurated()
      setCurated(entries)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [api])

  useEffect(() => {
    void load()
  }, [load])

  const drillDown = useCallback(
    async (entity: string) => {
      setDrillEntity(entity)
      setError(null)
      try {
        const g = await api.fetchGraph(entity)
        setGraph(g)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    },
    [api],
  )

  const runCuration = useCallback(
    async (memoryId: string, action: CurationAction) => {
      setBusyId(memoryId)
      try {
        await api.curate({ memoryId, action })
        await load()
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setBusyId(null)
      }
    },
    [api, load],
  )

  const rows = useMemo(
    () => filterMemories(query, toMemoryRows(drillEntity ? graph : null, curated)),
    [query, graph, curated, drillEntity],
  )

  if (loading) {
    return <div className="p-4 text-sm text-gray-500">Loading memories…</div>
  }

  return (
    <section className="flex h-full flex-col border-l border-gray-200 bg-white">
      <header className="border-b border-gray-200 p-4">
        <h2 className="text-sm font-medium text-gray-700">Memory Browser</h2>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search memories…"
          aria-label="Search memories"
          className="mt-2 w-full rounded border border-gray-300 px-3 py-2 text-sm"
        />
      </header>

      {error && <p className="px-4 py-2 text-sm text-red-600">{error}</p>}

      <ul className="flex-1 space-y-1 overflow-y-auto p-2">
        {rows.length === 0 && (
          <li className="px-2 py-3 text-sm text-gray-400">No memories match.</li>
        )}
        {rows.map((row) => (
          <li
            key={row.id}
            className="rounded border border-gray-100 px-3 py-2 text-sm hover:bg-gray-50"
          >
            <button
              type="button"
              className="font-medium text-blue-700 hover:underline"
              onClick={() => drillDown(row.subject || row.id)}
            >
              {row.subject || row.id}
            </button>
            <div className="text-xs text-gray-500">
              {row.predicate}: {row.value}
            </div>
            <div className="mt-1 flex gap-2">
              <button
                type="button"
                disabled={busyId === row.id}
                onClick={() => runCuration(row.id, "pin")}
                className="rounded bg-blue-50 px-2 py-1 text-xs text-blue-700 hover:bg-blue-100"
              >
                Pin
              </button>
              <button
                type="button"
                disabled={busyId === row.id}
                onClick={() => runCuration(row.id, "hide")}
                className="rounded bg-gray-50 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
              >
                Hide
              </button>
            </div>
          </li>
        ))}
      </ul>

      {drillEntity && graph && (
        <footer className="border-t border-gray-200 p-3 text-xs text-gray-500">
          <div className="mb-1 font-medium text-gray-600">{drillEntity} connections</div>
          <ul className="space-y-0.5">
            {graph.connections.map((c, i) => (
              <li key={i}>
                {c.predicate} → {c.value} ({c.confidence.toFixed(2)})
              </li>
            ))}
          </ul>
        </footer>
      )}
    </section>
  )
}
