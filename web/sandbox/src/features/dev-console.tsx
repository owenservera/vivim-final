// web/sandbox/src/features/dev-console.tsx
// SOTA live dev console for human-driven testing.
// Hot-key toggled overlay that streams the full engine event firehose over
// the dev:subscribe WS channel, plus direct NL injection and latency budgets.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type Tab = 'events' | 'inject' | 'latency' | 'replay'

interface FirehoseEvent {
  _seq: number
  _ts: number
  type: string
  [key: string]: unknown
}

interface LatencySample {
  capabilityId: string
  latencyMs: number
  traceId: string
}

// Same budgets the backend uses to flag slow paths (mirror of debug-panel).
const LATENCY_BUDGETS: Record<string, number> = {
  resolve: 100,
  recall: 200,
  ensure: 3000,
  type: 200,
  submit: 100,
  capture: 60000,
  parse: 100,
  store: 50,
}

function wsUrl(): string {
  const port = window.location.port || 9420
  return `ws://${window.location.hostname}:${port}/ws`
}

function classifyColor(type: string): string {
  if (type.includes('failed') || type.includes('error') || type.includes('crash')) return 'text-red-400'
  if (type.includes('drift') || type.includes('degraded') || type.includes('circuit')) return 'text-amber-400'
  if (type.includes('complete') || type.includes('created') || type.includes('executed')) return 'text-emerald-400'
  return 'text-sky-400'
}

