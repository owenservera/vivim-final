'use client';

/**
 * components/chat/UserMenu.tsx
 * --------------------------------------------------------------------
 * User menu with account info, settings, and logout.
 * Renders in the chat.header slot as the user avatar/menu.
 */

import { useState } from 'react';
import { Icon } from '@/components/canvas/Icon';

interface UserMenuProps {
  /** User ID. */
  userId?: string;
  /** User display name. */
  userName?: string;
  /** User avatar URL. */
  avatarUrl?: string;
}

export function UserMenu({ userId = 'user:demo', userName, avatarUrl }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const displayName = userName ?? userId.split(':').pop() ?? 'User';

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={displayName}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 8px',
          border: '1px solid var(--border)',
          background: 'var(--card)',
          borderRadius: 'var(--radius)',
          cursor: 'pointer',
          color: 'var(--muted-foreground)',
          fontFamily: 'inherit',
          fontSize: 11,
        }}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={displayName}
            style={{ width: 18, height: 18, borderRadius: '50%', objectFit: 'cover' }}
          />
        ) : (
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: '50%',
              background: 'var(--muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 10,
              fontWeight: 600,
              color: 'var(--foreground)',
            }}
          >
            {displayName.charAt(0).toUpperCase()}
          </div>
        )}
        <Icon name="chevron-down" size={10} />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 4,
            minWidth: 160,
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            padding: 4,
            zIndex: 200,
          }}
        >
          <div style={{ padding: '6px 8px', fontSize: 11, color: 'var(--muted-foreground)', borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
            <div style={{ fontWeight: 600, color: 'var(--foreground)' }}>{displayName}</div>
            <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', marginTop: 2 }}>{userId}</div>
          </div>
          <MenuItem icon="settings" label="Settings" onClick={() => setOpen(false)} />
          <MenuItem icon="activity" label="Activity Log" onClick={() => setOpen(false)} />
          <MenuItem icon="alert" label="Help & Support" onClick={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}

function MenuItem({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        padding: '6px 8px',
        border: 'none',
        background: 'transparent',
        color: 'var(--foreground)',
        borderRadius: 'calc(var(--radius) - 4px)',
        cursor: 'pointer',
        fontSize: 11,
        fontFamily: 'inherit',
        textAlign: 'left',
      }}
    >
      <Icon name={icon as never} size={13} />
      {label}
    </button>
  );
}
