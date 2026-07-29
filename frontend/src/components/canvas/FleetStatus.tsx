'use client';

/**
 * components/canvas/FleetStatus.tsx
 * --------------------------------------------------------------------
 * Provider fleet overview — provider cards with health status.
 * Uses useProvider() + useHealth(). CSS variables only.
 */

import { useEffect, useCallback } from 'react';
import { useProvider } from '@/sdk/web/use-provider';
import { SectionLabel } from './SectionLabel';
import { useHealth } from '@/sdk/web/use-health';
import { PanelShell } from './PanelShell';

export function FleetStatus() {
  const { providers, loading: provLoading, refresh: refreshProviders } = useProvider();
  const { health, loading: healthLoading, check } = useHealth();

  const refresh = useCallback(() => {
    refreshProviders();
    check();
  }, [refreshProviders, check]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 15_000);
    return () => clearInterval(t);
  }, [refresh]);

  const statusColor = (s?: string) => {
    if (s === 'ok' || s === 'healthy') return '#10b981';
    if (s === 'error' || s === 'unhealthy') return '#ef4444';
    return '#f59e0b';
  };

  const backendOk = health?.status === 'ok' || health?.status === 'healthy';

  return (
    <PanelShell>
      <h2 style={{ margin: '0 0 16px', fontSize: 18 }}>Fleet Status</h2>

      {/* Backend health */}
      <div style={{ padding: 12, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: healthLoading ? '#f59e0b' : statusColor(health?.status) }} />
          <span style={{ fontSize: 14, fontWeight: 600 }}>Backend</span>
          <span style={{ padding: '1px 8px', background: healthLoading ? '#f59e0b' : statusColor(health?.status), color: '#fff', borderRadius: 4, fontSize: 10, fontWeight: 600 }}>
            {healthLoading ? 'checking…' : health?.status ?? 'unknown'}
          </span>
        </div>
      </div>

      {/* Provider cards */}
      <SectionLabel style={{ marginBottom: 8 }}>
        Providers ({providers.length})
      </SectionLabel>
      {provLoading && <div style={{ fontSize: 12, color: 'var(--text-subtle)' }}>Loading…</div>}
      {!provLoading && providers.length === 0 && (
        <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-subtle)', fontSize: 12 }}>No providers configured</div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
        {providers.map((p) => (
          <div key={p.id} style={{ padding: 12, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: statusColor(p.status) }} />
              <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{p.name}</span>
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: 4 }}>{p.slug}</div>
            <div style={{ padding: '2px 6px', background: statusColor(p.status), color: '#fff', borderRadius: 3, fontSize: 9, fontWeight: 600, display: 'inline-block' }}>
              {p.status ?? 'unknown'}
            </div>
            {p.capabilities && p.capabilities.length > 0 && (
              <div style={{ marginTop: 6, display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                {p.capabilities.slice(0, 5).map((c) => (
                  <span key={c} style={{ padding: '1px 4px', background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 2, fontSize: 8, color: 'var(--text-muted)' }}>{c}</span>
                ))}
                {p.capabilities.length > 5 && <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>+{p.capabilities.length - 5}</span>}
              </div>
            )}
          </div>
        ))}
      </div>
    </PanelShell>
  );
}
