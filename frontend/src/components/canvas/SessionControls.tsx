'use client';

/**
 * components/canvas/SessionControls.tsx
 * --------------------------------------------------------------------
 * Session lifecycle — current session info, login form, logout.
 * Uses useSession() SDK hook. CSS variables only.
 */

import { useEffect, useState, useCallback } from 'react';
import { useSession } from '@/sdk/web/use-session';
import { PanelShell } from './PanelShell';
import { ErrorBanner } from './ErrorBanner';
import { Toast } from './Toast';
import { Button } from './Button';
import { InputField } from './InputField';
import { useToast } from '@/hooks/useToast';

export function SessionControls() {
  const { session, loading, error, getSession, login, logout } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const { toast, showToast } = useToast();

  useEffect(() => { getSession(); }, [getSession]);

  const handleLogin = useCallback(async () => {
    if (!email.trim() || !password.trim()) return;
    setLoginLoading(true);
    try {
      const ok = await login(email.trim(), password);
      if (ok) {
        showToast('ok', 'Logged in');
        setEmail('');
        setPassword('');
      } else {
        showToast('err', 'Login failed');
      }
    } finally {
      setLoginLoading(false);
    }
  }, [email, password, login, showToast]);

  const handleLogout = useCallback(async () => {
    await logout();
    showToast('ok', 'Logged out');
  }, [logout, showToast]);

  return (
    <PanelShell>
      <h2 style={{ margin: '0 0 16px', fontSize: 18 }}>Session</h2>

      {toast && <Toast kind={toast.kind} message={toast.msg} />}

      {/* Current session */}
      <div style={{ padding: 12, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: session.authenticated ? '#10b981' : '#f59e0b' }} />
          <span style={{ fontSize: 14, fontWeight: 600 }}>{session.authenticated ? 'Authenticated' : 'Not authenticated'}</span>
        </div>
        {session.authenticated && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {session.email && <div>Email: {session.email}</div>}
            {session.userId && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>ID: {session.userId}</div>}
          </div>
        )}
      </div>

      {loading && <div style={{ fontSize: 12, color: 'var(--text-subtle)', marginBottom: 12 }}>Loading session…</div>}
      <ErrorBanner error={error} />

      {/* Login form */}
      {!session.authenticated && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Login</div>
          <InputField
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            type="email"
            style={{ marginBottom: 8 }}
          />
          <InputField
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            type="password"
            onKeyDown={(e) => { if (e.key === 'Enter') handleLogin(); }}
            style={{ marginBottom: 8 }}
          />
          <Button onClick={handleLogin} disabled={!email.trim() || !password.trim() || loginLoading}>
            {loginLoading ? 'Logging in…' : 'Login'}
          </Button>
        </div>
      )}

      {/* Logout + refresh */}
      <div style={{ display: 'flex', gap: 8 }}>
        {session.authenticated && (
          <Button variant="danger" onClick={handleLogout}>
            Logout
          </Button>
        )}
        <Button variant="secondary" onClick={getSession}>
          Refresh Session
        </Button>
      </div>
    </PanelShell>
  );
}
