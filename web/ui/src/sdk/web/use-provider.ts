'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useIO } from '@/components/canvas/UnifiedIOProvider';
import type { Provider } from '@/types/api';

export function useProvider() {
  const io = useIO();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => () => { mountedRef.current = false }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await io.get<{ providers: Provider[] }>('/api/providers');
      if (!mountedRef.current) return;
      setProviders(res.data.providers ?? []);
    } catch (e) {
      if (!mountedRef.current) return;
      setError(e instanceof Error ? e.message : 'Failed to load providers');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [io]);

  return { providers, loading, error, refresh };
}
