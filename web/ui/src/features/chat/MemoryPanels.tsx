// web/ui/src/features/chat/MemoryPanels.tsx
// Spec 003 (P2) — surface the existing MemoryEngine / SemanticSearchEngine /
// CrossConversationSynthesizer in the chat UI as three collapsible panels:
//   1. Memory Context   — relevant facts / episodes via cap:memory:query
//   2. Semantic Search  — text-match + embedding search via cap:knowledge:search
//   3. Knowledge Synthesis — cross-conversation synthesis via cap:knowledge:synthesize
//
// All three backend engines are wired as UnifiedCapabilities; this component is
// the thin frontend that calls them through capabilityApi.execute (One Entry Point).

import { useCallback, useState, type ReactNode } from 'react'
import { capabilityApi } from '../../api/client.js'

interface MemoryPanelsProps {
  conversationId?: string | null
  providerId?: string
}

type SearchTab = 'text' | 'semantic'

export function MemoryPanels({ conversationId }: MemoryPanelsProps): ReactNode {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: 12,
        height: '100%',
        overflow: 'auto',
        color: 'var(--text-primary, #f9fafb)',
      }}
    >
      <MemoryContextPanel conversationId={conversationId} />
      <SemanticSearchPanel />
      <KnowledgeSynthesisPanel />
    </div>
  )
}

function Panel({
  title,
  defaultOpen = false,
  children,
  right,
}: {
  title: string
  defaultOpen?: boolean
  children: ReactNode
  right?: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div
      style={{
        border: '1px solid var(--border-primary, #374151)',
        borderRadius: 10,
        background: 'var(--bg-secondary, #1f2937)',
        overflow: 'hidden',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          background: 'transparent',
          border: 'none',
          color: 'var(--text-primary, #f9fafb)',
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        <span>{title}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {right}
          <span style={{ color: 'var(--text-muted, #6b7280)' }}>{open ? '\u25BC' : '\u25B6'}</span>
        </span>
      </button>
      {open && <div style={{ padding: '0 14px 14px' }}>{children}</div>}
    </div>
  )
}

function MemoryContextPanel({ conversationId }: { conversationId?: string | null }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [facts, setFacts] = useState<string[]>([])

  const refresh = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await capabilityApi.execute('cap:memory:query', {
        query: conversationId ? `context for ${conversationId}` : 'recent',
      })
      const out = (res.result ?? { results: [] }) as { results?: Array<{ text?: string; fact?: string }> }
      setFacts((out.results ?? []).map((r) => r.text ?? r.fact ?? '').filter(Boolean))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Memory query failed')
    } finally {
      setBusy(false)
    }
  }, [conversationId])

  return (
    <Panel title="Memory Context" right={<button type="button" onClick={(ev) => { ev.stopPropagation(); void refresh() }} style={miniBtn}>Refresh</button>}>
      {busy && <p style={muted}>Loading memory…</p>}
      {error && <p style={{ ...muted, color: 'var(--danger, #ef4444)' }}>{error}</p>}
      {!busy && !error && facts.length === 0 && (
        <p style={muted}>No relevant facts yet. Memory builds as you chat.</p>
      )}
      {facts.map((f, i) => (
        <div key={i} style={{ fontSize: 12, padding: '6px 0', borderTop: i ? '1px solid var(--border-primary, #374151)' : 'none' }}>
          {f}
        </div>
      ))}
    </Panel>
  )
}

function SemanticSearchPanel() {
  const [tab, setTab] = useState<SearchTab>('semantic')
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<Array<{ text?: string; title?: string; ts?: string }>>([])

  const run = useCallback(async () => {
    if (!q.trim()) return
    setBusy(true)
    setError(null)
    try {
      // Text-match uses the same knowledge search cap (text index); semantic uses
      // the embedding path on the engine. Both route through cap:knowledge:search.
      const res = await capabilityApi.execute('cap:knowledge:search', {
        q,
        mode: tab === 'semantic' ? 'semantic' : 'text',
      })
      const out = (res.result ?? []) as Array<{ text?: string; title?: string; ts?: string }>
      setResults(out)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed')
    } finally {
      setBusy(false)
    }
  }, [q, tab])

  return (
    <Panel title="Semantic Search">
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        {(['semantic', 'text'] as SearchTab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            style={{
              ...miniBtn,
              background: tab === t ? 'var(--accent-primary, #6366f1)' : 'var(--bg-tertiary, #374151)',
              color: tab === t ? '#fff' : 'var(--text-secondary, #d1d5db)',
            }}
          >
            {t === 'semantic' ? 'Semantic' : 'Text Match'}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void run() }}
          placeholder="Search conversations…"
          style={inputStyle}
        />
        <button type="button" onClick={() => void run()} disabled={busy} style={miniBtn}>
          {busy ? '…' : 'Go'}
        </button>
      </div>
      {error && <p style={{ ...muted, color: 'var(--danger, #ef4444)' }}>{error}</p>}
      {results.map((r, i) => (
        <div key={i} style={{ fontSize: 12, padding: '6px 0', borderTop: i ? '1px solid var(--border-primary, #374151)' : 'none' }}>
          <div>{r.text ?? r.title ?? '(no text)'}</div>
          {r.ts && <div style={muted}>{r.ts}</div>}
        </div>
      ))}
    </Panel>
  )
}

function KnowledgeSynthesisPanel() {
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [answer, setAnswer] = useState<string | null>(null)

  const run = useCallback(async () => {
    if (!q.trim()) return
    setBusy(true)
    setError(null)
    setAnswer(null)
    try {
      const res = await capabilityApi.execute('cap:knowledge:synthesize', { question: q })
      const out = (res.result ?? { answer: '' }) as { answer?: string }
      setAnswer(out.answer ?? '')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Synthesis failed')
    } finally {
      setBusy(false)
    }
  }, [q])

  return (
    <Panel title="Knowledge Synthesis">
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void run() }}
          placeholder="What did we decide about…?"
          style={inputStyle}
        />
        <button type="button" onClick={() => void run()} disabled={busy} style={miniBtn}>
          {busy ? '…' : 'Synthesize'}
        </button>
      </div>
      {error && <p style={{ ...muted, color: 'var(--danger, #ef4444)' }}>{error}</p>}
      {answer && <p style={{ fontSize: 13, lineHeight: 1.6, marginTop: 8 }}>{answer}</p>}
    </Panel>
  )
}

const miniBtn: React.CSSProperties = {
  padding: '4px 10px',
  fontSize: 12,
  borderRadius: 6,
  border: '1px solid var(--border-primary, #374151)',
  background: 'var(--bg-tertiary, #374151)',
  color: 'var(--text-secondary, #d1d5db)',
  cursor: 'pointer',
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: '6px 10px',
  fontSize: 13,
  borderRadius: 6,
  border: '1px solid var(--border-primary, #374151)',
  background: 'var(--bg-primary, #111827)',
  color: 'var(--text-primary, #f9fafb)',
}

const muted: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--text-muted, #6b7280)',
  margin: '4px 0',
}
