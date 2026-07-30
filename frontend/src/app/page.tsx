'use client';

/**
 * app/page.tsx — Vivim Canvas (V10 Minimal Chrome)
 * --------------------------------------------------------------------
 * Canvas is king. The UI is minimal:
 *   - UnifiedEntry (single entry point — input + nav)
 *   - Panels float over the canvas (on-demand only)
 *   - LivingCanvas fills 100% viewport
 *   - No permanent sidebar, no permanent top bar
 *
 * User flow:
 *   - Type in UnifiedEntry → sends to active layer
 *   - Cmd+K: Command palette (search everything)
 *   - Cmd+.: Toggle panels dock
 *   - Cmd+`: Dev console
 *   - Menu button: All actions in one place
 */

import { useEffect, useMemo, useRef, useState, Suspense, lazy } from 'react';
import { useIO } from '@/components/canvas/UnifiedIOProvider';
import { GuidedLanding, checkNeedsSetup } from '@/features/guided-landing';
import {
  LivingCanvas,
  LiveConfigProvider,
  useLiveConfig,
  UnifiedEntry,
  MainMenu,
  CommandPalette,
  OnboardingTour,
  DrawerSystem,
  ThemeSettings,
  SessionStateProvider,
  useSessionState,
  TabBar,
  SlidePanel,
  getLayerConfig,
  UpdateNotification,
} from '@/components/canvas';
import { getPanelType } from '@/components/canvas/TabConfig';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useConversation } from '@/sdk/web/use-conversation';
import { useCapability } from '@/sdk/web/use-capability';
import { useProvider } from '@/sdk/web/use-provider';
import { useHealth } from '@/sdk/web/use-health';
import type { PlanTier } from '@/shared/route-context';

// Lazy-load heavy surfaces
const DevConsoleLazy = lazy(() => import('@/components/canvas/DevConsole').then((m) => ({ default: m.DevConsole })));

const TIER_OPTIONS: PlanTier[] = ['free', 'trial', 'pro', 'enterprise'];

export default function Home() {
  return (
    <LiveConfigProvider
      initialWorkspaceId="ws:global"
      initialUserId="user:demo"
    >
      <SessionStateProvider workspaceId="ws:global">
        <CanvasApp />
      </SessionStateProvider>
    </LiveConfigProvider>
  );
}

