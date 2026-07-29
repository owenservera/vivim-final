'use client';

import type { AddOnProps } from '@/types/api';
import { Truncate } from '@/components/canvas/Truncate';

export function AttachmentPreview({ context }: AddOnProps) {
  const { attachments, removeAttachment } = context;

  if (attachments.length === 0) return null;

  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '0 10px' }}>
      {attachments.map((a) => (
        <div
          key={a.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '3px 8px',
            border: '1px solid var(--border)',
            borderRadius: 6,
            background: 'var(--bg-elevated)',
            fontSize: 12,
            color: 'var(--text)',
          }}
        >
          <Truncate style={{ maxWidth: 100 }}>
            {a.file.name}
          </Truncate>
          <button
            type="button"
            onClick={() => removeAttachment(a.id)}
            style={{
              border: 'none',
              background: 'transparent',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: 13,
              padding: 0,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
