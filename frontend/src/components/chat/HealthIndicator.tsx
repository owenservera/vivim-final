'use client';

/**
 * components/chat/HealthIndicator.tsx — Moment 1: First Contact
 * --------------------------------------------------------------------
 * Backend liveness + auth status. Polls `GET /api/health` and
 * `GET /api/auth/session` on mount and on an interval. Shows a
 * Connected/Disconnected badge and the authenticated user (or a login
 * prompt). Per spec FR-001/FR-002 and AC 1-4.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { checkHealth, getSession } from '@/sdk/backend-client';

interface SessionUser {
  email?: string | null;
}

export function HealthIndicator({ pollMs = 15000 }: { pollMs?: number }) {
  const [healthy, setHealthy] = useState<boolean | null>(null);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [checkedAt, setCheckedAt] = useState<number>(0);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    if (!mountedRef.current) return;
    const health = await checkHealth().catch(() => null);
    setHealthy(!!health?.ok);
    const sess = await getSession().catch(() => null);
    if (mountedRef.current) {
      setUser(sess?.ok && sess.data?.authenticated ? { email: sess.data.email } : null);
      setCheckedAt(Date.now());
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    // Defer initial refresh to avoid synchronous setState in effect
    const timeoutId = setTimeout(refresh, 0);
    const t = setInterval(refresh, pollMs);
    return () => {
      mountedRef.current = false;
      clearInterval(t);
      clearTimeout(timeoutId);
    };
  }, [refresh, pollMs]);

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
      {user ? (
        <span style={{ color: 'var(--text-muted)' }}>
          {user.email ?? 'signed in'}
        </span>
      ) : (
        <span style={{ color: 'var(--text-muted)' }}>not signed in</span>
      )}
      {healthy === false && (
        <button
          type="button"
          onClick={refresh}
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
