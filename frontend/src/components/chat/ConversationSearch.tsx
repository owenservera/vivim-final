'use client';

/**
 * components/chat/ConversationSearch.tsx
 * --------------------------------------------------------------------
 * Standalone search/filter for conversations.
 * Extracted from ConversationList to allow independent use.
 */

import { Icon } from '@/components/canvas/Icon';

interface ConversationSearchProps {
  /** Current search value. */
  value: string;
  /** Called when the search value changes. */
  onChange: (value: string) => void;
  /** Placeholder text. */
  placeholder?: string;
}

export function ConversationSearch({
  value,
  onChange,
  placeholder = 'Filter conversations...',
}: ConversationSearchProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 8px',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <Icon name="search" size={12} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          flex: 1,
          padding: '3px 0',
          border: 'none',
          background: 'transparent',
          color: 'var(--foreground)',
          fontSize: 11,
          fontFamily: 'inherit',
          outline: 'none',
        }}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          style={{
            padding: '1px 4px',
            border: 'none',
            background: 'transparent',
            color: 'var(--muted-foreground)',
            cursor: 'pointer',
            borderRadius: 3,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Icon name="close" size={10} />
        </button>
      )}
    </div>
  );
}
