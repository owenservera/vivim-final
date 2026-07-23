'use client';

/**
 * components/chat/ThreadHeader.tsx
 * --------------------------------------------------------------------
 * Thread header with provider badge, conversation title, and actions.
 * Used as the header bar inside the chat.thread slot region.
 */

import { Icon } from '@/components/canvas/Icon';
import type { SlotContext } from './ChatSlotSurface';

interface ThreadHeaderProps {
  /** Current provider slug. */
  providerSlug?: string;
  /** Conversation title. */
  title?: string;
  /** Conversation ID. */
  conversationId?: string;
  /** Slot context from the resolution system. */
  ctx?: SlotContext;
}

const PROVIDER_BADGES: Record<string, { label: string; color: string }> = {
  chatgpt: { label: 'ChatGPT', color: 'rgba(34,197,94,0.15)' },
  claude: { label: 'Claude', color: 'rgba(249,115,22,0.15)' },
  gemini: { label: 'Gemini', color: 'rgba(59,130,246,0.15)' },
  deepseek: { label: 'DeepSeek', color: 'rgba(139,92,246,0.15)' },
  qwen: { label: 'Qwen', color: 'rgba(236,72,153,0.15)' },
  grok: { label: 'Grok', color: 'rgba(107,114,128,0.15)' },
};

export function ThreadHeader({ providerSlug, title, conversationId }: ThreadHeaderProps) {
  const badge = providerSlug ? PROVIDER_BADGES[providerSlug] : undefined;

  return (
    <div
      data-slot="chat.threadHeader"
      data-conversation-id={conversationId ?? ''}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 12px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--card)',
        height: 40,
        flexShrink: 0,
      }}
    >
      {badge && (
        <span
          style={{
            fontSize: 10,
            padding: '2px 6px',
            borderRadius: 4,
            background: badge.color,
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          {badge.label}
        </span>
      )}
      <span
        style={{
          flex: 1,
          fontSize: 12,
          fontWeight: 600,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          color: 'var(--foreground)',
        }}
      >
        {title || 'New conversation'}
      </span>
      <button
        type="button"
        title="Rename"
        style={{
          padding: '3px 6px',
          border: 'none',
          background: 'transparent',
          color: 'var(--muted-foreground)',
          cursor: 'pointer',
          borderRadius: 'calc(var(--radius) - 4px)',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <Icon name="settings" size={12} />
      </button>
    </div>
  );
}
