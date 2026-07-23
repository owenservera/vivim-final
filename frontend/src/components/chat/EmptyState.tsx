'use client';

/**
 * components/chat/EmptyState.tsx
 * --------------------------------------------------------------------
 * Default empty state for chat.thread slot when no conversation is selected.
 * Shows brand, quick-start actions, and capability suggestions.
 */

import { useCapability } from '@/sdk/web/use-capability';

interface EmptyStateProps {
  /** Callback to create a new conversation. */
  onCreateConversation?: () => void;
}

export function EmptyState({ onCreateConversation }: EmptyStateProps) {
  const { capabilities, loading } = useCapability('ui');

  const quickActions = capabilities
    .filter((c) => ['send_message', 'select_model'].includes(c.slug))
    .slice(0, 4);

  return (
    <div
      data-moment="2"
      data-slot="chat.emptyState"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 24,
        padding: 32,
        fontFamily: 'ui-sans-serif, system-ui',
      }}
    >
      {/* Brand */}
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            fontSize: 32,
            fontWeight: 700,
            letterSpacing: '-0.03em',
            color: 'var(--text)',
            marginBottom: 8,
          }}
        >
          Vivim
        </div>
        <div
          style={{
            fontSize: 13,
            color: 'var(--text-dim)',
            maxWidth: 280,
            lineHeight: 1.5,
          }}
        >
          Select or create a conversation to start messaging.
        </div>
      </div>

      {/* Quick start */}
      {onCreateConversation && (
        <button
          type="button"
          onClick={onCreateConversation}
          style={{
            padding: '10px 20px',
            border: '1px solid var(--border)',
            borderRadius: 8,
            background: 'var(--accent)',
            color: 'var(--accent-foreground, #fff)',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          New Conversation
        </button>
      )}

      {/* Capability suggestions */}
      {!loading && quickActions.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          {quickActions.map((cap) => (
            <div
              key={cap.slug}
              style={{
                padding: '6px 12px',
                border: '1px solid var(--border)',
                borderRadius: 6,
                background: 'var(--surface)',
                fontSize: 11,
                color: 'var(--text-dim)',
              }}
            >
              {cap.name ?? cap.slug}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
