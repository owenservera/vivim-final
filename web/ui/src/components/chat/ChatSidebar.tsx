'use client';

/**
 * components/chat/ChatSidebar.tsx
 * --------------------------------------------------------------------
 * Left sidebar with workspace switcher, provider list, variant controls.
 * Extracted from page.tsx to reduce monolith complexity.
 */

import { WorkspaceSwitcher } from '@/components/canvas';
import type { AccountContext } from '@/shared/route-context';

interface ChatSidebarProps {
  workspaceId: string;
  setWorkspace: (id: string) => void;
  providerIds: string[];
  toggleProvider: (id: string) => void;
  accounts: AccountContext[];
  cycleTier: (providerId: string) => void;
  variant: string | undefined;
  setVariant: (variant: string) => void;
  onSetupWizard?: () => void;
}

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

export function ChatSidebar({
  workspaceId,
  setWorkspace,
  providerIds,
  toggleProvider,
  accounts,
  cycleTier,
  variant,
  setVariant,
  onSetupWizard,
}: ChatSidebarProps) {
  return (
    <aside
      data-onboarding="sidebar"
      style={{
        width: 240,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid var(--border)',
        background: 'var(--bg-elevated)',
        overflowY: 'auto',
      }}
    >
      {/* Workspace Switcher */}
      <div style={{ padding: 8, borderBottom: '1px solid var(--border)' }}>
        <WorkspaceSwitcher currentWorkspaceId={workspaceId} onSwitch={setWorkspace} />
      </div>

      {/* Canvas variant */}
      <div style={{ padding: 8, borderBottom: '1px solid var(--border)' }}>
        <div style={{ marginBottom: 6, ...labelStyle }}>Canvas</div>
        <div style={{ display: 'flex', gap: 4 }}>
          {['full', 'compact', 'minimal'].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setVariant(v)}
              style={{
                flex: 1,
                padding: '3px 6px',
                borderRadius: 4,
                border: '1px solid var(--border)',
                background: variant === v ? 'var(--accent)' : 'var(--bg)',
                color: variant === v ? '#fff' : 'var(--text)',
                fontSize: 10,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Provider List */}
      <div style={{ padding: 8, borderBottom: '1px solid var(--border)' }}>
        <div style={{ marginBottom: 6, ...labelStyle }}>Providers</div>
        {['openai', 'anthropic', 'google'].map((id) => {
          const acct = accounts.find((a) => a.providerId === id);
          return (
            <div
              key={id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 0',
                fontSize: 11,
              }}
            >
              <button
                type="button"
                onClick={() => toggleProvider(id)}
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 3,
                  border: '1px solid var(--border)',
                  background: providerIds.includes(id) ? 'var(--accent)' : 'var(--bg)',
                  color: providerIds.includes(id) ? '#fff' : 'var(--text)',
                  fontSize: 8,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  padding: 0,
                }}
              >
                {providerIds.includes(id) ? '✓' : ''}
              </button>
              <span style={{ flex: 1 }}>{id}</span>
              {acct && (
                <button
                  type="button"
                  onClick={() => cycleTier(id)}
                  style={{
                    padding: '1px 5px',
                    border: '1px solid var(--border)',
                    borderRadius: 3,
                    background: 'var(--bg)',
                    fontSize: 9,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {acct.planTier}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Trace Info */}
      <div style={{ padding: 8, flex: 1, overflowY: 'auto' }}>
        <div style={{ marginBottom: 6, ...labelStyle }}>Trace</div>
        <div style={{ fontSize: 11, color: 'var(--text-subtle)' }}>
          No active trace
        </div>
      </div>

      {/* Setup Button */}
      <div style={{ padding: 8, borderTop: '1px solid var(--border)' }}>
        <button
          type="button"
          onClick={onSetupWizard}
          style={{
            width: '100%',
            padding: '6px 10px',
            borderRadius: 6,
            border: '1px solid var(--border)',
            background: 'var(--bg)',
            color: 'var(--text-muted)',
            fontSize: 11,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          ⚙️ Setup Providers
        </button>
      </div>
    </aside>
  );
}
