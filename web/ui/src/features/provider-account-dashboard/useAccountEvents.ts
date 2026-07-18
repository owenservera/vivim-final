// web/ui/src/features/provider-account-dashboard/useAccountEvents.ts
// Spec 006 — live account dashboard data hook.
// 1. Seeds state from GET /api/accounts (REST).
// 2. Opens a WebSocket, subscribes to the `account` topic, and applies
//    account:login_state / account:created / account:removed events as they
//    arrive (the server also replays current state on subscribe).
// 3. Exposes action dispatchers that call capabilities via the SDK client.

import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { useCapStore } from '../../sdk/CapStoreProvider'
import {
  type AccountSummary,
  accountReducer,
  initialAccountState,
  toAccountSummary,
} from './accountSlice'

interface UseAccountEvents {
  accounts: AccountSummary[]
  loading: boolean
  error: string | null
  connected: boolean
  refresh: () => void
  launch: (accountId: string) => Promise<void>
  verify: (accountId: string) => Promise<void>
  remove: (accountId: string) => Promise<void>
  add: (providerId: string) => Promise<void>
  relogin: (accountId: string) => Promise<void>
}

const ACCOUNT_EVENTS = new Set(['account:login_state', 'account:created', 'account:removed'])

export function useAccountEvents(): UseAccountEvents {
  const sdk = useCapStore()
  const [state, dispatch] = useReducer(accountReducer, initialAccountState)
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)

  const load = useCallback(async () => {
    dispatch({ type: 'load:start' })
    try {
      const res = await sdk.client.listAccounts()
      dispatch({
        type: 'load:success',
        accounts: res.accounts.map((a) =>
          toAccountSummary(a as unknown as Record<string, unknown>),
        ),
      })
    } catch (e) {
      dispatch({ type: 'load:error', error: e instanceof Error ? e.message : String(e) })
    }
  }, [sdk])

  // Open WS + subscribe to `account` topic.
  useEffect(() => {
    let active = true
    const ws = sdk.client.connectWebSocket()
    wsRef.current = ws

    ws.onopen = () => {
      if (!active) return
      setConnected(true)
      ws.send(JSON.stringify({ type: 'subscribe', entityType: 'account', entityId: '*' }))
    }
    ws.onclose = () => active && setConnected(false)
    ws.onerror = () => active && setConnected(false)
    ws.onmessage = (ev) => {
      let msg: Record<string, unknown>
      try {
        msg = JSON.parse(ev.data as string)
      } catch {
        return
      }
      if (!msg.type || !ACCOUNT_EVENTS.has(msg.type as string)) return
      if (msg.type === 'account:removed') {
        dispatch({ type: 'event:removed', accountId: String(msg.accountId) })
      } else {
        // account:login_state / account:created carry a full summary.
        const summary = toAccountSummary(msg)
        dispatch({
          type: msg.type === 'account:created' ? 'event:created' : 'event:login_state',
          account: summary,
        })
      }
    }

    return () => {
      active = false
      try {
        ws.close()
      } catch {
        /* ignore */
      }
      wsRef.current = null
    }
  }, [sdk])

  // Seed from REST once on mount.
  useEffect(() => {
    load()
  }, [load])

  const exec = useCallback(
    async (capabilityId: string, input: Record<string, unknown>) => {
      await sdk.client.executeCapability(capabilityId, input)
    },
    [sdk],
  )

  const launch = useCallback(
    (accountId: string) => exec('cap:account:launch_reconnect', { accountId }),
    [exec],
  )
  const verify = useCallback(
    (accountId: string) => exec('cap:account:verify', { accountId }),
    [exec],
  )
  const remove = useCallback(
    (accountId: string) => exec('cap:account:remove', { accountId, confirm: true }),
    [exec],
  )
  const add = useCallback((providerId: string) => exec('cap:account:add', { providerId }), [exec])
  const relogin = useCallback(
    (accountId: string) => exec('cap:account:relogin', { accountId }),
    [exec],
  )

  const accounts = Object.values(state.accounts).sort(
    (a, b) =>
      a.providerName.localeCompare(b.providerName) || a.accountId.localeCompare(b.accountId),
  )

  return {
    accounts,
    loading: state.loading,
    error: state.error,
    connected,
    refresh: load,
    launch,
    verify,
    remove,
    add,
    relogin,
  }
}
