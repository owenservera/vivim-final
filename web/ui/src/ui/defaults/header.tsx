// web/ui/src/ui/defaults/header.tsx
// chat.header — provider switcher + account status. Provider-agnostic via the
// adapter list passed by the surface.

import type { HeaderProps } from './types.js'

export function Header({ adapters, activeProviderId, onSelect, accountEmail, accountState }: HeaderProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 14px',
        borderBottom: '1px solid #e5e7eb',
        background: '#fff',
      }}
    >
      {adapters.map((a) => (
        <button
          key={a.id}
          type="button"
          onClick={() => onSelect(a.id)}
          style={{
            border: '1px solid',
            borderColor: a.id === activeProviderId ? a.brandColor : '#e5e7eb',
            background: a.id === activeProviderId ? a.brandColor : '#fff',
            color: a.id === activeProviderId ? a.brandText : '#374151',
            borderRadius: 999,
            padding: '4px 12px',
            fontSize: 13,
            cursor: 'pointer',
            fontWeight: a.id === activeProviderId ? 600 : 400,
          }}
        >
          {a.icon} {a.displayName}
        </button>
      ))}
      <div style={{ marginLeft: 'auto', fontSize: 12, color: '#9ca3af' }}>
        {accountEmail ? `${accountEmail} · ${accountState ?? 'unknown'}` : 'no account'}
      </div>
    </div>
  )
}
