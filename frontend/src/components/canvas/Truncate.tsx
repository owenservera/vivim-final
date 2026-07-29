'use client';

import { type CSSProperties, type ReactNode } from 'react';

/**
 * Truncate — single-line text truncation with ellipsis.
 * Replaces the 15 inline `overflow:hidden, textOverflow:ellipsis, whiteSpace:nowrap` patterns.
 */

interface TruncateProps {
  children: ReactNode;
  style?: CSSProperties;
  as?: 'span' | 'div' | 'td' | 'code';
  title?: string;
}

const base: CSSProperties = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

export function Truncate({ children, style, as = 'span', title }: TruncateProps) {
  const Tag = as;
  return (
    <Tag style={{ ...base, ...style }} title={title}>
      {children}
    </Tag>
  );
}
