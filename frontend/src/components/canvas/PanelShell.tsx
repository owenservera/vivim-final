'use client';

import { type ReactNode } from 'react';

interface PanelShellProps {
  children: ReactNode;
  style?: Record<string, unknown>;
}

export function PanelShell({ children, style }: PanelShellProps) {
  return (
    <div
      style={{
        padding: 16,
        fontFamily: 'ui-sans-serif, system-ui',
        color: 'var(--text)',
        background: 'var(--bg)',
        height: '100%',
        overflowY: 'auto',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
