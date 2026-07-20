// web/ui/src/features/capabilities/CapabilityDashboard.tsx
// Interactive capability explorer — full frontend parity with backend registry.
// Every registered capability is executable from here with input/output display.

import { useState } from 'react'

interface Capability {
  id: string
  slug: string
  name: string
  description?: string
  category: string
  surfaces?: string[]
  inputSchema?: Record<string, unknown>
  outputSchema?: Record<string, unknown>
  ui?: { component?: string; position?: string }
}

interface Props {
  capabilities: Capability[]
  error: string | null
}

async function executeCapability(slug: string, input?: Record<string, unknown>) {
  const r = await fetch(`/api/capabilities/${encodeURIComponent(slug)}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: input ?? {} }),
    signal: AbortSignal.timeout(30_000),
  })
  const j = await r.json()
  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`)
  return j
}

function CapCard({ cap }: { cap: Capability }) {
  const [expanded, setExpanded] = useState(false)
  const [input, setInput] = useState('{}')
  const [result, setResult] = useState<unknown>(null)
  const [running, setRunning] = useState(false)
  const [execError, setExecError] = useState<string | null>(null)

  const hasSurfaces = cap.surfaces && cap.surfaces.length > 0
  const required = (cap.inputSchema?.required as string[] | undefined) ?? []

  const execute = async () => {
    setRunning(true)
    setExecError(null)
    try {
      const parsed = JSON.parse(input)
      const r = await executeCapability(cap.slug, parsed)
      setResult(r)
    } catch (e) {
      setExecError(e instanceof Error ? e.message : String(e))
    } finally {
      setRunning(false)
    }
  }

  return (
    <div style={{
      border: '1px solid #e5e7eb', borderRadius: 10, padding: 14, marginBottom: 10,
      background: '#fff', transition: 'box-shadow 0.15s',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
        onClick={() => setExpanded(!expanded)}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>{cap.name}</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
            <code style={{ background: '#f3f4f6', padding: '1px 6px', borderRadius: 4, fontSize: 11 }}>{cap.slug}</code>
            <span style={{ marginLeft: 8 }}>{cap.category}</span>
            {hasSurfaces && <span style={{ marginLeft: 8, color: '#2563eb', fontSize: 11 }}>{cap.surfaces!.join(', ')}</span>}
          </div>
        </div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); void execute() }}
          disabled={running}
          style={{
            padding: '5px 14px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600,
            background: running ? '#93c5fd' : '#2563eb', color: '#fff', cursor: running ? 'wait' : 'pointer',
          }}
        >
          {running ? '…' : 'Execute'}
        </button>
      </div>

      {expanded && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #f0f0f0' }}>
          {cap.description && (
            <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 8px' }}>{cap.description}</p>
          )}
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>
              Input {required.length > 0 && `(required: ${required.join(', ')})`}
            </div>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={4}
              style={{
                width: '100%', padding: 8, borderRadius: 6, border: '1px solid #d1d5db',
                fontSize: 12, fontFamily: 'monospace', resize: 'vertical', background: '#fafafa',
              }}
            />
          </div>

          {execError && (
            <div style={{ padding: '6px 10px', borderRadius: 6, background: '#fef2f2', color: '#b91c1c', fontSize: 12, marginBottom: 8 }}>
              {execError}
            </div>
          )}

          {result !== null && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>Result</div>
              <pre style={{
                margin: 0, padding: 10, borderRadius: 6, background: '#f8fafc',
                border: '1px solid #e5e7eb', fontSize: 12, overflow: 'auto', maxHeight: 300,
              }}>
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function CapabilityDashboard({ capabilities, error }: Props) {
  const [filter, setFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)

  const categories = [...new Set(capabilities.map((c) => c.category).filter(Boolean))].sort()

  const filtered = capabilities.filter((c) => {
    if (categoryFilter && c.category !== categoryFilter) return false
    if (filter && !c.name.toLowerCase().includes(filter.toLowerCase()) && !c.slug.toLowerCase().includes(filter.toLowerCase())) return false
    return true
  })

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 24, overflowY: 'auto', height: '100%' }}>
      {error && <p style={{ color: '#e55', padding: '8px 12px', background: '#fef2f2', borderRadius: 6 }}>{error}</p>}
      <h2 style={{ margin: '0 0 16px', fontSize: 20, fontWeight: 700 }}>Capability Dashboard ({capabilities.length})</h2>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Filter capabilities…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 13, flex: 1, minWidth: 200 }}
        />
        {categories.map((cat) => (
          <button key={cat} type="button"
            onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
            style={{
              padding: '4px 10px', borderRadius: 6, border: '1px solid', fontSize: 12,
              background: categoryFilter === cat ? '#dbeafe' : '#fff',
              borderColor: categoryFilter === cat ? '#2563eb' : '#d1d5db',
              color: categoryFilter === cat ? '#1e40af' : '#374151',
              cursor: 'pointer',
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p style={{ color: '#9ca3af', fontSize: 13 }}>No capabilities match.</p>
      ) : (
        filtered.map((cap) => <CapCard key={cap.id} cap={cap} />)
      )}
    </div>
  )
}
