'use client';

import { type TextareaHTMLAttributes, forwardRef } from 'react';

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  variant?: 'default' | 'mono';
}

const baseStyle: React.CSSProperties = {
  width: '100%',
  padding: 8,
  border: '1px solid var(--border)',
  background: 'var(--bg-elevated)',
  color: 'var(--text)',
  borderRadius: 4,
  fontSize: 12,
  fontFamily: 'inherit',
  boxSizing: 'border-box',
  resize: 'vertical',
};

const monoStyle: React.CSSProperties = {
  ...baseStyle,
  fontFamily: 'var(--font-mono)',
};

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ variant = 'default', style, ...props }, ref) => (
    <textarea
      ref={ref}
      style={variant === 'mono' ? { ...monoStyle, ...style } : { ...baseStyle, ...style }}
      {...props}
    />
  ),
);
TextArea.displayName = 'TextArea';
