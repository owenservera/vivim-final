// web/ui/src/features/provider-account-dashboard/ProviderAccountDashboard.tsx
// Spec 006 — real-time provider account dashboard surface.
// Subscribes to account:* WS events and reconciles against GET /api/accounts.
// Actions route through UnifiedCapabilities (cap:account:*).

import { useMemo, useState } from 'react'
import { AccountCard } from './AccountCard'
import { useAccountEvents } from './useAccountEvents'

export function ProviderAccountDashboard() {
  const { accounts, loading, error, connected, refresh, launch, verify, relogin, remove, add } =
    useAccountEvents()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [newProvider, setNewProvider] = useState('')

  const run = useMemo(
    () => async (fn: (id: string) => Promise<void>, id: string) => {
      setBusyId(id)
      try {
        await fn(id)
      } finally {
        setBusyId(null)
      }
    },
    [],
  )

  return (
    <section className="acct-dash" aria-label="Provider account dashboard">
      <header className="acct-dash__bar">
        <div className="acct-dash__title">
          <h2>Provider Accounts</h2>
          <span className={`acct-dash__status ${connected ? 'is-live' : 'is-off'}`}>
            {connected ? 'Live' : 'Offline'}
          </span>
        </div>
        <div className="acct-dash__controls">
          <button type="button" onClick={refresh} data-testid="acct-refresh">
            Refresh
          </button>
          <input
            placeholder="providerId to add"
            value={newProvider}
            onChange={(e) => setNewProvider(e.target.value)}
            data-testid="acct-new-provider"
          />
          <button
            type="button"
            disabled={!newProvider.trim()}
            onClick={() => {
              const pid = newProvider.trim()
              setNewProvider('')
              add(pid)
            }}
            data-testid="acct-add"
          >
            Add account
          </button>
        </div>
      </header>

      {error && (
        <p className="acct-dash__error" role="alert" data-testid="acct-error">
          {error}
        </p>
      )}

      {loading && accounts.length === 0 && (
        <p className="acct-dash__loading" data-testid="acct-loading">
          Loading accounts…
        </p>
      )}

      {!loading && accounts.length === 0 && (
        <p className="acct-dash__empty" data-testid="acct-empty">
          No provider accounts yet. Add one above.
        </p>
      )}

      <div className="acct-dash__grid">
        {accounts.map((a) => (
          <AccountCard
            key={a.accountId}
            account={a}
            busy={busyId === a.accountId}
            onLaunch={(id) => run(launch, id)}
            onVerify={(id) => run(verify, id)}
            onRelogin={(id) => run(relogin, id)}
            onRemove={(id) => run(remove, id)}
          />
        ))}
      </div>
    </section>
  )
}
