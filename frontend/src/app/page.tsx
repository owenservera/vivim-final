'use client';

/**
 * app/page.tsx — Vivim Canvas (V10 Minimal Chrome)
 * --------------------------------------------------------------------
 * Canvas is king. The UI is minimal:
 *   - Floating CommandBar (single entry point)
 *   - Panels float over the canvas (on-demand only)
 *   - LivingCanvas fills 100% viewport
 *   - No permanent sidebar, no permanent top bar
 *
 * User flow:
 *   - Cmd+K: Command palette (search everything)
 *   - Cmd+.: Toggle panels dock
 *   - Cmd+`: Dev console
 *   - Menu button: All actions in one place
 */

import { useEffect, useRef, useState, Suspense, lazy } from 'react';
import { useIO } from '@/components/canvas/UnifiedIOProvider';
import { OnboardFlow, checkNeedsSetup } from '@/features/onboard-flow';
import {
  LivingCanvas,
  LiveConfigProvider,
  useLiveConfig,
  CommandBar,
  Panel,
  MainMenu,
  CommandPalette,
  OnboardingTour,
  DrawerSystem,
  ConversationsPanel,
  ProvidersPanel,
  SettingsPanel,
  ThemeSettings,
  type PanelConfig,
} from '@/components/canvas';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useConversation } from '@/sdk/web/use-conversation';
import { useCapability } from '@/sdk/web/use-capability';
import { useProvider } from '@/sdk/web/use-provider';
import { useHealth } from '@/sdk/web/use-health';
import type { PlanTier } from '@/shared/route-context';

// Lazy-load heavy surfaces
const DevConsoleLazy = lazy(() => import('@/components/canvas/DevConsole').then((m) => ({ default: m.DevConsole })));

const TIER_OPTIONS: PlanTier[] = ['free', 'trial', 'pro', 'enterprise'];

// Panel configurations
const PANELS: PanelConfig[] = [
  { id: 'conversations', title: 'Conversations', icon: 'message-square', defaultDock: 'left', defaultSize: 'normal' },
  { id: 'providers', title: 'Providers', icon: 'cpu', defaultDock: 'left', defaultSize: 'normal' },
  { id: 'settings', title: 'Settings', icon: 'settings', defaultDock: 'right', defaultSize: 'compact' },
];

export default function Home() {
  return (
    <LiveConfigProvider
      initialWorkspaceId="ws:global"
      initialUserId="user:demo"
    >
      <CanvasApp />
    </LiveConfigProvider>
  );
}

