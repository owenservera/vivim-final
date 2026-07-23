'use client';

/**
 * app/page.tsx — Vivim Canvas (V9 SOTA) — Canvas-Native
 * --------------------------------------------------------------------
 * P5 Vision: Canvas IS the surface. No tabs, no ChatPage.
 * LivingCanvas fills the viewport. Sidebar moves into canvas nodes.
 * All other surfaces (docs, media, etc.) become canvas layouts.
 */

import { useEffect, useState, Suspense, lazy } from 'react';
import { useIO } from '@/components/canvas/UnifiedIOProvider';
import {
  LivingCanvas,
  LiveConfigProvider,
  useLiveConfig,
  WorkspaceSwitcher,
  CommandPalette,
  NotificationsCenter,
  OnboardingTour,
  QuickActionsMenu,
  PresenceIndicator,
  ThemeSettings,
  ErrorBoundary,
  DrawerSystem,
  Icon,
  type IconName,
} from '@/components/canvas';
import { useConversation } from '@/sdk/web/use-conversation';
import { useCapability } from '@/sdk/web/use-capability';
import { useProvider } from '@/sdk/web/use-provider';
import { useHealth } from '@/sdk/web/use-health';
import type { PlanTier } from '@/shared/route-context';
import type { DocumentCard as DocumentCardRow } from '@/shared/document';
import type { MediaCard as MediaCardRow } from '@/shared/media';
import type { AutomationDefinition } from '@/shared/automation';
import type { AgentDefinition } from '@/shared/agent';
import type { SearchHit } from '@/shared/search';

// Lazy-load heavy surfaces for code splitting
const AuditDashboardLazy = lazy(() => import('@/components/canvas/AuditDashboard').then((m) => ({ default: m.AuditDashboard })));
const RbacManagerLazy = lazy(() => import('@/components/canvas/RbacManager').then((m) => ({ default: m.RbacManager })));
const TemplatesGalleryLazy = lazy(() => import('@/components/canvas/TemplatesGallery').then((m) => ({ default: m.TemplatesGallery })));
const ZLayerPanelLazy = lazy(() => import('@/components/canvas/ZLayerPanel').then((m) => ({ default: m.ZLayerPanel })));
const DocEditorLazy = lazy(() => import('@/components/canvas/cards/DocEditor').then((m) => ({ default: m.DocEditor })));
const ShellCardLazy = lazy(() => import('@/components/canvas/cards/ShellCard').then((m) => ({ default: m.ShellCard })));

