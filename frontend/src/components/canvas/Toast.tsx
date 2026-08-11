'use client';

import { useEffect, useState, type CSSProperties } from 'react';

interface ToastProps {
  kind: 'ok' | 'err';
  message: string;
  /** Auto-dismiss after ms (default 2500). Set 0 to disable. */
  autoDismiss?: number;
  style?: CSSProperties;
  onDismiss?: () => void;
}

export function Toast({ kind, message, autoDismiss = 2500, style, onDismiss }: ToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (autoDismiss <= 0) return;
    const t = setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, autoDismiss);
    return () => clearTimeout(t);
  }, [autoDismiss, onDismiss]);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        top: 52,
        right: 12,
        zIndex: 1200,
        padding: '8px 14px',
        borderRadius: 6,
        fontSize: 12,
        fontWeight: 600,
        background: kind === 'ok' ? 'var(--color-success)' : 'var(--color-error)',
        color: 'var(--bg)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.16)',
        transition: 'opacity 0.2s',
        opacity: visible ? 1 : 0,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        ...style,
      }}
    >
      <span>{message}</span>
      <button
        onClick={() => { setVisible(false); onDismiss?.(); }}
        style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0, fontSize: 14, lineHeight: 1 }}
        aria-label="Dismiss notification"
      >
        \u00d7
      </button>
    </div>
  );
}

export type { ToastProps };
