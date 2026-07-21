'use client'

/**
 * components/canvas/AuditDashboard.tsx (#8)
 * --------------------------------------------------------------------
 * Audit Trail Dashboard — visual timeline of trace entries.
 * Filter by engine, ok/failed, time range. Stats: total, ok, failed,
 * avg/p95 duration, 24h hourly buckets (mini bar chart).
 *
 * Export as JSON lines (NDJSON).
 */

import { useEffect, useState } from 'react'
import { getApiUrl } from '../../shared/api-config'
import type { AuditEntry, AuditStats } from '../../shared/audit'

export function AuditDashboard({ workspaceId }: { workspaceId: string }) {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [stats, setStats] = useState<AuditStats | null>(null)
  const [filter, setFilter] = useState<{ engine?: string; ok?: boolean; limit: number }>({
    limit: 100,
  })

  const fetchAudit = async () => {
    const params = new URLSearchParams({ limit: String(filter.limit) })
    if (filter.engine) params.set('engine', filter.engine)
    if (filter.ok !== undefined) params.set('ok', String(filter.ok))
    const res = await fetch(getApiUrl(`/api/audit/list?${params}`))
    const data = (await res.json()) as { ok: boolean; entries: AuditEntry[] }
    if (data.ok) setEntries(data.entries)

    const sRes = await fetch(getApiUrl(`/api/audit/stats?${params}`))
    const sData = (await sRes.json()) as { ok: boolean; stats: AuditStats }
    if (sData.ok) setStats(sData.stats)
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAudit()
    const t = setInterval(fetchAudit, 15_000)
    return () => clearInterval(t)
  }, [filter, workspaceId])

  const exportAudit = async () => {
    const params = new URLSearchParams()
    if (filter.engine) params.set('engine', filter.engine)
    const res = await fetch(getApiUrl(`/api/audit/export?${params}`))
    const text = await res.text()
    const blob = new Blob([text], { type: 'application/x-ndjson' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-${Date.now()}.ndjson`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div
      style={{
        padding: 16,
        fontFamily: 'ui-sans-serif, system-ui',
        color: 'var(--text)',
        background: 'var(--bg)',
        height: '100%',
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 18 }}>Audit Trail</h2>
        <button onClick={exportAudit} style={btnPrimary}>
          ⬇ Export NDJSON
        </button>
      </div>

      {/* Stats cards */}
      {stats && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 8,
            marginBottom: 16,
          }}
        >
          <StatCard label="Total" value={stats.total} color="var(--text)" />
          <StatCard label="OK" value={stats.ok} color="#10b981" />
          <StatCard label="Failed" value={stats.failed} color="#ef4444" />
          <StatCard label="Avg ms" value={stats.avgDurationMs} color="var(--accent)" />
        </div>
      )}

      {/* Hourly buckets */}
      {stats && stats.hourlyBuckets.length > 0 && (
        <div
          style={{
            padding: 12,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            marginBottom: 16,
          }}
        >
          <div
            style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}
          >
            Last 24 hours
          </div>
          <div style={{ display: 'flex', gap: 1, alignItems: 'flex-end', height: 60 }}>
            {stats.hourlyBuckets.map((b, i) => {
              const maxCount = Math.max(...stats.hourlyBuckets.map((x) => x.count), 1)
              const h = (b.count / maxCount) * 50
              const failRatio = b.count > 0 ? b.failed / b.count : 0
              return (
                <div
                  key={i}
                  title={`${b.hour}: ${b.count} (${b.ok} ok, ${b.failed} failed)`}
                  style={{
                    flex: 1,
                    height: Math.max(2, h),
                    background: failRatio > 0.3 ? '#ef4444' : failRatio > 0 ? '#f59e0b' : '#10b981',
                    borderRadius: '2px 2px 0 0',
                    opacity: 0.85,
                  }}
                />
              )
            })}
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 4,
              fontSize: 9,
              color: 'var(--text-subtle)',
            }}
          >
            <span>{stats.hourlyBuckets[0]?.hour}</span>
            <span>{stats.hourlyBuckets[Math.floor(stats.hourlyBuckets.length / 2)]?.hour}</span>
            <span>{stats.hourlyBuckets[stats.hourlyBuckets.length - 1]?.hour}</span>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <select
          value={filter.engine ?? ''}
          onChange={(e) => setFilter((f) => ({ ...f, engine: e.target.value || undefined }))}
          style={selectStyle}
        >
          <option value="">All engines</option>
          {stats &&
            Object.keys(stats.byEngine).map((e) => (
              <option key={e} value={e}>
                {e} ({stats.byEngine[e]})
              </option>
            ))}
        </select>
        <select
          value={filter.ok === undefined ? '' : filter.ok ? 'ok' : 'failed'}
          onChange={(e) =>
            setFilter((f) => ({
              ...f,
              ok: e.target.value === '' ? undefined : e.target.value === 'ok',
            }))
          }
          style={selectStyle}
        >
          <option value="">All status</option>
          <option value="ok">OK only</option>
          <option value="failed">Failed only</option>
        </select>
        <select
          value={String(filter.limit)}
          onChange={(e) => setFilter((f) => ({ ...f, limit: Number(e.target.value) }))}
          style={selectStyle}
        >
          <option value="50">Last 50</option>
          <option value="100">Last 100</option>
          <option value="500">Last 500</option>
        </select>
      </div>

      {/* Timeline */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {entries.length === 0 && (
          <div
            style={{ padding: 24, textAlign: 'center', color: 'var(--text-subtle)', fontSize: 12 }}
          >
            No audit entries
          </div>
        )}
        {entries.map((e) => (
          <div
            key={e.id}
            style={{
              padding: '6px 10px',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderLeft: `3px solid ${e.ok ? '#10b981' : '#ef4444'}`,
              borderRadius: 4,
              fontSize: 11,
              display: 'flex',
              gap: 8,
              alignItems: 'center',
            }}
          >
            <span
              style={{
                color: 'var(--text-muted)',
                fontFamily: 'ui-monospace, monospace',
                fontSize: 10,
              }}
            >
              {new Date(e.createdAt).toLocaleTimeString()}
            </span>
            <span style={{ fontWeight: 600, minWidth: 120 }}>{e.engine}</span>
            <span style={{ color: 'var(--text-muted)', flex: 1 }}>{e.method}</span>
            {e.capabilityId && (
              <code style={{ fontSize: 9, color: 'var(--text-subtle)' }}>{e.capabilityId}</code>
            )}
            <span
              style={{
                color: 'var(--text-subtle)',
                fontFamily: 'ui-monospace, monospace',
                fontSize: 10,
              }}
            >
              {e.durationMs}ms
            </span>
            {e.workspaceId && (
              <span style={{ fontSize: 9, color: 'var(--text-subtle)' }}>
                {e.workspaceId.slice(0, 16)}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      style={{
        padding: 10,
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 8,
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color, marginTop: 2 }}>
        {value.toLocaleString()}
      </div>
    </div>
  )
}

const btnPrimary: React.CSSProperties = {
  padding: '6px 12px',
  background: 'var(--accent)',
  color: 'var(--accent-fg)',
  border: 'none',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 600,
  fontFamily: 'inherit',
}
const selectStyle: React.CSSProperties = {
  padding: '4px 8px',
  border: '1px solid var(--border)',
  background: 'var(--bg-elevated)',
  color: 'var(--text)',
  borderRadius: 4,
  fontSize: 11,
  fontFamily: 'inherit',
}
