'use client';

/**
 * app/page.tsx — Vivim Universal Canvas (Phase 3)
 * --------------------------------------------------------------------
 * The unified canvas surface. The shell is dumb (P2): it renders
 * whatever routeSync resolves. No provider conditionals. No hardcoded
 * tools. The richness lives in the engines + DB + plugins.
 *
 * Phase 2: workspace OS (chat/docs/media/automation/agents/shell).
 * Phase 3 — 10 killer UX enhancements:
 *   #1 ⌘K Command Palette
 *   #2 Universal Search (fuzzy, all entities)
 *   #3 Smart Notifications Center
 *   #4 Theme System (light/dark/auto + 6 accents + font scale)
 *   #5 Onboarding Tour (5-step walkthrough)
 *   #6 Quick Actions Radial Menu (right-click)
 *   #7 Live Presence Indicators (avatars + cursors)
 *   #8 Audit Trail Dashboard (enterprise)
 *   #9 RBAC Permissions Manager (enterprise)
 *   #10 Workspace Templates Gallery (enterprise)
 */

import { useState, useEffect, useCallback } from 'react';
import { DevConsole } from '@/components/chat/DevConsole';
import {
  CanvasSurface,
  LiveConfigProvider,
  useLiveConfig,
  CommandPalette,
  OnboardingTour,
  QuickActionsMenu,
} from '@/components/canvas';
import { ProviderSetupWizard, checkNeedsSetup } from '@/features/provider-setup-wizard';
import { ChatHeader } from '@/components/chat/ChatHeader';
import { ChatSidebar } from '@/components/chat/ChatSidebar';
import { SurfaceTabs } from '@/components/chat/SurfaceTabs';
import { SurfaceContent } from '@/components/chat/SurfaceContent';
import { useChatState } from '@/hooks/useChatState';
import { useDrawerState } from '@/hooks/useDrawerState';
import type { PlanTier } from '@/shared/route-context';
import type { SearchHit } from '@/shared/search';
import { executeCapability } from '@/sdk/backend-client';
import { getApiUrl } from '@/shared/api-config';

const PROVIDER_OPTIONS = [
  { id: 'chatgpt', label: 'ChatGPT (ai-chat)' },
  { id: 'claude', label: 'Claude (ai-chat)' },
  { id: 'gemini', label: 'Gemini (ai-chat)' },
  { id: 'gmail', label: 'Gmail (email)' },
  { id: 'outlook', label: 'Outlook (email)' },
  { id: 'whatsapp', label: 'WhatsApp (messenger)' },
  { id: 'slack', label: 'Slack (messenger)' },
  { id: 'telegram', label: 'Telegram (messenger)' },
  { id: 'twitter', label: 'Twitter (social)' },
  { id: 'linkedin', label: 'LinkedIn (social)' },
  { id: 'mastodon', label: 'Mastodon (social)' },
  { id: 'notion', label: 'Notion (custom)' },
  { id: 'linear', label: 'Linear (custom)' },
];

const TIER_OPTIONS: PlanTier[] = ['free', 'trial', 'pro', 'enterprise'];

const SURFACES = [
  { slug: 'chat', label: 'Chat', icon: '💬' },
  { slug: 'docs', label: 'Documents', icon: '📄' },
  { slug: 'editor', label: 'Doc Editor', icon: '✏️' },
  { slug: 'media', label: 'Media', icon: '🎬' },
  { slug: 'automation', label: 'Automation', icon: '⚡' },
  { slug: 'agents', label: 'Agents', icon: '🤖' },
  { slug: 'shell', label: 'Shell', icon: '⌨️' },
  { slug: 'audit', label: 'Audit', icon: '📊' },
  { slug: 'rbac', label: 'Permissions', icon: '🔐' },
  { slug: 'templates', label: 'Templates', icon: '🏗️' },
  { slug: 'zlayers', label: 'Z-Layers', icon: '📚' },
  { slug: 'health', label: 'Health', icon: '❤️' },
  { slug: 'capabilities', label: 'Capabilities', icon: '🧩' },
] as const;

