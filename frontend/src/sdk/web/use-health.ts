'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useIO } from '@/components/canvas/UnifiedIOProvider';
import type { HealthStatus } from '@/types/api';

export function useHealth() {
  const io = useIO();
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => () => { mountedRef.current = false }, []);

  const check = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await io.get<HealthStatus>('/api/health');
      if (!mountedRef.current) return;
      setHealth(res.data);
    } catch (e) {
      if (!mountedRef.current) return;
      setError(e instanceof Error ? e.message : 'Health check failed');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [io]);

  // R3-06: Auto-fetch on mount
  useEffect(() => { check(); }, [check]);

  return { health, loading, error, check };
}
