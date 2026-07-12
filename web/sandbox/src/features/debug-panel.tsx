// web/sandbox/src/features/debug-panel.tsx
// Unit 6.4 — DevTools surface: events, capabilities, fleet, health, timing tabs.

import { useEffect, useRef, useState } from 'react'

type Tab = 'events' | 'capabilities' | 'fleet' | 'health' | 'timing'

interface DebugEvent {
  type: string
  _ts: number
  [key: string]: unknown
}

interface Capability {
  id: string
  slug: string
  name: string
  uiComponent: string
  uiPosition: string
  minPlanTier: string
}

interface Slave {
  slaveId: string
  providerId: string
  accountId: string
  status: string
  debugPort: number
  pid: number
  circuitState: string
}

interface ProviderHealth {
  providerId: string
  status: string
  score: number
  signals: Array<{ signal: string; contribution: number; weight: number }>
}

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

export function DebugPanel() {
  const [tab, setTab] = useState<Tab>('events')

  return (
    <div className="w-80 border-l bg-gray-50 flex flex-col">
      <div className="flex border-b">
        {(['events', 'capabilities', 'fleet', 'health', 'timing'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-xs ${
              tab === t ? 'bg-white border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto">
        {tab === 'events' && <EventsTab />}
        {tab === 'capabilities' && <CapabilitiesTab />}
        {tab === 'fleet' && <FleetTab />}
        {tab === 'health' && <HealthTab />}
        {tab === 'timing' && <TimingTab />}
      </div>
    </div>
  )
}

// ── Events Tab ────────────────────────────────────────────────────

function EventsTab() {
  const [events, setEvents] = useState<DebugEvent[]>([])
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    const wsUrl = `ws://${window.location.hostname}:${window.location.port || 9420}/ws`
    const ws = new WebSocket(wsUrl)
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'subscribe', entityType: '*', entityId: '*' }))
    }
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data)
        setEvents((prev) => [{ ...msg, _ts: Date.now() }, ...prev].slice(0, 100))
      } catch {
        // ignore
      }
    }
    wsRef.current = ws
    return () => ws.close()
  }, [])

  return (
    <div className="p-2 space-y-1">
      {events.length === 0 && <p className="text-xs text-gray-400">No events yet...</p>}
      {events.map((ev, i) => (
        <div key={i} className="text-xs font-mono bg-white p-1.5 rounded truncate">
          <span className="text-gray-400">{new Date(ev._ts).toLocaleTimeString()}</span>{' '}
          <span className="text-blue-600">{ev.type}</span>
          {ev.conversationId && (
            <span className="text-gray-400"> {(ev.conversationId as string).slice(0, 8)}</span>
          )}
        </div>
      ))}
    </div>
  )
}

// ── Capabilities Tab ──────────────────────────────────────────────