export function DevConsole({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('events')
  const [events, setEvents] = useState<FirehoseEvent[]>([])
  const [connected, setConnected] = useState(false)
  const [filter, setFilter] = useState('')
  const seqRef = useRef(0)
  const wsRef = useRef<WebSocket | null>(null)
  const [injectText, setInjectText] = useState('')
  const [injectResult, setInjectResult] = useState<string>('')
  const [injectBusy, setInjectBusy] = useState(false)
  const [latency, setLatency] = useState<LatencySample[]>([])
  const [replay, setReplay] = useState<unknown[]>([])

  // ── Firehose WS ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return
    const ws = new WebSocket(wsUrl())
    wsRef.current = ws
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'hello', sessionId: `dev-${Date.now()}`, role: 'frontend' }))
      ws.send(JSON.stringify({ type: 'dev:subscribe' }))
      setConnected(true)
    }
    ws.onclose = () => setConnected(false)
    ws.onmessage = (ev) => {
      let msg: Record<string, unknown>
      try {
        msg = JSON.parse(ev.data as string)
      } catch {
        return
      }
      if (msg.type === 'dev:subscribed') return
      const fe: FirehoseEvent = { _seq: seqRef.current++, _ts: Date.now(), ...msg }
      setEvents((prev) => {
        const next = prev.length > 500 ? prev.slice(prev.length - 500) : prev
        return [...next, fe]
      })
      if (msg.type === 'capability:executed') {
        setLatency((prev) => [
          ...prev.slice(-99),
          {
            capabilityId: String(msg.capabilityId ?? '?'),
            latencyMs: Number(msg.latencyMs ?? 0),
            traceId: String(msg.traceId ?? ''),
          },
        ])
      }
    }
    return () => {
      try {
        ws.send(JSON.stringify({ type: 'dev:unsubscribe' }))
      } catch {}
      ws.close()
      wsRef.current = null
    }
  }, [open])

  // ── NL inject ─────────────────────────────────────────────────────────
  const sendInject = useCallback(async () => {
    const text = injectText.trim()
    if (!text) return
    setInjectBusy(true)
    setInjectResult('')
    try {
      const resp = await fetch('/api/interpret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const data = await resp.json()
      setInjectResult(JSON.stringify(data, null, 2))
    } catch (err) {
      setInjectResult(`ERROR: ${(err as Error).message}`)
    } finally {
      setInjectBusy(false)
    }
  }, [injectText])

  const loadReplay = useCallback(async () => {
    try {
      const resp = await fetch('/api/sandbox/debug')
      const data = await resp.json()
      setReplay(Array.isArray(data.recent) ? data.recent : data.events ?? [])
    } catch (err) {
      setReplay([{ error: (err as Error).message }])
    }
  }, [])

  useEffect(() => {
    if (open && tab === 'replay') void loadReplay()
  }, [open, tab, loadReplay])

  const filtered = useMemo(() => {
    if (!filter.trim()) return events
    const f = filter.toLowerCase()
    return events.filter((e) => JSON.stringify(e).toLowerCase().includes(f))
  }, [events, filter])

  const avgLatency = useMemo(() => {
    if (!latency.length) return 0
    return Math.round(latency.reduce((s, l) => s + l.latencyMs, 0) / latency.length)
  }, [latency])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div
        className="h-full w-[44rem] max-w-[92vw] bg-[#0d1117] text-gray-200 shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-gray-800 px-4 py-2">
          <span className="font-semibold text-sm">Dev Console</span>
          <span
            className={`text-xs px-2 py-0.5 rounded ${connected ? 'bg-emerald-900 text-emerald-300' : 'bg-red-900 text-red-300'}`}
          >
            {connected ? 'LIVE' : 'OFFLINE'}
          </span>
          <span className="text-xs text-gray-500">{events.length} events buffered</span>
          <div className="ml-auto flex gap-1">
            {(['events', 'inject', 'latency', 'replay'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-2 py-1 text-xs rounded capitalize ${
                  tab === t ? 'bg-sky-800 text-sky-100' : 'text-gray-400 hover:bg-gray-800'
                }`}
              >
                {t}
              </button>
            ))}
            <button onClick={onClose} className="px-2 py-1 text-xs text-gray-400 hover:bg-gray-800 rounded" title="Close (Ctrl+`)">
              ✕
            </button>
          </div>
        </div>

        {tab === 'events' && (
          <div className="flex flex-col flex-1 min-h-0">
            <div className="px-3 py-2 border-b border-gray-800">
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="filter events (type, capabilityId, traceId…)"
                className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs font-mono"
              />
            </div>
            <div className="flex-1 overflow-auto font-mono text-xs leading-relaxed p-2 space-y-0.5">
              {filtered.length === 0 && <div className="text-gray-600 p-4">No events yet — drive the system.</div>}
              {filtered.map((e) => (
                <div key={e._seq} className="flex gap-2 hover:bg-gray-800/50 px-1 rounded">
                  <span className="text-gray-600 shrink-0">{new Date(e._ts).toLocaleTimeString()}</span>
                  <span className={`shrink-0 ${classifyColor(e.type)}`}>{e.type}</span>
                  <span className="text-gray-400 truncate">{JSON.stringify(stripMeta(e))}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'inject' && (
          <div className="flex flex-col flex-1 min-h-0 p-3 gap-2">
            <p className="text-xs text-gray-500">
              Send raw text to <code className="text-gray-300">POST /api/interpret</code> — same path the chat box and CLI use.
            </p>
            <textarea
              value={injectText}
              onChange={(e) => setInjectText(e.target.value)}
              placeholder={'list providers\nopen chatgpt\nhelp'}
              rows={3}
              className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm font-mono resize-none"
            />
            <button
              onClick={sendInject}
              disabled={injectBusy}
              className="self-start px-3 py-1 text-sm bg-sky-700 hover:bg-sky-600 rounded disabled:opacity-50"
            >
              {injectBusy ? 'Sending…' : 'Inject →'}
            </button>
            <pre className="flex-1 overflow-auto bg-gray-900 border border-gray-800 rounded p-2 text-xs whitespace-pre-wrap">
              {injectResult || '—'}
            </pre>
          </div>
        )}

        {tab === 'latency' && (
          <div className="flex flex-col flex-1 min-h-0 p-3 gap-2 overflow-auto">
            <div className="text-xs text-gray-500">
              Avg exec latency: <span className="text-emerald-400">{avgLatency}ms</span> over {latency.length} samples
            </div>
            {latency.slice().reverse().map((l, i) => {
              const over = l.latencyMs > 1000
              const pct = Math.min(100, Math.round((l.latencyMs / 3000) * 100))
              return (
                <div key={`${l.traceId}-${i}`} className="text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-300 font-mono truncate">{l.capabilityId}</span>
                    <span className={over ? 'text-red-400' : 'text-gray-400'}>{l.latencyMs}ms</span>
                  </div>
                  <div className="h-1 bg-gray-800 rounded mt-0.5">
                    <div className={`h-1 rounded ${over ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
            <div className="mt-2 border-t border-gray-800 pt-2 text-[11px] text-gray-600">
              Budgets: {Object.entries(LATENCY_BUDGETS).map(([k, v]) => `${k}≤${v}`).join('  ')}
            </div>
          </div>
        )}

        {tab === 'replay' && (
          <div className="flex flex-col flex-1 min-h-0 p-3 gap-2">
            <button onClick={loadReplay} className="self-start px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded">
              Refresh snapshot
            </button>
            <pre className="flex-1 overflow-auto bg-gray-900 border border-gray-800 rounded p-2 text-xs whitespace-pre-wrap">
              {JSON.stringify(replay, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}

function stripMeta(e: FirehoseEvent): Record<string, unknown> {
  const { _seq, _ts, ...rest } = e
  return rest
}
