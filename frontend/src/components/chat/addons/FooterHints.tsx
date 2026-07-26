'use client';

import type { AddOnProps } from '@/types/api';

export function FooterHints({ context }: AddOnProps) {
  const hintMap: Record<string, string> = {
    chat: 'Enter to send · Shift+Enter for newline',
    search: 'Enter to search',
    execute: 'Enter to execute',
    prompt: 'Enter to submit',
    command: 'Enter to run',
    comment: 'Enter to add',
  };

  const hint = hintMap[context.scope.behavior] ?? 'Enter to send';

  return (
    <div
      style={{
        padding: '2px 10px 4px',
        fontSize: 11,
        color: 'var(--text-muted)',
        opacity: 0.6,
      }}
    >
      {hint}
    </div>
  );
}
