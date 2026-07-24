'use client';

import { useEffect, useState, useCallback } from 'react';
import { useIO } from '@/components/canvas/UnifiedIOProvider';

interface ProviderHealth {
  status: string;
  score: number;
  signals: Array<{
    signal: string;
    weight: number;
    value: number;
    contribution: number;
    detail: string;
  }>;
  updatedAt: number;
  parsers: { confidenceAvg: number; emptyStreamRatio1h: number };
  capabilities: { selectorHitRate: number; prospectCount: number };
  fleet: { running: number; stopped: number; error: number };
  circuitBreakers: { open: number; total: number };
  drifts: { recent: number; unresolved: number };
}

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  healthy: { bg: 'rgba(34,197,94,0.15)', fg: '#22c55e' },
  degraded: { bg: 'rgba(234,179,8,0.15)', fg: '#eab308' },
  unhealthy: { bg: 'rgba(239,68,68,0.15)', fg: '#ef4444' },
  unknown: { bg: 'var(--bg-subtle)', fg: 'var(--text-muted)' },
};

export function HealthDashboard() {
  const io = useIO();
  const [health, setHealth] = useState<Record<string, ProviderHealth>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHealth = useCallback(async () => {
    try {
      setError(null);
      const resp = await io.get<Record<string, ProviderHealth>>('/api/health/providers');
      if (!resp.ok) { setError(`HTTP ${resp.status}`); return; }
      if (typeof resp.data === 'object' && resp.data !== null) {
        setHealth(resp.data);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [io]);

  useEffect(() => {
    loadHealth();
    const interval = setInterval(loadHealth, 15_000);
    return () => clearInterval(interval);
  }, [loadHealth]);

  const providers = Object.entries(health);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        padding: 16,
        overflowY: 'auto',
        fontFamily: 'ui-sans-serif, system-ui',
        color: 'var(--text)',
      }}
    >
      {loading && (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
          Loading health data…
        </div>
      )}
      {error && (
        <div style={{ padding: 24, textAlign: 'center', color: '#ef4444', fontSize: 12 }}>
          Failed to load health data: {error}
        </div>
      )}
      {!loading && !error && providers.length === 0 && (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-subtle)', fontSize: 12 }}>
          No provider health data yet.
        </div>
      )}
      {!loading && providers.length > 0 && (
        <>
          <h2 style={{ fontSize: 12, fontWeight: 600, marginBottom: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
            Provider Health
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: 12,
            }}
          >
            {providers.map(([providerId, h]) => {
              const sc = STATUS_COLORS[h.status] ?? STATUS_COLORS.unknown;
              return (
                <div
                  key={providerId}
                  style={{
                    padding: 14,
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--bg-elevated)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 8,
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 600, textTransform: 'capitalize' }}>
                      {providerId}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        padding: '1px 6px',
                        borderRadius: 3,
                        background: sc.bg,
                        color: sc.fg,
                        fontWeight: 600,
                      }}
                    >
                      {h.status}
                    </span>
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>{h.score}</div>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      fontSize: 11,
                      color: 'var(--text-muted)',
                    }}
                  >
                    <Row label="Fleet" value={`${h.fleet.running} running / ${h.fleet.stopped + h.fleet.error} stopped`} />
                    <Row label="Selector hit rate" value={`${h.capabilities.selectorHitRate}%`} />
                    <Row label="Confidence avg" value={`${h.parsers.confidenceAvg}%`} />
                    <Row label="Circuit breakers" value={`${h.circuitBreakers.open}/${h.circuitBreakers.total} open`} />
                    <Row label="Drifts (24h)" value={`${h.drifts.recent} recent / ${h.drifts.unresolved} unresolved`} />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span>{label}</span>
      <span style={{ fontFamily: 'ui-monospace, monospace', color: 'var(--text)' }}>{value}</span>
    </div>
  );
}