export default function Home() {
  return (
    <LiveConfigProvider
      initialWorkspaceId="ws:global"
      initialUserId="user:demo"
      initialProviderIds={['chatgpt']}
      initialAccounts={[
        { accountId: 'acct:chatgpt:free', providerId: 'chatgpt', planTier: 'free' },
      ]}
    >
      <CanvasApp />
    </LiveConfigProvider>
  );
}

function CanvasApp() {
  const {
    surface,
    isLoading,
    error,
    workspaceId,
    setWorkspace,
    providerIds,
    setProviderIds,
    accounts,
    setAccounts,
    variant,
    setVariant,
  } = useLiveConfig();

  const [devConsoleOpen, setDevConsoleOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);

  // Auto-show wizard on first load if no profiles exist
  useEffect(() => {
    checkNeedsSetup().then((needs) => {
      if (needs) setWizardOpen(true);
    });
  }, []);

  // Global hotkeys
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === '`') {
      e.preventDefault();
      setDevConsoleOpen((v) => !v);
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Hooks for chat state and drawer
  const {
    paletteOpen,
    setPaletteOpen,
    themeOpen,
    setThemeOpen,
    capResult,
    setCapResult,
    activeSurface,
    setActiveSurface,
    toggleProvider,
    cycleTier,
    handlePaletteAction,
  } = useChatState({
    workspaceId,
    providerIds,
    setProviderIds,
    accounts,
    setAccounts,
    setWorkspace,
  });

  const { openDrawer } = useDrawerState();

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
        background: 'var(--bg)',
        color: 'var(--text)',
      }}
    >
      {/* Top bar — Phase 3 enhancements */}
      <ChatHeader
        workspaceId={workspaceId}
        paletteOpen={paletteOpen}
        setPaletteOpen={setPaletteOpen}
        themeOpen={themeOpen}
        setThemeOpen={setThemeOpen}
      />

      {/* Main workspace */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left sidebar */}
        <ChatSidebar
          workspaceId={workspaceId}
          setWorkspace={setWorkspace}
          providerIds={providerIds}
          toggleProvider={toggleProvider}
          accounts={accounts}
          cycleTier={cycleTier}
          variant={variant}
          setVariant={setVariant}
          onSetupWizard={() => setWizardOpen(true)}
        />

        {/* Main canvas area */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', minWidth: 0 }}>
          {/* Surface tabs */}
          <SurfaceTabs
            surfaces={SURFACES}
            activeSurface={activeSurface}
            setActiveSurface={setActiveSurface}
            openDrawer={openDrawer}
          />

          {/* Surface content — wrapped in the DrawerSystem (E3) */}
          <SurfaceContent
            activeSurface={activeSurface}
            workspaceId={workspaceId}
            providerIds={providerIds}
            setWorkspace={setWorkspace}
            setActiveSurface={setActiveSurface}
          />
        </main>
      </div>

      {/* Overlays — Phase 3 */}
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onAction={handlePaletteAction}
        workspaceId={workspaceId}
      />
      {capResult && (
        <button
          type="button"
          onClick={() => setCapResult(null)}
          style={{
            position: 'fixed',
            bottom: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '8px 14px',
            borderRadius: 8,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow)',
            fontSize: 12,
            fontFamily: 'ui-sans-serif, system-ui',
            color: 'var(--text)',
            cursor: 'pointer',
            zIndex: 1100,
          }}
        >
          {capResult}
        </button>
      )}
      <OnboardingTour
        userId="user:demo"
        onAction={(cmd) => {
          if (cmd.startsWith('switch-surface:')) {
            setActiveSurface(cmd.slice('switch-surface:'.length));
          }
        }}
      />
      <QuickActionsMenu
        onSearch={() => setPaletteOpen(true)}
        onShellCommand={() => setActiveSurface('shell')}
        onOpenDoc={() => setActiveSurface('docs')}
        onOpenVideo={() => setActiveSurface('media')}
        onSwitchWorkspace={() => {
          /* the sidebar switcher is already visible */
        }}
      />
      <DevConsole
        open={devConsoleOpen}
        onClose={() => setDevConsoleOpen(false)}
      />
      {wizardOpen && (
        <ProviderSetupWizard
          onComplete={() => setWizardOpen(false)}
          onClose={() => setWizardOpen(false)}
        />
      )}
    </div>
  );
}
