'use client';

import type { AddOnProps } from '@/types/api';
import { Truncate } from '@/components/canvas/Truncate';

export function QuoteBar({ context }: AddOnProps) {
  const { quotedMessage, setQuote } = context;

  if (!quotedMessage) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 10px',
        borderLeft: '3px solid var(--accent)',
        background: 'var(--bg-elevated)',
        borderRadius: 4,
        fontSize: 12,
        color: 'var(--text-muted)',
      }}
    >
      <Truncate style={{ flex: 1 }}>
        {quotedMessage.snippet}
      </Truncate>
      <button
        type="button"
        onClick={() => setQuote(null)}
        style={{
          border: 'none',
          background: 'transparent',
          color: 'var(--text-muted)',
          cursor: 'pointer',
          fontSize: 14,
          padding: '0 2px',
        }}
      >
        ×
      </button>
    </div>
  );
}
