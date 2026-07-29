'use client';

import { type CSSProperties } from 'react';

/**
 * StatusDot — small colored circle for status indication.
 * Replaces the 3 inline `width:8, height:8, borderRadius:'50%'` patterns.
 */

interface StatusDotProps {
  color: string;
  size?: number;
  style?: CSSProperties;
}

export function StatusDot({ color, size = 8, style }: StatusDotProps) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: color,
        flexShrink: 0,
        ...style,
      }}
    />
  );
}
