// frontend/src/components/canvas/ProviderStatusBadges.tsx
// Inline status badges for providers showing connection/health state.
'use client'

import { useEffect, useState } from 'react'
import { useHealth } from '@/sdk/web/use-health'

interface ProviderStatus {
  id: string
  name: string
  icon: string
  connected: boolean
  health: 'ok' | 'degraded' | 'down' | 'unknown'
}

interface ProviderStatusBadgesProps {
  providers?: ProviderStatus[]
}

export function ProviderStatusBadges({ providers = [] }: ProviderStatusBadgesProps) {
  const { health, check: checkHealth } = useHealth()

  useEffect(() => {
    checkHealth()
    const interval = setInterval(checkHealth, 15_000)
    return () => clearInterval(interval)
  }, [checkHealth])

  if (providers.length === 0) return null

  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {providers.map((p) => {
        const color = p.connected
          ? p.health === 'ok'
            ? 'rgb(34,197,94)'
            : p.health === 'degraded'
              ? 'rgb(234,179,8)'
              : 'rgb(239,68,68)'
          : 'var(--border)'

        return (
          <div
            key={p.id}
            title={`${p.name}: ${p.connected ? (p.health === 'ok' ? 'Connected' : p.health) : 'Not connected'}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '2px 8px',
              border: `1px solid ${color}`,
              borderRadius: 12,
              fontSize: 11,
              color: p.connected ? color : 'var(--text-muted)',
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: color, flexShrink: 0,
            }} />
            {p.icon} {p.name}
          </div>
        )
      })}
    </div>
  )
}
