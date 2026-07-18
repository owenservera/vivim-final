// web/ui/src/features/provider-account-dashboard/accountSlice.ts
// Spec 006 — Provider Account Dashboard state model.
// Plain, framework-free types + pure helpers so the dashboard hook and UI
// stay testable without a renderer. No external state lib required.

export type AccountLoginState =
  | 'authenticated'
  | 'expired'
  | 'locked'
  | 'error'
  | 'never_logged_in'
  | 'pending'

export type AccountSessionHealth = 'healthy' | 'degraded' | 'unknown'

export interface AccountSummary {
  accountId: string
  providerId: string
  providerName: string
  providerIcon: string | null
  loginState: AccountLoginState
  lastLoginAt: number | null
  debugPort: number | null
  sessionHealth: AccountSessionHealth
}

export interface AccountViewState {
  accounts: Record<string, AccountSummary>
  loading: boolean
  error: string | null
  lastEventAt: number | null
}

export const initialAccountState: AccountViewState = {
  accounts: {},
  loading: false,
  error: null,
  lastEventAt: null,
}

export type AccountAction =
  | { type: 'load:start' }
  | { type: 'load:success'; accounts: AccountSummary[] }
  | { type: 'load:error'; error: string }
  | { type: 'event:login_state'; account: AccountSummary }
  | { type: 'event:created'; account: AccountSummary }
  | { type: 'event:removed'; accountId: string }

export function accountReducer(state: AccountViewState, action: AccountAction): AccountViewState {
  switch (action.type) {
    case 'load:start':
      return { ...state, loading: true, error: null }
    case 'load:success': {
      const accounts: Record<string, AccountSummary> = {}
      for (const a of action.accounts) accounts[a.accountId] = a
      return { ...state, loading: false, accounts, error: null }
    }
    case 'load:error':
      return { ...state, loading: false, error: action.error }
    case 'event:login_state':
    case 'event:created':
      return {
        ...state,
        lastEventAt: Date.now(),
        accounts: { ...state.accounts, [action.account.accountId]: action.account },
      }
    case 'event:removed': {
      const next = { ...state.accounts }
      delete next[action.accountId]
      return { ...state, lastEventAt: Date.now(), accounts: next }
    }
    default:
      return state
  }
}

// Map a raw WS/REST payload into a normalized AccountSummary. The backend
// emits account:* events and the /api/accounts route returns the same shape,
// but field names are kept defensive (bigint -> number, optional fields).
export function toAccountSummary(raw: Record<string, unknown>): AccountSummary {
  const loginState = (raw.loginState as AccountLoginState) ?? 'never_logged_in'
  return {
    accountId: String(raw.accountId),
    providerId: String(raw.providerId),
    providerName: raw.providerName != null ? String(raw.providerName) : String(raw.providerId),
    providerIcon: (raw.providerIcon as string | null) ?? null,
    loginState,
    lastLoginAt: raw.lastLoginAt == null ? null : Number(raw.lastLoginAt),
    debugPort: raw.debugPort == null ? null : Number(raw.debugPort),
    sessionHealth:
      (raw.sessionHealth as AccountSessionHealth) ?? sessionHealthFromState(loginState),
  }
}

export function sessionHealthFromState(state: AccountLoginState): AccountSessionHealth {
  if (state === 'authenticated') return 'healthy'
  if (state === 'expired' || state === 'error') return 'degraded'
  return 'unknown'
}
