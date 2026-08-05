'use client'

/**
 * ConversationSyncPanel — UI for syncing conversation history from providers.
 *
 * Features:
 * - Select provider + account
 * - Trigger sync (full/incremental)
 * - View sync status and logs
 * - View synced conversations
 */

import { useState, useEffect, useCallback } from 'react'
import { useConversationSync, type SyncResult, type SyncLog } from '@/sdk/web/use-conversation-sync'

// ── Types ────────────────────────────────────────────────────────────────────

interface Provider {
  id: string
  name: string
  slug: string
}

interface Account {
  id: string
  email: string
  providerId: string
}

// ── Component ────────────────────────────────────────────────────────────────

export function ConversationSyncPanel() {
  const { syncing, error, lastResult, sync, getLogs } = useConversationSync()

  // Form state
  const [providers, setProviders] = useState<Provider[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedProvider, setSelectedProvider] = useState('')
  const [selectedAccount, setSelectedAccount] = useState('')
  const [slaveId, setSlaveId] = useState('')
  const [syncType, setSyncType] = useState<'full' | 'incremental'>('incremental')
  const [headersOnly, setHeadersOnly] = useState(false)

  // Logs state
  const [logs, setLogs] = useState<SyncLog[]>([])
  const [logsLoading, setLogsLoading] = useState(false)

  // Load providers on mount
  useEffect(() => {
    const loadProviders = async () => {
      try {
        const res = await fetch('/api/providers')
        const data = await res.json()
        if (Array.isArray(data)) {
          setProviders(data.map((p: Provider) => ({ id: p.id, name: p.name, slug: p.slug })))
        }
      } catch {
        // Ignore — providers will be empty
      }
    }
    loadProviders()
  }, [])

  // Load accounts when provider changes
  useEffect(() => {
    if (!selectedProvider) {
      setAccounts([])
      return
    }
    const loadAccounts = async () => {
      try {
        const res = await fetch(`/api/providers/${selectedProvider}/accounts`)
        const data = await res.json()
        if (Array.isArray(data)) {
          setAccounts(data.map((a: Account) => ({ id: a.id, email: a.email, providerId: a.providerId })))
        }
      } catch {
        setAccounts([])
      }
    }
    loadAccounts()
  }, [selectedProvider])

  // Load logs when account changes
  const loadLogs = useCallback(async () => {
    if (!selectedProvider || !selectedAccount) return
    setLogsLoading(true)
    try {
      const result = await getLogs(selectedProvider, selectedAccount)
      setLogs(result)
    } finally {
      setLogsLoading(false)
    }
  }, [selectedProvider, selectedAccount, getLogs])

  useEffect(() => {
    loadLogs()
  }, [loadLogs])

  // Handle sync
  const handleSync = async () => {
    if (!selectedProvider || !selectedAccount || !slaveId) return
    await sync(selectedProvider, selectedAccount, slaveId, {
      syncType,
      headersOnly,
    })
    // Refresh logs after sync
    await loadLogs()
  }

  return (
    <div style={{ padding: '16px', fontFamily: 'system-ui, sans-serif' }}>
      <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>
        Conversation History Sync
      </h2>

      {/* Sync Form */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
        {/* Provider */}
        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>
            Provider
          </label>
          <select
            value={selectedProvider}
            onChange={(e) => setSelectedProvider(e.target.value)}
            style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border, #e5e7eb)' }}
          >
            <option value="">Select provider...</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* Account */}
        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>
            Account
          </label>
          <select
            value={selectedAccount}
            onChange={(e) => setSelectedAccount(e.target.value)}
            disabled={!selectedProvider}
            style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border, #e5e7eb)' }}
          >
            <option value="">Select account...</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.email}</option>
            ))}
          </select>
        </div>

        {/* Slave ID */}
        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>
            Chrome Slave ID
          </label>
          <input
            type="text"
            value={slaveId}
            onChange={(e) => setSlaveId(e.target.value)}
            placeholder="e.g. chatgpt-owservera"
            style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border, #e5e7eb)' }}
          />
        </div>

        {/* Sync Type */}
        <div>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>
            Sync Type
          </label>
          <div style={{ display: 'flex', gap: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <input
                type="radio"
                value="incremental"
                checked={syncType === 'incremental'}
                onChange={() => setSyncType('incremental')}
              />
              <span style={{ fontSize: '13px' }}>Incremental</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <input
                type="radio"
                value="full"
                checked={syncType === 'full'}
                onChange={() => setSyncType('full')}
              />
              <span style={{ fontSize: '13px' }}>Full</span>
            </label>
          </div>
        </div>

        {/* Headers Only */}
        <div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <input
              type="checkbox"
              checked={headersOnly}
              onChange={(e) => setHeadersOnly(e.target.checked)}
            />
            <span style={{ fontSize: '13px' }}>Headers only (skip messages)</span>
          </label>
        </div>

        {/* Sync Button */}
        <button
          onClick={handleSync}
          disabled={syncing || !selectedProvider || !selectedAccount || !slaveId}
          style={{
            padding: '10px 16px',
            borderRadius: '6px',
            border: 'none',
            background: syncing ? '#9ca3af' : '#2563eb',
            color: 'white',
            fontWeight: 500,
            cursor: syncing ? 'not-allowed' : 'pointer',
          }}
        >
          {syncing ? 'Syncing...' : 'Start Sync'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: '12px', borderRadius: '6px', background: '#fef2f2', color: '#dc2626', marginBottom: '16px', fontSize: '13px' }}>
          {error}
        </div>
      )}

      {/* Last Result */}
      {lastResult && (
        <div style={{ padding: '12px', borderRadius: '6px', background: '#f0fdf4', marginBottom: '16px', fontSize: '13px' }}>
          <div style={{ fontWeight: 500, marginBottom: '4px' }}>Last Sync Result</div>
          <div>Found: {lastResult.totalFound} | Synced: {lastResult.synced} | Failed: {lastResult.failed}</div>
          <div>Duration: {lastResult.durationMs}ms</div>
        </div>
      )}

      {/* Sync Logs */}
      <div>
        <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px' }}>Sync History</h3>
        {logsLoading ? (
          <div style={{ fontSize: '13px', color: '#6b7280' }}>Loading...</div>
        ) : logs.length === 0 ? (
          <div style={{ fontSize: '13px', color: '#6b7280' }}>No sync history</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {logs.map((log) => (
              <div
                key={log.id}
                style={{
                  padding: '10px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border, #e5e7eb)',
                  fontSize: '13px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 500 }}>{log.syncType}</span>
                  <span style={{
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: log.status === 'completed' ? '#dcfce7' : log.status === 'failed' ? '#fef2f2' : '#fef3c7',
                    color: log.status === 'completed' ? '#166534' : log.status === 'failed' ? '#dc2626' : '#92400e',
                    fontSize: '11px',
                    fontWeight: 500,
                  }}>
                    {log.status}
                  </span>
                </div>
                <div style={{ color: '#6b7280' }}>
                  Found: {log.conversationsFound} | Synced: {log.conversationsSynced} | Failed: {log.conversationsFailed}
                  {log.durationMs != null && ` | ${log.durationMs}ms`}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