const TIER_OPTIONS: PlanTier[] = ['free', 'trial', 'pro', 'enterprise'];

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
  const { surface, isLoading, error, workspaceId, setWorkspace, providerIds, setProviderIds, accounts, setAccounts, variant, setVariant } = useLiveConfig();
  const { conversations, loading: convLoading, refresh: refreshConversations } = useConversation();
  const { capabilities, loading: capLoading, refresh: refreshCapabilities } = useCapability();
  const { providers, loading: provLoading, refresh: refreshProviders } = useProvider();
  const { health, loading: healthLoading, check: checkHealth } = useHealth();
  const [draftVariant, setDraftVariant] = useState('');
  const [showSidebar, setShowSidebar] = useState(true);
  const [showDevConsole, setShowDevConsole] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [docs, setDocs] = useState<DocumentCardRow[]>([]);
  const [medias, setMedias] = useState<MediaCardRow[]>([]);
  const [automations, setAutomations] = useState<AutomationDefinition[]>([]);
  const [agents, setAgents] = useState<AgentDefinition[]>([]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
      // Ctrl+` — toggle dev console
      if ((e.metaKey || e.ctrlKey) && e.key === '`') {
        e.preventDefault();
        setShowDevConsole((o) => !o);
      }
      // Ctrl+B — toggle sidebar
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        setShowSidebar((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    Promise.all([
      io.post<{ ok: boolean; document: DocumentCardRow }>('/api/document/open', { title: 'Welcome', mimeType: 'text/markdown', inlineContent: '# Welcome\n\nThis is the Vivim Canvas.', workspaceId }),
      io.post<{ ok: boolean; document: DocumentCardRow }>('/api/document/open', { title: 'sample.ts', mimeType: 'text/typescript', inlineContent: 'export function resolve(): Surface {\n  return walk(ctx);\n}\n', language: 'typescript', workspaceId }),
    ]).then((rs) => setDocs(rs.map((r) => r.data).filter((r) => r.ok).map((r) => r.document)));

    Promise.all([
      io.post<{ ok: boolean; media: MediaCardRow }>('/api/media/open', { title: 'Sample Video', kind: 'video', sourceUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', mimeType: 'video/mp4', durationSec: 596, workspaceId }),
      io.post<{ ok: boolean; media: MediaCardRow }>('/api/media/open', { title: 'Sample Audio', kind: 'audio', sourceUrl: 'https://example.com/sample.mp3', mimeType: 'audio/mpeg', durationSec: 42, workspaceId }),
    ]).then((rs) => setMedias(rs.map((r) => r.data).filter((r) => r.ok).map((r) => r.media)));

    io.get<{ ok: boolean; automations: AutomationDefinition[] }>(`/api/automation/list?workspaceId=${encodeURIComponent(workspaceId)}`).then((r) => setAutomations(r.data.ok ? r.data.automations.slice(0, 4) : [])).catch(() => setAutomations([]));
    io.get<{ ok: boolean; agents: AgentDefinition[] }>(`/api/agent/list?workspaceId=${encodeURIComponent(workspaceId)}`).then((r) => setAgents(r.data.ok ? r.data.agents : [])).catch(() => setAgents([]));
  }, [io, workspaceId]);

  useEffect(() => {
    io.get<{ ok: boolean; stats: { unread: number } }>('/api/notification/stats?userId=user:demo').then((r) => { if (r.data.ok && r.data.stats.unread === 0) io.post('/api/notification/seed', {}).catch(() => {}); }).catch(() => {});

    refreshConversations();
    refreshCapabilities();
    refreshProviders();
    checkHealth();
  }, [io, refreshConversations, refreshCapabilities, refreshProviders, checkHealth]);

  const toggleProvider = (id: string) => {
    const isOn = providerIds.includes(id);
    if (isOn) { setProviderIds(providerIds.filter((p) => p !== id)); setAccounts(accounts.filter((a) => a.providerId !== id)); }
    else { setProviderIds([...providerIds, id]); setAccounts([...accounts, { accountId: `acct:${id}:free`, providerId: id, planTier: 'free' as const }]); }
  };

  const cycleTier = (providerId: string) => setAccounts(accounts.map((a) => { if (a.providerId !== providerId) return a; const idx = TIER_OPTIONS.indexOf(a.planTier); return { ...a, planTier: TIER_OPTIONS[(idx + 1) % TIER_OPTIONS.length]! }; }));

  const handlePaletteAction = (hit: SearchHit) => {
    if (!hit.actionUrl) return;
    if (hit.actionUrl.startsWith('switch-surface:')) {
      // No surface switching in canvas-native mode
      console.log('Surface switch ignored:', hit.actionUrl);
    } else if (hit.actionUrl.startsWith('shell:')) {
      console.log('Shell command:', hit.actionUrl);
    } else if (hit.actionUrl.startsWith('workspace:')) {
      setWorkspace(hit.actionUrl.slice('workspace:'.length));
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', fontFamily: 'var(--font-sans)', background: 'var(--background)', color: 'var(--foreground)' }}>
      {/* Canvas-native: no tabs, no separate ChatPage. LivingCanvas IS the app. */}

      {/* Minimal top bar */}
      <header style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px', borderBottom: '1px solid var(--border)', background: 'var(--card)', flexShrink: 0, height: 44 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name="layers" size={16} className="text-primary" />
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-0.02em' }}>Vivim</span>
        </div>
        <div style={{ flex: 1 }} />
        <PresenceIndicator workspaceId={workspaceId} />
        <button onClick={() => setPaletteOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--muted-foreground)', borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit', minWidth: 200 }}>
          <Icon name="search" size={13} />
          <span style={{ flex: 1, textAlign: 'left' }}>Search or run command</span>
          <kbd style={{ padding: '1px 5px', background: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 'calc(var(--radius) - 4px)', fontSize: 9, fontFamily: 'var(--font-mono)' }}>K</kbd>
        </button>
        <NotificationsCenter userId="user:demo" />
        <button onClick={() => setThemeOpen((o) => !o)} style={{ padding: '5px 8px', border: '1px solid var(--border)', background: 'var(--card)', borderRadius: 'var(--radius)', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--muted-foreground)' }}>
          <Icon name="palette" size={14} />
        </button>
        {themeOpen && <ThemeSettings onClose={() => setThemeOpen(false)} />}
        <button onClick={() => setShowSidebar((o) => !o)} style={{ padding: '5px 8px', border: '1px solid var(--border)', background: 'var(--card)', borderRadius: 'var(--radius)', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--muted-foreground)', marginLeft: 4 }} title="Toggle sidebar (Ctrl+B)">
          <Icon name={showSidebar ? 'panel-left' : 'panel-right'} size={14} />
        </button>
      </header>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Sidebar as a collapsible panel */}
        {showSidebar && (
          <aside style={{ width: 280, flexShrink: 0, borderRight: '1px solid var(--border)', background: 'var(--sidebar)', overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }} className="scrollbar-thin">
            <WorkspaceSwitcher currentWorkspaceId={workspaceId} onSwitch={(id) => setWorkspace(id)} />

            <section>
              <div className="text-label" style={{ marginBottom: 4 }}>Variant</div>
              <div style={{ display: 'flex', gap: 4 }}>
                <input value={draftVariant} placeholder="opus, voice" onChange={(e) => setDraftVariant(e.target.value)} style={{ flex: 1, padding: '4px 6px', border: '1px solid var(--border)', background: 'var(--background)', color: 'var(--foreground)', borderRadius: 'calc(var(--radius) - 4px)', fontSize: 11, fontFamily: 'var(--font-mono)' }} />
                <button onClick={() => setVariant(draftVariant || undefined)} style={{ padding: '4px 8px', border: '1px solid var(--border)', background: 'var(--secondary)', color: 'var(--foreground)', borderRadius: 'calc(var(--radius) - 4px)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Set</button>
              </div>
            </section>

            <section>
              <div className="text-label" style={{ marginBottom: 4 }}>Providers ({providerIds.length})</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 280, overflowY: 'auto' }} className="scrollbar-thin">
                {providers.map((p) => {
                  const isOn = providerIds.includes(p.id);
                  const acct = accounts.find((a) => a.providerId === p.id);
                  return (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 6px', borderRadius: 'calc(var(--radius) - 4px)', background: isOn ? 'color-mix(in oklch, var(--ring) 8%, transparent)' : 'transparent', border: isOn ? '1px solid color-mix(in oklch, var(--ring) 30%, transparent)' : '1px solid transparent' }}>
                      <input type="checkbox" checked={isOn} onChange={() => toggleProvider(p.id)} style={{ margin: 0, accentColor: 'var(--ring)' }} />
                      <span style={{ flex: 1, fontSize: 11 }}>{p.name}</span>
                      {isOn && acct && <button onClick={() => cycleTier(p.id)} style={{ padding: '1px 5px', border: '1px solid var(--border)', background: 'var(--card)', borderRadius: 'calc(var(--radius) - 4px)', fontSize: 9, cursor: 'pointer', fontFamily: 'var(--font-mono)', color: 'var(--muted-foreground)' }}>{acct.planTier}</button>}
                    </div>
                  );
                })}
              </div>
            </section>

            <section style={{ marginTop: 'auto', fontSize: 10, color: 'var(--muted-foreground)', borderTop: '1px solid var(--border)', paddingTop: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Icon name="activity" size={11} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9 }}>{surface?.traceId.slice(0, 14)}</span>
              </div>
              <div style={{ marginTop: 2 }}>{surface?.durationMs ?? 0}ms | {surface?.slots.length ?? 0} slots</div>
              {health && <div style={{ marginTop: 2, fontFamily: 'var(--font-mono)', fontSize: 9 }}>backend: {health.status}{health.version ? ` v${health.version}` : ''}</div>}
              {providers.length > 0 && <div style={{ marginTop: 2, fontFamily: 'var(--font-mono)', fontSize: 9 }}>providers: {providers.length}</div>}
              {conversations.length > 0 && <div style={{ marginTop: 2, fontFamily: 'var(--font-mono)', fontSize: 9 }}>conversations: {conversations.length}</div>}
              {capabilities.length > 0 && <div style={{ marginTop: 2, fontFamily: 'var(--font-mono)', fontSize: 9 }}>capabilities: {capabilities.length}</div>}
              {isLoading && <div style={{ color: 'var(--ring)' }}>resolving</div>}
            </section>
          </aside>
        )}

        {/* LivingCanvas as the primary/only surface */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', minWidth: 0 }}>
          <ErrorBoundary fallback={<div style={{ padding: 48, textAlign: 'center', color: 'var(--muted-foreground)', fontSize: 13 }}>Something went wrong in the canvas.</div>}>
            <DrawerSystem workspaceId={workspaceId}>
              <LivingCanvas workspaceId={workspaceId} userId="user:demo" providerIds={providerIds} accounts={accounts} variant={variant} />
            </DrawerSystem>
          </ErrorBoundary>
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onAction={handlePaletteAction} workspaceId={workspaceId} />
      <OnboardingTour userId="user:demo" onAction={(cmd) => { if (cmd.startsWith('switch-surface:')) console.log('Surface switch ignored:', cmd); }} />
      <QuickActionsMenu onSearch={() => setPaletteOpen(true)} onShellCommand={() => console.log('Shell command')} onOpenDoc={() => console.log('Open docs')} onOpenVideo={() => console.log('Open media')} onSwitchWorkspace={() => {}} />
      {showDevConsole && (
        <DevConsole
          workspaceId={workspaceId}
          onClose={() => setShowDevConsole(false)}
        />
      )}
    </div>
  );
}

function DevConsole({ workspaceId, onClose }: { workspaceId: string; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: '40vh', maxHeight: '60vh', minHeight: 300, background: 'var(--card)', borderTop: '1px solid var(--border)', boxShadow: '0 -4px 24px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', zIndex: 1000, fontFamily: 'var(--font-mono)', fontSize: 11 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderBottom: '1px solid var(--border)', background: 'var(--secondary)', flexShrink: 0 }}>
        <Icon name="terminal" size={12} className="text-ring" />
        <strong style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Dev Console</strong>
        <span style={{ fontSize: 10, color: 'var(--muted-foreground)', marginLeft: 'auto' }}>Workspace: {workspaceId}</span>
        <button onClick={onClose} style={{ padding: '2px 6px', border: '1px solid var(--border)', background: 'var(--background)', borderRadius: 4, cursor: 'pointer', fontSize: 10, fontFamily: 'inherit' }}>✕</button>
      </div>
      <div style={{ flex: 1, padding: 8, overflow: 'auto' }} className="scrollbar-thin">
        <div style={{ color: 'var(--muted-foreground)', textAlign: 'center', padding: 24 }}>Dev console connected to workspace. IO events stream here.</div>
      </div>
    </div>
  );
}