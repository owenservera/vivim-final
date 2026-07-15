import { useState, useEffect, type CSSProperties } from 'react'
import { ChatPage } from './features/chat/ChatPage.js'
import { ProviderSetupWizard } from './features/provider-setup-wizard.js'

interface Health {
  db: boolean
  server: boolean
}

interface Capability {
  id: string
  name: string
  category: string
}

type Tab = 'chat' | 'capabilities' | 'setup'

export function App() {
  const [tab, setTab] = useState<Tab>('chat')
  const [health, setHealth] = useState<Health | null>(null)
  const [capabilities, setCapabilities] = useState<Capability[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const baseUrl = import.meta.env.VITE_API_URL ?? ''

    fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(5000) })
      .then((r) => r.json())
      .then((h) => setHealth(h))
      .catch((e) => setError(`Backend unreachable: ${e.message}`))

    fetch(`${baseUrl}/api/capabilities`, { signal: AbortSignal.timeout(5000) })
      .then((r) => r.json())
      .then((data) => {
        const caps = Array.isArray(data) ? data : data.capabilities ?? []
        setCapabilities(caps)
      })
      .catch(() => {})
  }, [])

  const tabStyle = (active: boolean): CSSProperties => ({
    padding: '10px 16px',
    border: 'none',
    borderBottom: active ? '2px solid #2563eb' : '2px solid transparent',
    background: 'transparent',
    color: active ? '#1d4ed8' : '#6b7280',
    fontSize: 14,
    fontWeight: active ? 600 : 400,
    cursor: 'pointer',
  })

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid #e5e7eb', padding: '0 16px' }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginRight: 24 }}>vivim</div>
        <nav style={{ display: 'flex' }}>
          <button type="button" style={tabStyle(tab === 'chat')} onClick={() => setTab('chat')}>
            Chat
          </button>
          <button
            type="button"
            style={tabStyle(tab === 'capabilities')}
            onClick={() => setTab('capabilities')}
          >
            Capabilities
          </button>
          <button type="button" style={tabStyle(tab === 'setup')} onClick={() => setTab('setup')}>
            Setup
          </button>
        </nav>
        <div style={{ marginLeft: 'auto', fontSize: 12, color: health?.server ? '#059669' : '#dc2626' }}>
          {health ? (health.server ? 'server: ok' : 'server: down') : 'connecting…'}
        </div>
      </header>

      <main style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {tab === 'chat' && <ChatPage />}
        {tab === 'capabilities' && (
          <div style={{ maxWidth: 800, margin: '0 auto', padding: 24, overflowY: 'auto', height: '100%' }}>
            {error && <p style={{ color: '#e55' }}>{error}</p>}
            <h2>Capabilities ({capabilities.length})</h2>
            {capabilities.length > 0 ? (
              <ul>
                {capabilities.slice(0, 30).map((c) => (
                  <li key={c.id}>
                    <code>{c.id}</code> — {c.name}
                  </li>
                ))}
                {capabilities.length > 30 && <li>...and {capabilities.length - 30} more</li>}
              </ul>
            ) : (
              <p>No capabilities found.</p>
            )}
          </div>
        )}
        {tab === 'setup' && <ProviderSetupWizard />}
      </main>
    </div>
  )
}
