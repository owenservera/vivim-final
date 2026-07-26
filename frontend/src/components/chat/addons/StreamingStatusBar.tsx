'use client';

import type { AddOnProps } from '@/types/api';

export function StreamingStatusBar({ context }: AddOnProps) {
  if (!context.isStreaming) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 10px',
        fontSize: 12,
        color: 'var(--text-muted)',
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: '#ef4444',
          display: 'inline-block',
          animation: 'none',
        }}
      >
        <style>{`@keyframes pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
      </span>
      <span style={{ animation: 'pulse-dot 1.5s ease-in-out infinite' }}>
        Streaming...
      </span>
      <button
        type="button"
        onClick={context.stopStreaming}
        style={{
          marginLeft: 'auto',
          padding: '2px 8px',
          border: '1px solid var(--border)',
          borderRadius: 4,
          background: 'var(--bg-elevated)',
          color: 'var(--text)',
          fontSize: 11,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        Stop
      </button>
    </div>
  );
}
