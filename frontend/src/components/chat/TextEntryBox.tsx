'use client';

import { useRef, useEffect, type KeyboardEvent, type RefObject } from 'react';

interface TextEntryBoxProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (text: string) => void;
  placeholder?: string;
  disabled?: boolean;
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
  onKeyDown?: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
}

export function TextEntryBox({
  value,
  onChange,
  onSubmit,
  placeholder = 'Message...',
  disabled = false,
  textareaRef: externalRef,
  onKeyDown: externalKeyDown,
}: TextEntryBoxProps) {
  const internalRef = useRef<HTMLTextAreaElement>(null);
  const ref = externalRef ?? internalRef;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 20), 200)}px`;
  }, [value, ref]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (externalKeyDown) {
      externalKeyDown(e);
      if (e.defaultPrevented) return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim()) onSubmit(value.trim());
    }
  };

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      disabled={disabled}
      rows={1}
      aria-label="Chat message input"
      style={{
        flex: 1,
        resize: 'none',
        padding: '8px 10px',
        border: '1px solid var(--border)',
        borderRadius: 8,
        background: 'var(--bg)',
        color: 'var(--text)',
        fontSize: 13,
        fontFamily: 'inherit',
        lineHeight: 1.4,
        minHeight: 20,
        maxHeight: 200,
        outline: 'none',
        opacity: disabled ? 0.5 : 1,
      }}
    />
  );
}
