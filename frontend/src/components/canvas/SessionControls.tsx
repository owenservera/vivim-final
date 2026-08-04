'use client';

import { useEffect } from 'react';
import { useSession } from '@/sdk/web/use-session';
import { PanelShell } from './PanelShell';
import { ErrorBanner } from './ErrorBanner';
import { Toast } from './Toast';
import { Button } from './Button';
import { ValidatedField } from '@/components/ui/ValidatedField';
import { Form } from '@/components/ui/form';
import { FormErrorSummary } from '@/components/ui/FormErrorSummary';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginFormData } from '@/schema/forms';
import { useToast } from '@/hooks/useToast';

export function SessionControls() {
  const { session, loading, error, getSession, login, logout } = useSession();
  const { toast, showToast } = useToast();

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
    mode: 'onChange',
  });

  useEffect(() => {
    getSession();
  }, [getSession]);

  const handleLogin = async () => {
    const isValid = await form.trigger();
    if (!isValid) return;

    try {
      const ok = await login(form.getValues('email'), form.getValues('password'));
      if (ok) {
        showToast('ok', 'Logged in');
        form.reset();
      } else {
        showToast('err', 'Login failed');
      }
    } catch (error) {
      showToast('err', 'Login error');
    }
  };

  const handleLogout = async () => {
    await logout();
    showToast('ok', 'Logged out');
  };

  return (
    <PanelShell>
      <h2 style={{ margin: '0 0 16px', fontSize: 18 }}>Session</h2>

      {toast && <Toast kind={toast.kind} message={toast.msg} />}

      {/* Current session */}
      <div style={{ padding: 12, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: session.authenticated ? 'var(--color-success)' : 'var(--color-warning)' }} />
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
          <Form {...form}>
            <form onSubmit={(e) => e.preventDefault()} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <FormErrorSummary />

              <ValidatedField
                form={form}
                name="email"
                label="Email"
                placeholder="Enter your email"
                type="email"
                helpText="We'll never share your email with anyone else."
              />

              <ValidatedField
                form={form}
                name="password"
                label="Password"
                placeholder="Enter your password"
                type="password"
                helpText="Password must be at least 8 characters with uppercase, lowercase, and number."
              />

              <Button
                onClick={handleLogin}
                disabled={!form.formState.isDirty || form.formState.isSubmitting}
                style={{ marginTop: 8 }}
              >
                {form.formState.isSubmitting ? 'Logging in…' : 'Login'}
              </Button>
            </form>
          </Form>
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
