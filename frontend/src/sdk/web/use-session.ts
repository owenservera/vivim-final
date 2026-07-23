'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useIO } from '@/components/canvas/UnifiedIOProvider';

export interface SessionState {
  authenticated: boolean;
  userId: string | null;
  email: string | null;
}

export function useSession() {
  const io = useIO();
  const [session, setSession] = useState<SessionState>({ authenticated: false, userId: null, email: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => () => { mountedRef.current = false }, []);

  const getSession = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await io.get<SessionState>('/api/session');
      if (!mountedRef.current) return;
      setSession(res.data);
    } catch (e) {
      if (!mountedRef.current) return;
      setError(e instanceof Error ? e.message : 'Failed to load session');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [io]);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await io.post<SessionState>('/api/session', { email, password });
      if (!mountedRef.current) return false;
      setSession(res.data);
      return res.data.authenticated;
    } catch (e) {
      if (!mountedRef.current) return false;
      setError(e instanceof Error ? e.message : 'Login failed');
      return false;
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [io]);

  const logout = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await io.post<{ authenticated: boolean }>('/api/session', { action: 'logout' });
      if (!mountedRef.current) return;
      setSession({ authenticated: false, userId: null, email: null });
    } catch (e) {
      if (!mountedRef.current) return;
      setError(e instanceof Error ? e.message : 'Logout failed');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [io]);

  return { session, loading, error, getSession, login, logout };
}
