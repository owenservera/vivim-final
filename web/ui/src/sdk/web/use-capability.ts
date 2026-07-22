'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useIO } from '@/components/canvas/UnifiedIOProvider';
import type { Capability } from '@/types/api';

export function useCapability(surface?: string) {
  const io = useIO();
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => () => { mountedRef.current = false }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = surface ? `?surface=${encodeURIComponent(surface)}` : '';
      const res = await io.get<{ capabilities: Capability[] }>(`/api/capabilities${qs}`);
      if (!mountedRef.current) return;
      setCapabilities(res.data.capabilities ?? []);
    } catch (e) {
      if (!mountedRef.current) return;
      setError(e instanceof Error ? e.message : 'Failed to load capabilities');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [io, surface]);

  const execute = useCallback(async (capabilityId: string, input?: Record<string, unknown>) => {
    setLoading(true);
    setError(null);
    try {
      const res = await io.post<{ success?: boolean; result?: unknown; error?: string }>(
        `/api/capabilities/${encodeURIComponent(capabilityId)}/execute`,
        input ?? {}
      );
      if (!mountedRef.current) return null;
      return res.data;
    } catch (e) {
      if (!mountedRef.current) return null;
      setError(e instanceof Error ? e.message : 'Failed to execute capability');
      return null;
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [io]);

  return { capabilities, loading, error, refresh, execute };
}
