'use client';

/**
 * components/canvas/panels/ProvidersPanel.tsx
 * --------------------------------------------------------------------
 * Providers panel - manage AI provider connections.
 * Toggle providers, cycle tiers, view health status.
 */

import { useCallback, useEffect, useState } from 'react';
import { Icon } from '../Icon';
import { EmptyState } from '../EmptyState';
import { useProvider } from '@/sdk/web/use-provider';
import { useHealth } from '@/sdk/web/use-health';
import { PROVIDER_THEME, getProviderTheme } from '@/lib/provider-theme';

const TIER_OPTIONS = ['free', 'trial', 'pro', 'enterprise'] as const;

interface ProvidersPanelProps {
  providerIds: string[];
  accounts: Array<{ accountId: string; providerId: string; planTier: string }>;
  onToggleProvider: (id: string) => void;
  onCycleTier: (providerId: string) => void;
}

export function ProvidersPanel({
  providerIds,
  accounts,
  onToggleProvider,
  onCycleTier,
}: ProvidersPanelProps) {
  const { providers, loading: provLoading, refresh: refreshProviders } = useProvider();
  const { health, loading: healthLoading, check: checkHealth } = useHealth();

  useEffect(() => {
    refreshProviders();
    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => clearInterval(interval);
  }, [checkHealth, refreshProviders]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Health status */}
      <div style={{ padding: 8, borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
          <div style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: health?.status === 'ok' ? 'rgb(34,197,94)' : healthLoading ? 'rgb(234,179,8)' : 'rgb(239,68,68)',
          }} />
          <span style={{ color: 'var(--muted-foreground)' }}>
            Backend: {health?.status ?? 'checking'}{health?.version ? ` v${health.version}` : ''}
          </span>
        </div>
      </div>

      {/* Provider list */}
      <div style={{ flex: 1, overflow: 'auto', padding: 8 }} className="scrollbar-thin">
        {provLoading && <EmptyState>Loading providers...</EmptyState>}
        {!provLoading && providers.length === 0 && <EmptyState>No providers configured</EmptyState>}
        {providers.map((provider) => {
          const isEnabled = providerIds.includes(provider.id);
          const account = accounts.find((a) => a.providerId === provider.id);
          const pTheme = getProviderTheme(provider.id);

          return (
            <div
              key={provider.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                marginBottom: 4,
                borderRadius: 'var(--radius)',
                background: isEnabled ? pTheme.bg : 'transparent',
                border: `1px solid ${isEnabled ? pTheme.fg : 'var(--border)'}`,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onClick={() => onToggleProvider(provider.id)}
              onMouseEnter={(e) => {
                if (!isEnabled) e.currentTarget.style.background = 'var(--muted)';
              }}
              onMouseLeave={(e) => {
                if (!isEnabled) e.currentTarget.style.background = 'transparent';
              }}
            >
              {/* Icon */}
              <div style={{
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                background: isEnabled ? 'rgba(255,255,255,0.1)' : 'var(--muted)',
                borderRadius: 'calc(var(--radius) - 4px)',
              }}>
                {pTheme.icon}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: isEnabled ? pTheme.fg : 'var(--foreground)',
                }}>
                  {provider.name}
                </div>
                <div style={{
                  fontSize: 10,
                  color: 'var(--muted-foreground)',
                  marginTop: 2,
                }}>
                  {isEnabled ? 'Connected' : 'Click to enable'}
                </div>
              </div>

              {/* Tier badge */}
              {isEnabled && account && (
                <button
                  onClick={(e) => { e.stopPropagation(); onCycleTier(provider.id); }}
                  style={{
                    padding: '2px 6px',
                    border: '1px solid var(--border)',
                    borderRadius: 'calc(var(--radius) - 4px)',
                    background: 'var(--card)',
                    fontSize: 9,
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--muted-foreground)',
                    cursor: 'pointer',
                    textTransform: 'uppercase',
                  }}
                >
                  {account.planTier}
                </button>
              )}

              {/* Toggle indicator */}
              <div style={{
                width: 16,
                height: 16,
                borderRadius: '50%',
                border: `2px solid ${isEnabled ? pTheme.fg : 'var(--border)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                {isEnabled && (
                  <div style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: pTheme.fg,
                  }} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
