'use client';

import { type CSSProperties } from 'react';

interface EmptyStateProps {
  children: string;
  padding?: number;
  style?: CSSProperties;
}

/** Shared empty/loading state text used across panels. */
export function EmptyState({ children, padding = 16, style }: EmptyStateProps) {
  return (
    <div
      style={{
        padding,
        textAlign: 'center',
        color: 'var(--muted-foreground)',
        fontSize: 11,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
