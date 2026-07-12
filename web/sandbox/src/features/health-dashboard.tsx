import { useEffect, useState, useCallback } from 'react'

interface ProviderHealth {
  status: string
  score: number
  signals: Array<{
    signal: string
    weight: number
    value: number
    contribution: number
    detail: string
  }>
  updatedAt: number
  parsers: { confidenceAvg: number; emptyStreamRatio1h: number }
  capabilities: { selectorHitRate: number; prospectCount: number }
  fleet: { running: number; stopped: number; error: number }
  circuitBreakers: { open: number; total: number }
  drifts: { recent: number; unresolved: number }
}

const STATUS_STYLES: Record<string, string> = {
  healthy: 'bg-green-100 text-green-700',
  degraded: 'bg-yellow-100 text-yellow-700',
  unhealthy: 'bg-red-100 text-red-700',
  unknown: 'bg-gray-100 text-gray-500',
}

export function HealthDashboard() {
  const [health, setHealth] = useState<Record<string, ProviderHealth>>({})
  const [loading, setLoading] = useState(true)

  const loadHealth = useCallback(async () => {
    try {
      const resp = await fetch('/api/health/providers')
      const data = await resp.json()
      if (typeof data === 'object' && data !== null) {
        setHealth(data)
      }
    } catch (err) {
      console.error('Failed to load health:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadHealth()
    const interval = setInterval(loadHealth, 15_000)
    return () => clearInterval(interval)
  }, [loadHealth])

  if (loading) {
    return (
      <div className="p-4">
        <p className="text-sm text-gray-400">Loading health data...</p>
      </div>
    )
  }

  const providers = Object.entries(health)

  if (providers.length === 0) {
    return (
      <div className="p-4">
        <p className="text-sm text-gray-400">No provider health data yet</p>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Provider Health</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {providers.map(([providerId, h]) => (
          <div key={providerId} className="border border-gray-200 rounded-lg p-3 bg-white">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-800 capitalize">{providerId}</span>
              <span className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_STYLES[h.status] ?? STATUS_STYLES.unknown}`}>
                {h.status}
              </span>
            </div>
            <div className="text-2xl font-bold text-gray-900 mb-2">{h.score}</div>
            <div className="space-y-1 text-xs text-gray-500">
              <div className="flex justify-between">
                <span>Fleet</span>
                <span>{h.fleet.running} running / {h.fleet.stopped + h.fleet.error} stopped</span>
              </div>
              <div className="flex justify-between">
                <span>Selector hit rate</span>
                <span>{h.capabilities.selectorHitRate}%</span>
              </div>
              <div className="flex justify-between">
                <span>Confidence avg</span>
                <span>{h.parsers.confidenceAvg}%</span>
              </div>
              <div className="flex justify-between">
                <span>Circuit breakers</span>
                <span>{h.circuitBreakers.open}/{h.circuitBreakers.total} open</span>
              </div>
              <div className="flex justify-between">
                <span>Drifts (24h)</span>
                <span>{h.drifts.recent} recent / {h.drifts.unresolved} unresolved</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
