'use client';

import type { AddOnProps } from '@/types/api';

export function CapabilityChips({ context }: AddOnProps) {
  const { capabilities, toggleCapability } = context;

  if (capabilities.length === 0) return null;

  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {capabilities.map((c) => (
        <button
          key={c.slug}
          type="button"
          onClick={() => toggleCapability(c.slug)}
          style={{
            padding: '2px 8px',
            border: '1px solid var(--border)',
            borderRadius: 12,
            background: c.enabled ? 'var(--accent)' : 'var(--bg-elevated)',
            color: c.enabled ? 'var(--accent-foreground, #fff)' : 'var(--text)',
            fontSize: 11,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {c.name}
        </button>
      ))}
    </div>
  );
}