function CapabilitiesTab() {
  const [capabilities, setCapabilities] = useState<Capability[]>([])

  useEffect(() => {
    fetch('/api/providers')
      .then((r) => r.json())
      .then((providers: Array<{ id: string }>) => {
        if (providers[0]) {
          return fetch(`/api/providers/${providers[0].id}/capabilities`)
        }
        return null
      })
      .then((r) => r?.json())
      .then((data) => setCapabilities(data?.capabilities ?? []))
      .catch(() => {})
  }, [])

  return (
    <div className="p-2 space-y-1">
      {capabilities.length === 0 && <p className="text-xs text-gray-400">No capabilities loaded</p>}
      {capabilities.map((cap) => (
        <div key={cap.id} className="bg-white p-2 rounded text-xs">
          <div className="flex justify-between">
            <span className="font-medium">{cap.slug}</span>
            <span className="text-gray-400">{cap.uiPosition}</span>
          </div>
          <div className="text-gray-500">{cap.name}</div>
          <div className="mt-1 flex gap-2">
            <span className="text-gray-400">{cap.uiComponent}</span>
            <span className="text-gray-400">tier: {cap.minPlanTier}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Fleet Tab ─────────────────────────────────────────────────────

function FleetTab() {
  const [slaves, setSlaves] = useState<Slave[]>([])

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const resp = await fetch('/api/fleet/status')
        const data = await resp.json()
        if (Array.isArray(data)) setSlaves(data)
      } catch {
        // ignore
      }
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="p-2 space-y-1">
      {slaves.length === 0 && <p className="text-xs text-gray-400">No active slaves</p>}
      {slaves.map((s) => (
        <div key={s.slaveId} className="bg-white p-2 rounded text-xs">
          <div className="flex justify-between">
            <span>
              {s.providerId}/{s.accountId}
            </span>
            <StatusBadge status={s.status} />
          </div>
          <div className="text-gray-400">
            port:{s.debugPort} pid:{s.pid} circuit:{s.circuitState}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Health Tab ────────────────────────────────────────────────────

function HealthTab() {
  const [health, setHealth] = useState<Record<string, ProviderHealth>>({})

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const resp = await fetch('/api/health/providers')
        if (resp.ok) {
          const data = await resp.json()
          if (typeof data === 'object') setHealth(data)
        }
      } catch {
        // ignore
      }
    }, 10_000)
    return () => clearInterval(interval)
  }, [])

  const entries = Object.entries(health)

  return (
    <div className="p-2 space-y-2">
      {entries.length === 0 && <p className="text-xs text-gray-400">No health data</p>}
      {entries.map(([providerId, h]) => (
        <div key={providerId} className="bg-white p-2 rounded">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">{providerId}</span>
            <HealthBadge status={h.status} />
          </div>
          <div className="text-xs text-gray-400 mt-1">Score: {h.score}/100</div>
          {h.signals?.map((sig) => (
            <div key={sig.signal} className="text-xs flex justify-between mt-1">
              <span className="text-gray-500">{sig.signal}</span>
              <span>
                {sig.contribution}/{sig.weight}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// ── Timing Tab ────────────────────────────────────────────────────

function TimingTab() {
  const [timings, setTimings] = useState<Record<string, Record<string, number>>>({})

  useEffect(() => {
    const wsUrl = `ws://${window.location.hostname}:${window.location.port || 9420}/ws`
    const ws = new WebSocket(wsUrl)
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'subscribe', entityType: '*', entityId: '*' }))
    }
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data)
        if (msg.type === 'conversation:complete' && msg.timing) {
          setTimings((prev) => ({
            ...prev,
            [msg.conversationId]: msg.timing,
          }))
        }
      } catch {
        // ignore
      }
    }
    return () => ws.close()
  }, [])

  const entries = Object.entries(timings)

  return (
    <div className="p-2 space-y-2">
      {entries.length === 0 && <p className="text-xs text-gray-400">No timing data yet</p>}
      {entries.map(([convId, timing]) => (
        <div key={convId} className="bg-white p-2 rounded text-xs">
          <div className="font-medium mb-1">
            {convId.slice(0, 8)}: {timing.total ?? 0}ms
          </div>
          <BudgetBar timing={timing} />
          <div className="mt-1 space-y-0.5">
            {Object.entries(timing)
              .filter(([k]) => k !== 'total')
              .map(([stage, ms]) => {
                const budget = LATENCY_BUDGETS[stage]
                const overBudget = budget !== undefined && (ms ?? 0) > budget
                return (
                  <div key={stage} className="flex justify-between">
                    <span className={overBudget ? 'text-red-500 font-medium' : 'text-gray-500'}>
                      {stage}
                    </span>
                    <span className={overBudget ? 'text-red-500' : ''}>
                      {ms}ms{budget !== undefined ? ` / ${budget}` : ''}
                    </span>
                  </div>
                )
              })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Shared Components ─────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    running: 'bg-green-100 text-green-700',
    stopped: 'bg-gray-100 text-gray-500',
    error: 'bg-red-100 text-red-700',
  }
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded ${colors[status] ?? 'bg-gray-100'}`}>
      {status}
    </span>
  )
}

function HealthBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    healthy: 'bg-green-100 text-green-700',
    degraded: 'bg-yellow-100 text-yellow-700',
    unhealthy: 'bg-red-100 text-red-700',
    unknown: 'bg-gray-100 text-gray-500',
  }
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded ${colors[status] ?? 'bg-gray-100'}`}>
      {status}
    </span>
  )
}

function BudgetBar({ timing }: { timing: Record<string, number> }) {
  const total = timing.total ?? 1
  return (
    <div className="flex h-1 rounded overflow-hidden">
      {Object.entries(timing)
        .filter(([k]) => k !== 'total')
        .map(([stage, ms]) => {
          const budget = LATENCY_BUDGETS[stage] ?? 1000
          const overBudget = (ms ?? 0) > budget
          const width = Math.min(100, ((ms ?? 0) / total) * 100)
          return (
            <div
              key={stage}
              className={`h-full ${overBudget ? 'bg-red-400' : 'bg-green-400'}`}
              style={{ width: `${width}%` }}
              title={`${stage}: ${ms}ms / ${budget}ms`}
            />
          )
        })}
    </div>
  )
}
