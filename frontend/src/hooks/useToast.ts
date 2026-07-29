'use client';

import { useCallback, useRef, useState } from 'react';

interface ToastState {
  kind: 'ok' | 'err';
  msg: string;
}

/**
 * Shared toast state hook for canvas panels.
 * Returns [toast, showToast, clearToast]. Toast auto-dismisses after `ms` (default 2500).
 * Renders with `<Toast {...toast} />` when toast is non-null.
 */
export function useToast(ms = 2500) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((kind: 'ok' | 'err', msg: string) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ kind, msg });
    timer.current = setTimeout(() => setToast(null), ms);
  }, [ms]);

  const clearToast = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setToast(null);
  }, []);

  return { toast, showToast, clearToast } as const;
}
