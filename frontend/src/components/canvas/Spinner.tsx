'use client';

import { type CSSProperties } from 'react';

interface SpinnerProps {
  size?: number;
  style?: CSSProperties;
}

export function Spinner({ size = 16, style }: SpinnerProps) {
  return (
    <div
      style={{
        width: size,
        height: size,
        border: '2px solid var(--border)',
        borderTopColor: 'var(--ring)',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
        flexShrink: 0,
        ...style,
      }}
    />
  );
}
