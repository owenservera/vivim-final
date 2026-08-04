'use client';

/**
 * components/canvas/HealthDashboard.tsx
 * --------------------------------------------------------------------
 * Backend health status dashboard — auto-refreshes every 15s.
 * Shows: backend status, version, uptime, provider list with status dots.
 * Uses useHealth() + useProvider() SDK hooks. CSS variables only.
 */

import { useEffect, useState } from 'react';
import { useHealth } from '@/sdk/web/use-health';
import { useProvider } from '@/sdk/web/use-provider';
import { PanelShell } from './PanelShell';
import { SectionLabel } from './SectionLabel';
import { StatusDot } from './StatusDot';

export function HealthDashboard() {
  const { health, loading: healthLoading, error: healthError, check } = useHealth();
  const { providers, loading: provLoading, refresh: refreshProviders } = useProvider();

  useEffect(() => {
    check();
    refreshProviders();
    const t = setInterval(() => {
      check();
      refreshProviders();
    }, 15_000);
    return () => clearInterval(t);
  }, [check, refreshProviders]);

  const statusColor = (s?: string) => {
    if (s === 'ok' || s === 'healthy') return 'var(--color-success)';
    if (s === 'error' || s === 'unhealthy') return 'var(--color-error)';
    return 'var(--color-warning)';
  };

  return (
    <PanelShell>
      <h2 style={{ margin: '0 0 16px', fontSize: 18 }}>Health Dashboard</h2>

      {/* Loading */}
      {healthLoading && <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-subtle)', fontSize: 12 }}>Checking health…</div>}

      {/* Health error */}
      {healthError && (
        <div style={{ padding: 12, background: 'var(--color-error-surface)', border: '1px solid var(--color-error)', borderRadius: 8, color: 'var(--color-error)', fontSize: 12, marginBottom: 12 }}>
          {healthError}
        </div>
      )}

      {/* Backend status card */}
      {health && (
        <div style={{ padding: 12, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: statusColor(health.status) }} />
            <span style={{ fontSize: 14, fontWeight: 600 }}>Backend</span>
            <span style={{ padding: '1px 8px', background: statusColor(health.status), color: 'var(--bg)', borderRadius: 4, fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>
              {health.status}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 12 }}>
            {health.version && (
              <div><span style={{ color: 'var(--text-muted)' }}>Version: </span>{health.version}</div>
            )}
            {health.uptime !== undefined && (
              <div><span style={{ color: 'var(--text-muted)' }}>Uptime: </span>{formatUptime(health.uptime)}</div>
            )}
          </div>
        </div>
      )}

      {/* Provider list */}
      <SectionLabel style={{ marginBottom: 8 }}>
        Providers
      </SectionLabel>
      {provLoading && <div style={{ padding: 12, fontSize: 12, color: 'var(--text-subtle)' }}>Loading providers…</div>}
      {!provLoading && providers.length === 0 && (
        <div style={{ padding: 12, fontSize: 12, color: 'var(--text-subtle)' }}>No providers configured</div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {providers.map((p) => (
          <div key={p.id} style={{ padding: '8px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <StatusDot color={statusColor(p.status)} />
            <span style={{ fontWeight: 600, flex: 1 }}>{p.name}</span>
            <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>{p.slug}</span>
            <span style={{ padding: '1px 6px', background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 3, fontSize: 9, color: 'var(--text-muted)' }}>
              {p.status ?? 'unknown'}
            </span>
          </div>
        ))}
      </div>
    </PanelShell>
  );
}

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}
