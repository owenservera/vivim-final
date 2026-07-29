'use client';

import { type CSSProperties, type InputHTMLAttributes } from 'react';

/**
 * InputField — consistent text input styling.
 * Replaces the 4 inline `padding:'6px 10px', border, bg-elevated` patterns.
 */

interface InputFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'style'> {
  style?: CSSProperties;
}

const baseStyle: CSSProperties = {
  width: '100%',
  padding: '6px 10px',
  border: '1px solid var(--border)',
  background: 'var(--bg-elevated)',
  color: 'var(--text)',
  borderRadius: 4,
  fontSize: 12,
  fontFamily: 'inherit',
  boxSizing: 'border-box',
  outline: 'none',
};

export function InputField({ style, ...props }: InputFieldProps) {
  return <input style={{ ...baseStyle, ...style }} {...props} />;
}