function CanvasApp() {
  const io = useIO();
  const { workspaceId, setWorkspace, providerIds, setProviderIds, accounts, setAccounts, variant, setVariant } = useLiveConfig();
  const { conversations, loading: convLoading, refresh: refreshConversations } = useConversation();
  const { capabilities, loading: capLoading, refresh: refreshCapabilities } = useCapability();
  const { providers, loading: provLoading, refresh: refreshProviders } = useProvider();
  const { health, loading: healthLoading, check: checkHealth } = useHealth();

  // UI state
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [devConsoleOpen, setDevConsoleOpen] = useState(false);
  const [openPanels, setOpenPanels] = useState<Set<string>>(new Set());
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const mountedRef = useRef(true);

  // Check if onboarding needed
  useEffect(() => {
    mountedRef.current = true;
    checkNeedsSetup().then((needs) => {
      if (mountedRef.current) setNeedsSetup(needs);
    }).catch(() => { if (mountedRef.current) setNeedsSetup(false); });
    return () => { mountedRef.current = false; };
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Cmd+K: Command palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
      // Cmd+`: Dev console
      if ((e.metaKey || e.ctrlKey) && e.key === '`') {
        e.preventDefault();
        setDevConsoleOpen((o) => !o);
      }
      // Cmd+.: Toggle panels
      if ((e.metaKey || e.ctrlKey) && e.key === '.') {
        e.preventDefault();
        setOpenPanels((prev) => {
          const next = new Set(prev);
          if (next.size > 0) {
            next.clear();
          } else {
            PANELS.forEach((p) => next.add(p.id));
          }
          return next;
        });
      }
      // Escape: Close all panels
      if (e.key === 'Escape') {
        setPaletteOpen(false);
        setMenuOpen(false);
        setThemeOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Initial data load
  useEffect(() => {
    refreshConversations();
    refreshCapabilities();
    refreshProviders();
    checkHealth();
  }, [refreshConversations, refreshCapabilities, refreshProviders, checkHealth]);

  // Provider management
  const toggleProvider = (id: string) => {
    const isOn = providerIds.includes(id);
    if (isOn) {
      setProviderIds(providerIds.filter((p) => p !== id));
      setAccounts(accounts.filter((a) => a.providerId !== id));
    } else {
      setProviderIds([...providerIds, id]);
      setAccounts([...accounts, { accountId: `acct:${id}:free`, providerId: id, planTier: 'free' as const }]);
    }
  };

  const cycleTier = (providerId: string) => {
    setAccounts(accounts.map((a) => {
      if (a.providerId !== providerId) return a;
      const idx = TIER_OPTIONS.indexOf(a.planTier);
      return { ...a, planTier: TIER_OPTIONS[(idx + 1) % TIER_OPTIONS.length]! };
    }));
  };

  // Panel toggle
  const togglePanel = (panelId: string) => {
    setOpenPanels((prev) => {
      const next = new Set(prev);
      if (next.has(panelId)) {
        next.delete(panelId);
      } else {
        next.add(panelId);
      }
      return next;
    });
  };

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-sans)', background: 'var(--background)', color: 'var(--foreground)' }}>
      {/* Onboarding wizard (if needed) */}
      {needsSetup && (
        <OnboardFlow onComplete={(convId) => {
          setNeedsSetup(false);
          refreshConversations();
          refreshProviders();
        }} />
      )}

      {/* LivingCanvas — 100% viewport, no chrome fighting for space */}
      <main
        id="main-content"
        tabIndex={-1}
        style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', minWidth: 0 }}
      >
        <ErrorBoundary fallback={<div style={{ padding: 48, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>Something went wrong in the canvas.</div>}>
          <DrawerSystem workspaceId={workspaceId}>
            <LivingCanvas
              workspaceId={workspaceId}
              providerIds={providerIds}
              variant={variant}
              conversationId={activeConversationId}
            />
          </DrawerSystem>
        </ErrorBoundary>
      </main>

      {/* Floating CommandBar — single entry point */}
      <CommandBar
        onOpenSearch={() => setPaletteOpen(true)}
        onTogglePanel={togglePanel}
        onOpenMenu={() => setMenuOpen((o) => !o)}
      />

      {/* Floating panels — appear on demand, float over canvas */}
      {PANELS.map((panelConfig) => (
        <Panel
          key={panelConfig.id}
          config={panelConfig}
          isOpen={openPanels.has(panelConfig.id)}
          onClose={() => togglePanel(panelConfig.id)}
        >
          {panelConfig.id === 'conversations' && (
            <ConversationsPanel onSelect={setActiveConversationId} />
          )}
          {panelConfig.id === 'providers' && (
            <ProvidersPanel
              providerIds={providerIds}
              accounts={accounts}
              onToggleProvider={toggleProvider}
              onCycleTier={cycleTier}
            />
          )}
          {panelConfig.id === 'settings' && (
            <SettingsPanel />
          )}
        </Panel>
      ))}

      {/* Main menu dropdown */}
      <MainMenu
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        onTogglePanel={togglePanel}
        onToggleDevConsole={() => setDevConsoleOpen((o) => !o)}
        onOpenThemeSettings={() => setThemeOpen(true)}
      />

      {/* Command palette (Cmd+K) */}
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        workspaceId={workspaceId}
      />

      {/* Theme settings */}
      {themeOpen && <ThemeSettings onClose={() => setThemeOpen(false)} />}

      {/* Onboarding tour */}
      <OnboardingTour userId="user:demo" onAction={() => {}} />

      {/* Dev console (Cmd+`) */}
      {devConsoleOpen && (
        <Suspense fallback={null}>
          <DevConsoleLazy
            isOpen={devConsoleOpen}
            onClose={() => setDevConsoleOpen(false)}
          />
        </Suspense>
      )}
    </div>
  );
}
