'use client';

import { type CSSProperties, type ReactNode } from 'react';

/**
 * SectionLabel — uppercase section heading.
 * Replaces the 13 inline `fontSize:11, fontWeight:600, textTransform:uppercase` patterns.
 */

interface SectionLabelProps {
  children: ReactNode;
  style?: CSSProperties;
  muted?: boolean;
}

export function SectionLabel({ children, style, muted = true }: SectionLabelProps) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 600,
        color: muted ? 'var(--text-muted)' : 'var(--text)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
