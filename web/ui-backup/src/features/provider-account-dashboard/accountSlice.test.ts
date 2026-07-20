// web/ui/src/features/provider-account-dashboard/accountSlice.test.ts
// Spec 006 — reducer unit tests (no renderer required).

import { describe, expect, it } from 'bun:test'
import {
  type AccountSummary,
  accountReducer,
  initialAccountState,
  sessionHealthFromState,
  toAccountSummary,
} from './accountSlice'

const mk = (over: Partial<AccountSummary> = {}): AccountSummary => ({
  accountId: 'acc-1',
  providerId: 'prov-1',
  providerName: 'Acme',
  providerIcon: null,
  loginState: 'authenticated',
  lastLoginAt: 1000,
  debugPort: 9222,
  sessionHealth: 'healthy',
  ...over,
})

describe('accountSlice', () => {
  it('seeds accounts on load:success', () => {
    const next = accountReducer(initialAccountState, {
      type: 'load:success',
      accounts: [mk(), mk({ accountId: 'acc-2' })],
    })
    expect(Object.keys(next.accounts)).toEqual(['acc-1', 'acc-2'])
    expect(next.loading).toBe(false)
  })

  it('upserts on event:login_state', () => {
    const start = accountReducer(initialAccountState, {
      type: 'load:success',
      accounts: [mk({ loginState: 'authenticated' })],
    })
    const next = accountReducer(start, {
      type: 'event:login_state',
      account: mk({ loginState: 'expired', sessionHealth: 'degraded' }),
    })
    expect(next.accounts['acc-1'].loginState).toBe('expired')
    expect(next.lastEventAt).not.toBeNull()
  })

  it('removes on event:removed', () => {
    const start = accountReducer(initialAccountState, {
      type: 'load:success',
      accounts: [mk()],
    })
    const next = accountReducer(start, { type: 'event:removed', accountId: 'acc-1' })
    expect(next.accounts['acc-1']).toBeUndefined()
  })

  it('derives health from login state when missing', () => {
    const s = toAccountSummary({
      accountId: 'x',
      providerId: 'p',
      loginState: 'expired',
    })
    expect(s.sessionHealth).toBe('degraded')
    expect(s.providerName).toBe('p')
    expect(s.providerIcon).toBeNull()
  })

  it('sessionHealthFromState maps states', () => {
    expect(sessionHealthFromState('authenticated')).toBe('healthy')
    expect(sessionHealthFromState('error')).toBe('degraded')
    expect(sessionHealthFromState('never_logged_in')).toBe('unknown')
  })
})