function CanvasApp() {
  const io = useIO();
  const { workspaceId, setWorkspace, providerIds, setProviderIds, accounts, setAccounts, variant, setVariant } = useLiveConfig();
  const { conversations, loading: convLoading, refresh: refreshConversations, create: createConversation } = useConversation();
  const { capabilities, loading: capLoading, refresh: refreshCapabilities } = useCapability();
  const { providers, loading: provLoading, refresh: refreshProviders } = useProvider();
  const { health, loading: healthLoading, check: checkHealth } = useHealth();

  // UI state
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const [guidedOpen, setGuidedOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [devConsoleOpen, setDevConsoleOpen] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const mountedRef = useRef(true);

  // SSOA session state
  const { state: sessionState, dispatch } = useSessionState();
  const layerConfig = useMemo(() => getLayerConfig(sessionState.activeLayer), [sessionState.activeLayer]);
  const slotIds = layerConfig.canvasSlots;

  // P0-1 fix: ref to avoid stale closure in keyboard handler
  const sessionRef = useRef(sessionState);
  const dispatchRef = useRef(dispatch);
  useEffect(() => { sessionRef.current = sessionState; });
  useEffect(() => { dispatchRef.current = dispatch; });

  // Check if onboarding needed — auto-open guided assistant for first run
  useEffect(() => {
    mountedRef.current = true;
    checkNeedsSetup().then((needs: boolean) => {
      if (!mountedRef.current) return;
      setNeedsSetup(needs);
      if (needs) setGuidedOpen(true);
    }).catch(() => { if (mountedRef.current) setNeedsSetup(false); });
    return () => { mountedRef.current = false; };
  }, []);

  // Keyboard shortcuts (P0-1: reads from refs to avoid stale closure)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ss = sessionRef.current;
      const dispatch = dispatchRef.current;
      // R2-P2-3: Cmd+K removed — handled by UnifiedEntry
      // Cmd+Shift+H: Toggle Vivim assistant
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'H') {
        e.preventDefault();
        setGuidedOpen((o) => !o);
      }
      // Cmd+`: Dev console
      if ((e.metaKey || e.ctrlKey) && e.key === '`') {
        e.preventDefault();
        setDevConsoleOpen((o) => !o);
      }
      // Cmd+1/2/3: Switch SSOA layers
      if ((e.metaKey || e.ctrlKey) && ['1', '2', '3'].includes(e.key)) {
        e.preventDefault();
        const layerIds = ['chat', 'build', 'admin'] as const;
        const idx = parseInt(e.key) - 1;
        if (layerIds[idx]) {
          dispatch({ type: 'LAYER_SWITCH', layerId: layerIds[idx]! });
        }
      }
      // Cmd+0: Close all panels in current layer
      if ((e.metaKey || e.ctrlKey) && e.key === '0') {
        e.preventDefault();
        const layer = ss.layers[ss.activeLayer];
        if (layer) {
          layer.openPanels.forEach((panelId) => {
            dispatch({ type: 'PANEL_CLOSE', layerId: ss.activeLayer, panelId });
          });
        }
      }
      // Cmd+.: Toggle SSOA panels for current layer
      if ((e.metaKey || e.ctrlKey) && e.key === '.') {
        e.preventDefault();
        const currentOpen = ss.layers[ss.activeLayer]?.openPanels ?? [];
        if (currentOpen.length > 0) {
          currentOpen.forEach((id) => {
            dispatch({ type: 'PANEL_CLOSE', layerId: ss.activeLayer, panelId: id });
          });
        } else {
          const defaultPanels = ss.activeLayer === 'chat' ? ['conversations', 'search']
            : ss.activeLayer === 'build' ? ['capabilities', 'automation']
            : ['audit', 'rbac'];
          defaultPanels.forEach((id) => {
            dispatch({ type: 'PANEL_OPEN', layerId: ss.activeLayer, panelId: id });
          });
        }
      }
      // Cmd+H → health panel
      if ((e.metaKey || e.ctrlKey) && e.key === 'h' && !e.shiftKey) {
        e.preventDefault();
        dispatch({ type: 'PANEL_TOGGLE', layerId: ss.activeLayer, panelId: 'health' });
      }
      // R2-P1-5: Cmd+Shift+T → terminal (was Cmd+T, which hijacked browser new-tab)
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'T') {
        e.preventDefault();
        dispatch({ type: 'PANEL_TOGGLE', layerId: ss.activeLayer, panelId: 'terminal' });
      }
      // Cmd+Shift+K → capabilities
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'K') {
        e.preventDefault();
        dispatch({ type: 'PANEL_TOGGLE', layerId: ss.activeLayer, panelId: 'capabilities' });
      }
      // Cmd+Shift+A → automations
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        dispatch({ type: 'PANEL_TOGGLE', layerId: ss.activeLayer, panelId: 'automation' });
      }
      // Cmd+/ → search panel
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        dispatch({ type: 'PANEL_TOGGLE', layerId: ss.activeLayer, panelId: 'search' });
      }
      // Escape: Close all panels (but not guided — it handles its own Escape)
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

  // Panel toggle (SSOA-aware)
  const togglePanel = (panelId: string) => {
    dispatch({ type: 'PANEL_TOGGLE', layerId: sessionState.activeLayer, panelId });
  };

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-sans)', background: 'var(--background)', color: 'var(--foreground)' }}>
      {/* Vivim Assistant — onboarding (first run) + universal help (anytime) */}
      <GuidedLanding
        isOpen={guidedOpen}
        mode={needsSetup ? 'onboarding' : 'assistant'}
        onClose={() => setGuidedOpen(false)}
        onComplete={(convId) => {
          setGuidedOpen(false);
          setNeedsSetup(false);
          refreshConversations();
          refreshProviders();
        }}
      />

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
              slotIds={slotIds}
            />
          </DrawerSystem>
        </ErrorBoundary>
      </main>

      {/* Unified entry point — single I/O for all input (SSOA) */}
      <UnifiedEntry
        workspaceId={workspaceId}
        conversationId={activeConversationId}
        providerId={providerIds[0] ?? null}
        createConversation={createConversation}
        onConversationCreated={(id) => setActiveConversationId(id)}
        onOpenSearch={() => setPaletteOpen(true)}
        onOpenMenu={() => setMenuOpen((o) => !o)}
        onOpenAssistant={() => setGuidedOpen(true)}
        onTogglePanel={togglePanel}
      />

      {/* Tab bar — notebook binder edge tabs (SSOA) */}
      <TabBar workspaceId={workspaceId} onPanelClick={togglePanel} />

      {/* Slide panels — edge-sliding, tab-driven (SSOA) */}
      {sessionState.layers[sessionState.activeLayer]?.openPanels.map((panelId) => (
        <SlidePanel
          key={panelId}
          panelId={panelId}
          isOpen={true}
          onClose={() => dispatch({ type: 'PANEL_CLOSE', layerId: sessionState.activeLayer, panelId })}
          position={sessionState.tabs.position}
          width={sessionState.tabs.expandedWidth}
          workspaceId={workspaceId}
          mini={getPanelType(panelId) === 'mini'}
        />
      ))}

      {/* Main menu dropdown */}
      <MainMenu
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        onTogglePanel={togglePanel}
        onToggleDevConsole={() => setDevConsoleOpen((o) => !o)}
        onOpenThemeSettings={() => setThemeOpen(true)}
        onOpenAssistant={() => setGuidedOpen(true)}
      />

      {/* Command palette (Cmd+K) */}
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        workspaceId={workspaceId}
        onOpenAssistant={() => setGuidedOpen(true)}
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

      {/* Update notification */}
      <UpdateNotification />

    </div>
  );
}
