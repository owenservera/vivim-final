// web/ui/src/features/provider-account-dashboard/AccountCard.tsx
// Spec 006 — single account card with live status + actions.

import type { AccountLoginState, AccountSessionHealth, AccountSummary } from './accountSlice'

const STATE_LABEL: Record<AccountLoginState, string> = {
  authenticated: 'Active',
  expired: 'Expired',
  locked: 'Locked',
  error: 'Error',
  never_logged_in: 'Not started',
  pending: 'Pending',
}

const STATE_CLASS: Record<AccountLoginState, string> = {
  authenticated: 'acct-state acct-state--ok',
  expired: 'acct-state acct-state--warn',
  locked: 'acct-state acct-state--bad',
  error: 'acct-state acct-state--bad',
  never_logged_in: 'acct-state acct-state--idle',
  pending: 'acct-state acct-state--warn',
}

const HEALTH_DOT: Record<AccountSessionHealth, string> = {
  healthy: 'acct-health acct-health--ok',
  degraded: 'acct-health acct-health--warn',
  unknown: 'acct-health acct-health--idle',
}

interface Props {
  account: AccountSummary
  busy?: boolean
  onLaunch: (id: string) => void
  onVerify: (id: string) => void
  onRelogin: (id: string) => void
  onRemove: (id: string) => void
}

export function AccountCard({ account, busy, onLaunch, onVerify, onRelogin, onRemove }: Props) {
  const lastLogin = account.lastLoginAt ? new Date(account.lastLoginAt).toLocaleString() : 'never'

  return (
    <article className="acct-card" data-testid={`acct-card-${account.accountId}`}>
      <header className="acct-card__head">
        <div className="acct-card__title">
          <span className="acct-card__provider">{account.providerName}</span>
          <span className="acct-card__id">{account.accountId}</span>
        </div>
        <span className={STATE_CLASS[account.loginState]}>{STATE_LABEL[account.loginState]}</span>
      </header>

      <div className="acct-card__meta">
        <span className={HEALTH_DOT[account.sessionHealth]} />
        <span className="acct-card__health-text">{account.sessionHealth}</span>
        <span className="acct-card__sep">·</span>
        <span>Last login: {lastLogin}</span>
        {account.debugPort != null && (
          <>
            <span className="acct-card__sep">·</span>
            <span>CDP :{account.debugPort}</span>
          </>
        )}
      </div>

      <footer className="acct-card__actions">
        <button
          type="button"
          disabled={busy}
          onClick={() => onLaunch(account.accountId)}
          data-testid={`acct-launch-${account.accountId}`}
        >
          Launch
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onVerify(account.accountId)}
          data-testid={`acct-verify-${account.accountId}`}
        >
          Verify
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onRelogin(account.accountId)}
          data-testid={`acct-relogin-${account.accountId}`}
        >
          Re-login
        </button>
        <button
          type="button"
          className="acct-card__danger"
          disabled={busy}
          onClick={() => onRemove(account.accountId)}
          data-testid={`acct-remove-${account.accountId}`}
        >
          Remove
        </button>
      </footer>
    </article>
  )
}
