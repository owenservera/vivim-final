'use client';

import { useState } from 'react';
import { WorkspaceSwitcher } from '@/components/canvas';
import { useIsMobile } from '@/hooks/use-mobile';
import { CollectionsPanel } from '@/components/collections/CollectionsPanel';
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

function SidebarContent({
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
    <div
      data-onboarding="sidebar"
      style={{
        width: 240,
        height: '100%',
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
        {['chatgpt', 'claude', 'gemini', 'deepseek', 'qwen', 'grok'].map((id) => {
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

      {/* Collections Panel */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <CollectionsPanel />
      </div>

      {/* Trace Info */}
      <div style={{ padding: 8, borderTop: '1px solid var(--border)' }}>
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
    </div>
  );
}

export function ChatSidebar(props: ChatSidebarProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  if (isMobile) {
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          style={{
            position: 'fixed',
            top: 8,
            left: 8,
            zIndex: 1000,
            padding: '6px 10px',
            borderRadius: 6,
            border: '1px solid var(--border)',
            background: 'var(--bg-elevated)',
            color: 'var(--text)',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          ☰ Menu
        </button>
        {open && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1100,
              display: 'flex',
            }}
          >
            <div
              onClick={() => setOpen(false)}
              style={{ flex: 1, background: 'rgba(0,0,0,0.35)' }}
            />
            <div style={{ width: 240, height: '100%', overflow: 'hidden' }}>
              <SidebarContent {...props} />
            </div>
          </div>
        )}
      </>
    );
  }

  return <aside style={{ width: 240, flexShrink: 0, height: '100%' }}><SidebarContent {...props} /></aside>;
}
