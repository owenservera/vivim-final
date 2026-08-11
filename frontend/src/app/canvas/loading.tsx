'use client';

import { Spinner } from '@/components/canvas/Spinner';

export default function CanvasLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <Spinner size={24} />
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>
          Loading canvas...
        </span>
      </div>
    </div>
  );
}
