'use client';

import { useNetworkStatus } from '@/hooks/useNetworkStatus';

interface NetworkStatusBarProps {
  position?: 'top' | 'bottom';
}

export function NetworkStatusBar({ position = 'bottom' }: NetworkStatusBarProps) {
  const { online, latencyMs } = useNetworkStatus();

  if (online) return null;

  const posStyle = position === 'top'
    ? { top: 0, left: 0, right: 0 }
    : { bottom: 0, left: 0, right: 0 }

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        ...posStyle,
        zIndex: 9999,
        padding: '8px 16px',
        background: 'var(--color-warning, #f59e0b)',
        color: '#000',
        fontSize: 13,
        fontWeight: 500,
        textAlign: 'center',
      }}
    >
      Connection lost. Chat and search are unavailable.
      {latencyMs !== null && (
        <span style={{ marginLeft: 8, opacity: 0.7 }}>
          (last ping: {latencyMs}ms)
        </span>
      )}
    </div>
  );
}
