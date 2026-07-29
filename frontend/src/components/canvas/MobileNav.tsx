'use client';

/**
 * components/canvas/MobileNav.tsx
 * --------------------------------------------------------------------
 * Vivim 2026 mobile bottom-nav — thumb-friendly navigation for <768px.
 * Hidden on desktop (display:none via .mobile-nav CSS class).
 *
 * Replaces the floating UnifiedEntry on mobile, which is unreachable.
 *
 * Slots:
 *   - Search (center, prominent — brand gradient pill)
 *   - Conversations toggle
 *   - Providers toggle
 *   - Settings toggle
 *   - Menu (overflow)
 *
 * Active panel state is shown with a brand-tinted pill and bottom indicator.
 */

import { Icon, type IconName } from './Icon';
import { BrandMark } from './Brand';

export interface MobileNavProps {
  onOpenSearch: () => void;
  onTogglePanel: (panelId: string) => void;
  onOpenMenu: () => void;
  activePanels?: Set<string>;
}

interface NavSlot {
  icon: IconName;
  label: string;
  panelId?: string;
  onClick?: () => void;
}

export function MobileNav({
  onOpenSearch,
  onTogglePanel,
  onOpenMenu,
  activePanels,
}: MobileNavProps) {
  const slots: NavSlot[] = [
    { icon: 'message-square', label: 'Chats',   panelId: 'conversations', onClick: () => onTogglePanel('conversations') },
    { icon: 'cpu',            label: 'Providers', panelId: 'providers',    onClick: () => onTogglePanel('providers') },
    { icon: 'menu',           label: 'Menu',                              onClick: onOpenMenu },
    { icon: 'settings',       label: 'Settings', panelId: 'settings',     onClick: () => onTogglePanel('settings') },
  ];

  return (
    <nav
      className="mobile-nav"
      aria-label="Primary navigation"
      style={{
        position: 'fixed',
        left: 0, right: 0, bottom: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'space-around',
        padding: '6px 8px calc(6px + env(safe-area-inset-bottom))',
        background: 'color-mix(in oklch, var(--card) 88%, transparent)',
        backdropFilter: 'blur(20px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
        borderTop: '1px solid color-mix(in oklch, var(--border) 80%, var(--brand-500) 12%)',
        boxShadow: '0 -4px 24px -4px rgb(0 0 0 / 0.08)',
      }}
    >
      {slots.slice(0, 2).map((slot) => (
        <NavButton
          key={slot.label}
          icon={slot.icon}
          label={slot.label}
          active={slot.panelId ? activePanels?.has(slot.panelId) : false}
          onClick={slot.onClick}
        />
      ))}

      {/* Center search pill — brand gradient, prominent */}
      <button
        onClick={(e) => { e.stopPropagation(); onOpenSearch(); }}
        aria-label="Open search"
        className="focus-ring"
        style={{
          flex: '0 0 auto',
          width: 56, height: 44,
          borderRadius: 14,
          background: 'var(--brand-gradient)',
          color: 'var(--primary-foreground)',
          border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: 'var(--elevation-2), inset 0 1px 0 color-mix(in oklch, white 25%, transparent)',
          margin: '0 4px',
        }}
      >
        <Icon name="search" size={20} />
      </button>

      {slots.slice(2).map((slot) => (
        <NavButton
          key={slot.label}
          icon={slot.icon}
          label={slot.label}
          active={slot.panelId ? activePanels?.has(slot.panelId) : false}
          onClick={slot.onClick}
        />
      ))}
    </nav>
  );
}

function NavButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: IconName;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      aria-label={label}
      aria-pressed={active}
      className="focus-ring"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        padding: '4px 0',
        background: active
          ? 'color-mix(in oklch, var(--brand-500) 12%, transparent)'
          : 'transparent',
        color: active ? 'var(--brand-600)' : 'var(--muted-foreground)',
        border: 'none',
        borderRadius: 12,
        cursor: 'pointer',
        fontFamily: 'inherit',
        position: 'relative',
        transition: 'background 0.15s ease, color 0.15s ease',
        minHeight: 48,
      }}
    >
      <Icon name={icon} size={20} />
      <span style={{ fontSize: 10, fontWeight: 600 }}>{label}</span>
      {active && (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 2,
            width: 4, height: 4,
            borderRadius: '50%',
            background: 'var(--brand-500)',
          }}
        />
      )}
    </button>
  );
}
