'use client';

import { useState } from 'react';
import type { AddOnProps, ModelOption } from '@/types/api';

export function ModelSelectorPill({ context }: AddOnProps) {
  const { models, selectedModel, setModel } = context;
  const [open, setOpen] = useState(false);

  if (models.length === 0) return null;

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          padding: '4px 10px',
          border: '1px solid var(--border)',
          borderRadius: 6,
          background: 'var(--bg-elevated)',
          color: 'var(--text)',
          fontSize: 12,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        {selectedModel?.name ?? models[0]?.name ?? 'Model'}
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            left: 0,
            marginBottom: 4,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            minWidth: 140,
            zIndex: 10,
          }}
        >
          {models.map((m: ModelOption) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                setModel(m);
                setOpen(false);
              }}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '6px 10px',
                border: 'none',
                background:
                  selectedModel?.id === m.id
                    ? 'var(--accent)'
                    : 'transparent',
                color:
                  selectedModel?.id === m.id ? '#fff' : 'var(--text)',
                fontSize: 12,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {m.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
