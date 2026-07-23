'use client';

/**
 * components/chat/Breadcrumb.tsx
 * --------------------------------------------------------------------
 * Breadcrumb navigation showing workspace > conversation hierarchy.
 * Renders in the chat.header slot or as a standalone nav element.
 */

import { Icon } from '@/components/canvas/Icon';

interface BreadcrumbProps {
  /** Workspace name or ID. */
  workspaceName?: string;
  /** Current conversation title. */
  conversationTitle?: string;
  /** Provider name. */
  providerName?: string;
  /** Optional click handlers. */
  onWorkspaceClick?: () => void;
  onConversationClick?: () => void;
}

export function Breadcrumb({
  workspaceName = 'Default',
  conversationTitle,
  providerName,
  onWorkspaceClick,
  onConversationClick,
}: BreadcrumbProps) {
  return (
    <nav
      aria-label="Breadcrumb"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 11,
        color: 'var(--muted-foreground)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <button
        type="button"
        onClick={onWorkspaceClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '2px 4px',
          border: 'none',
          background: 'transparent',
          color: 'var(--muted-foreground)',
          cursor: onWorkspaceClick ? 'pointer' : 'default',
          borderRadius: 'calc(var(--radius) - 4px)',
          fontSize: 11,
          fontFamily: 'inherit',
        }}
      >
        <Icon name="layers" size={11} />
        <span>{workspaceName}</span>
      </button>

      {providerName && (
        <>
          <Icon name="chevron-right" size={10} style={{ color: 'var(--border)' }} />
          <span style={{ fontSize: 10, padding: '1px 4px', borderRadius: 3, background: 'var(--muted)' }}>
            {providerName}
          </span>
        </>
      )}

      {conversationTitle && (
        <>
          <Icon name="chevron-right" size={10} style={{ color: 'var(--border)' }} />
          <button
            type="button"
            onClick={onConversationClick}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '2px 4px',
              border: 'none',
              background: 'transparent',
              color: 'var(--foreground)',
              cursor: onConversationClick ? 'pointer' : 'default',
              borderRadius: 'calc(var(--radius) - 4px)',
              fontSize: 11,
              fontFamily: 'inherit',
              fontWeight: 500,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: 200,
            }}
          >
            <Icon name="chat" size={11} />
            <span>{conversationTitle}</span>
          </button>
        </>
      )}
    </nav>
  );
}
