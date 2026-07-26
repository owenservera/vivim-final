'use client';

/**
 * components/chat/HealthIndicator.tsx — Moment 1: First Contact
 * --------------------------------------------------------------------
 * Backend liveness + auth status. Polls `GET /api/health` and
 * `GET /api/auth/session` on mount and on an interval. Shows a
 * Connected/Disconnected badge and the authenticated user (or a login
 * prompt). Per spec FR-001/FR-002 and AC 1-4.
 */

import { useEffect, useState } from 'react';
import { useHealth } from '@/sdk/web/use-health';
import { useSession } from '@/sdk/web/use-session';

export function HealthIndicator({ pollMs = 15000 }: { pollMs?: number }) {
  const { health, check: checkHealth } = useHealth();
  const { session, getSession } = useSession();
  const [checkedAt, setCheckedAt] = useState<number>(0);

  useEffect(() => {
    const refresh = async () => {
      await Promise.all([checkHealth(), getSession()]);
      setCheckedAt(Date.now());
    };
    refresh();
    const t = setInterval(refresh, pollMs);
    return () => clearInterval(t);
  }, [checkHealth, getSession, pollMs]);

  const healthy = health ? (health.status === 'ok' || health.status === 'healthy') : null;
  const dot = healthy === null ? '#9ca3af' : healthy ? '#22c55e' : '#ef4444';
  const label = healthy === null ? 'Checking…' : healthy ? 'Connected' : 'Disconnected';

  return (
    <div
      data-moment="1"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 10px',
        borderRadius: 8,
        border: '1px solid var(--border)',
        background: 'var(--bg-elevated)',
        fontSize: 12,
        fontFamily: 'ui-sans-serif, system-ui',
        color: 'var(--text)',
      }}
    >
      <span
        title={label}
        style={{ width: 8, height: 8, borderRadius: '50%', background: dot, flexShrink: 0 }}
      />
      <span style={{ fontWeight: 600 }}>{label}</span>
      {session.authenticated ? (
        <span style={{ color: 'var(--text-muted)' }}>
          {session.email ?? 'signed in'}
        </span>
      ) : (
        <span style={{ color: 'var(--text-muted)' }}>not signed in</span>
      )}
      {healthy === false && (
        <button
          type="button"
          onClick={() => { checkHealth(); getSession(); }}
          style={{
            marginLeft: 4,
            padding: '2px 8px',
            border: '1px solid var(--border)',
            borderRadius: 4,
            background: 'var(--bg)',
            color: 'var(--text)',
            cursor: 'pointer',
            fontSize: 11,
            fontFamily: 'inherit',
          }}
        >
          Retry
        </button>
      )}
      {checkedAt > 0 && (
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-subtle)' }}>
          {new Date(checkedAt).toLocaleTimeString()}
        </span>
      )}
    </div>
  );
}
