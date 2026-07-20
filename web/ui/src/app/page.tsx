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

import { useEffect, useState } from 'react';
import {
  CanvasSurface,
  LiveConfigProvider,
  useLiveConfig,
  WorkspaceSwitcher,
  CommandPalette,
  NotificationsCenter,
  OnboardingTour,
  QuickActionsMenu,
  PresenceIndicator,
  ThemeSettings,
  AuditDashboard,
  RbacManager,
  TemplatesGallery,
  DocCard,
  MediaCard,
  AutomationCard,
  AgentCard,
  ShellCard,
  DocEditor,
  ZLayerPanel,
  DrawerSystem,
  LivingCanvas,
} from '@/components/canvas';
import type { AccountContext, PlanTier } from '@/shared/route-context';
import type { DocumentCard as DocumentCardRow } from '@/shared/document';
import type { MediaCard as MediaCardRow } from '@/shared/media';
import type { AutomationDefinition } from '@/shared/automation';
import type { AgentDefinition } from '@/shared/agent';
import type { WorkspaceTaxonomy } from '@/shared/workspace';
import type { SearchHit } from '@/shared/search';
import { executeCapability } from '@/sdk/backend-client';

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

  const [draftVariant, setDraftVariant] = useState('');
  const [activeSurface, setActiveSurface] = useState<(typeof SURFACES)[number]['slug']>('chat');
  const [docs, setDocs] = useState<DocumentCardRow[]>([]);
  const [medias, setMedias] = useState<MediaCardRow[]>([]);
  const [automations, setAutomations] = useState<AutomationDefinition[]>([]);
  const [agents, setAgents] = useState<AgentDefinition[]>([]);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [capResult, setCapResult] = useState<string | null>(null);

  // ⌘K / Ctrl+K to open the command palette.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Load Phase 2 surfaces on mount.
  useEffect(() => {
    Promise.all([
      fetch('http://localhost:9420/api/document/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Welcome to Vivim',
          mimeType: 'text/markdown',
          inlineContent:
            '# Welcome to Vivim Universal Canvas\n\nPhase 3 adds 10 killer UX enhancements:\n\n- **⌘K Command Palette** — fuzzy search everything\n- **Universal Search** — docs, media, automations, agents, workspaces\n- **Smart Notifications** — real-time inbox with smart filtering\n- **Theme System** — dark/light/auto + 6 accents\n- **Onboarding Tour** — 5-step walkthrough for new users\n- **Quick Actions Menu** — right-click anywhere\n- **Live Presence** — see who\'s here + animated cursors\n- **Audit Dashboard** — visual trace timeline (enterprise)\n- **RBAC Manager** — roles + permissions (enterprise)\n- **Templates Gallery** — one-click workspace setups (enterprise)\n\nPress ⌘K (or Ctrl+K) to try the Command Palette.',
          workspaceId,
        }),
      }).then((r) => r.json()),
      fetch('http://localhost:9420/api/document/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'sample.ts',
          mimeType: 'text/typescript',
          inlineContent:
            '// A sample TypeScript document.\n// Production renders this with shiki syntax highlighting.\n\nexport function routeSync(ctx: RouteContext): ResolvedSurface {\n  return walkTree(ctx);\n}\n',
          language: 'typescript',
          workspaceId,
        }),
      }).then((r) => r.json()),
    ]).then((rs) => {
      const ds = (rs as Array<{ ok: boolean; document: DocumentCardRow }>)
        .filter((r) => r.ok)
        .map((r) => r.document);
      setDocs(ds);
    });

    Promise.all([
      fetch('http://localhost:9420/api/media/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Big Buck Bunny (sample)',
          kind: 'video',
          sourceUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
          mimeType: 'video/mp4',
          durationSec: 596,
          workspaceId,
        }),
      }).then((r) => r.json()),
      fetch('http://localhost:9420/api/media/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Sample audio clip',
          kind: 'audio',
          sourceUrl: 'https://example.com/sample.mp3',
          mimeType: 'audio/mpeg',
          durationSec: 42,
          workspaceId,
        }),
      }).then((r) => r.json()),
    ]).then((rs) => {
      const ms = (rs as Array<{ ok: boolean; media: MediaCardRow }>)
        .filter((r) => r.ok)
        .map((r) => r.media);
      setMedias(ms);
    });

    fetch(`/api/automation/list?workspaceId=${encodeURIComponent(workspaceId)}`)
      .then((r) => r.json())
      .then((d: { ok: boolean; automations: AutomationDefinition[] }) =>
        setAutomations(d.ok ? d.automations.slice(0, 4) : []),
      )
      .catch(() => setAutomations([]));

    fetch(`/api/agent/list?workspaceId=${encodeURIComponent(workspaceId)}`)
      .then((r) => r.json())
      .then((d: { ok: boolean; agents: AgentDefinition[] }) =>
        setAgents(d.ok ? d.agents : []),
      )
      .catch(() => setAgents([]));
  }, []);

  // Seed a few notifications on first load so the bell shows activity.
  useEffect(() => {
    fetch('http://localhost:9420/api/notification/stats?userId=user:demo')
      .then((r) => r.json())
      .then((d: { ok: boolean; stats: { unread: number } }) => {
        if (d.ok && d.stats.unread === 0) {
          // Seed a few demo notifications via direct API (one-shot).
          fetch('http://localhost:9420/api/notification/seed', { method: 'POST' }).catch(() => {});
        }
      })
      .catch(() => {});
  }, []);

  const toggleProvider = (id: string) => {
    const isOn = providerIds.includes(id);
    if (isOn) {
      const next = providerIds.filter((p) => p !== id);
      setProviderIds(next);
      setAccounts(accounts.filter((a) => a.providerId !== id));
    } else {
      setProviderIds([...providerIds, id]);
      setAccounts([
        ...accounts,
        { accountId: `acct:${id}:free`, providerId: id, planTier: 'free' as const },
      ]);
    }
  };

  const cycleTier = (providerId: string) => {
    setAccounts(
      accounts.map((a) => {
        if (a.providerId !== providerId) return a;
        const idx = TIER_OPTIONS.indexOf(a.planTier);
        const next = TIER_OPTIONS[(idx + 1) % TIER_OPTIONS.length]!;
        return { ...a, planTier: next };
      }),
    );
  };

  const handlePaletteAction = (hit: SearchHit) => {
    if (!hit.actionUrl) return;
    if (hit.actionUrl.startsWith('capability:')) {
      const capabilityId = hit.actionUrl.slice('capability:'.length);
      executeCapability(capabilityId)
        .then((res) => {
          if (res.ok) {
            setCapResult(`✓ ${hit.title} executed`);
          } else {
            setCapResult(`✗ ${hit.title} failed: ${res.error}`);
          }
        })
        .catch((e) => setCapResult(`✗ ${hit.title} error: ${String(e)}`));
      return;
    }
    if (hit.actionUrl.startsWith('switch-surface:')) {
      const surface = hit.actionUrl.slice('switch-surface:'.length);
      setActiveSurface(surface as (typeof SURFACES)[number]['slug']);
    } else if (hit.actionUrl.startsWith('shell:')) {
      const cmd = hit.actionUrl.slice('shell:'.length);
      setActiveSurface('shell');
      // The ShellCard will pick up the command via localStorage (simple bridge).
      try {
        window.localStorage.setItem('vivim.shell.pendingCommand', cmd);
      } catch {
        // ignore
      }
    } else if (hit.actionUrl.startsWith('workspace:')) {
      const wsId = hit.actionUrl.slice('workspace:'.length);
      setWorkspace(wsId);
    }
  };

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
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '6px 12px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-elevated)',
          flexShrink: 0,
        }}
      >
        <strong style={{ fontSize: 13 }}>Vivim</strong>
        <span style={{ fontSize: 10, color: 'var(--text-subtle)' }}>Phase 3 · 10 UX enhancements</span>

        <div style={{ flex: 1 }} />

        {/* #7 Presence */}
        <div data-onboarding="presence">
          <PresenceIndicator workspaceId={workspaceId} />
        </div>

        {/* #1 ⌘K button */}
        <button
          onClick={() => setPaletteOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            border: '1px solid var(--border)',
            background: 'var(--bg)',
            color: 'var(--text-muted)',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 11,
            fontFamily: 'inherit',
            minWidth: 180,
          }}
        >
          <span>🔍</span>
          <span style={{ flex: 1, textAlign: 'left' }}>Search or run a command…</span>
          <kbd
            style={{
              padding: '1px 5px',
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border)',
              borderRadius: 3,
              fontSize: 9,
              fontFamily: 'ui-monospace, monospace',
            }}
          >
            ⌘K
          </kbd>
        </button>

        {/* #3 Notifications */}
        <NotificationsCenter userId="user:demo" />

        {/* #4 Theme */}
        <button
          onClick={() => setThemeOpen((o) => !o)}
          style={{
            padding: '6px 10px',
            border: '1px solid var(--border)',
            background: 'var(--bg-elevated)',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 14,
            fontFamily: 'inherit',
          }}
          title="Appearance"
        >
          🎨
        </button>
        {themeOpen && <ThemeSettings onClose={() => setThemeOpen(false)} />}
      </header>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Sidebar */}
        <aside
          style={{
            width: 260,
            flexShrink: 0,
            borderRight: '1px solid var(--border)',
            background: 'var(--bg-elevated)',
            overflowY: 'auto',
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div data-onboarding="workspace-switcher">
            <WorkspaceSwitcher
              currentWorkspaceId={workspaceId}
              onSwitch={(id) => setWorkspace(id)}
            />
          </div>

          <section>
            <label style={labelStyle}>Variant</label>
            <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
              <input
                type="text"
                value={draftVariant}
                placeholder="opus, voice, workspace"
                onChange={(e) => setDraftVariant(e.target.value)}
                style={inputStyle}
              />
              <button onClick={() => setVariant(draftVariant || undefined)} style={btnStyle}>
                Set
              </button>
            </div>
            {variant && (
              <div style={{ marginTop: 4, fontSize: 10, color: 'var(--text-muted)' }}>
                Current: <code>{variant}</code>
              </div>
            )}
          </section>

          <section>
            <label style={labelStyle}>Providers ({providerIds.length})</label>
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: '4px 0 0',
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                maxHeight: 280,
                overflowY: 'auto',
              }}
            >
              {PROVIDER_OPTIONS.map((p) => {
                const isOn = providerIds.includes(p.id);
                const acct = accounts.find((a) => a.providerId === p.id);
                return (
                  <li key={p.id}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '3px 6px',
                        borderRadius: 4,
                        background: isOn ? 'var(--accent-subtle)' : 'transparent',
                        border: isOn ? '1px solid var(--accent)' : '1px solid transparent',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isOn}
                        onChange={() => toggleProvider(p.id)}
                        style={{ margin: 0, accentColor: 'var(--accent)' }}
                      />
                      <span style={{ flex: 1, fontSize: 11 }}>{p.label}</span>
                      {isOn && acct && (
                        <button
                          onClick={() => cycleTier(p.id)}
                          style={{
                            padding: '1px 6px',
                            border: '1px solid var(--border)',
                            background: 'var(--bg)',
                            borderRadius: 3,
                            fontSize: 9,
                            cursor: 'pointer',
                            fontFamily: 'ui-monospace, monospace',
                            color: 'var(--text-muted)',
                          }}
                        >
                          {acct.planTier}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          <section style={{ marginTop: 'auto', fontSize: 10, color: 'var(--text-subtle)', borderTop: '1px solid var(--border)', paddingTop: 8 }}>
            <div>trace: <code>{surface?.traceId.slice(0, 14)}…</code></div>
            <div>resolved in {surface?.durationMs ?? '—'}ms</div>
            <div>slots: {surface?.slots.length ?? 0}</div>
            {isLoading && <div style={{ color: 'var(--accent)' }}>resolving…</div>}
            {error && <div style={{ color: '#ef4444' }}>error: {String(error.message).slice(0, 60)}</div>}
          </section>
        </aside>

        {/* Main canvas area */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', minWidth: 0 }}>
          {/* Surface tabs */}
          <div
            data-onboarding="surface-tabs"
            style={{
              display: 'flex',
              borderBottom: '1px solid var(--border)',
              background: 'var(--bg-elevated)',
              padding: '0 8px',
              overflowX: 'auto',
            }}
          >
            {SURFACES.map((s) => {
              const active = activeSurface === s.slug;
              const isShell = s.slug === 'shell';
              return (
                <button
                  key={s.slug}
                  data-onboarding={isShell ? 'shell-tab' : undefined}
                  onClick={() => setActiveSurface(s.slug)}
                  style={{
                    padding: '8px 12px',
                    border: 'none',
                    borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
                    background: 'transparent',
                    cursor: 'pointer',
                    fontSize: 11,
                    fontWeight: active ? 600 : 400,
                    color: active ? 'var(--text)' : 'var(--text-muted)',
                    fontFamily: 'inherit',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span style={{ marginRight: 4 }}>{s.icon}</span>
                  {s.label}
                </button>
              );
            })}
          </div>

          {/* Surface content — wrapped in the DrawerSystem (E3) */}
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            <DrawerSystem workspaceId={workspaceId}>
              {activeSurface === 'chat' && (
                <LivingCanvas
                  workspaceId={workspaceId}
                  userId="user:demo"
                  providerIds={providerIds}
                  accounts={accounts}
                  variant={variant}
                />
            )}
            {activeSurface === 'docs' && (
              <CardGrid>
                {docs.map((doc) => (
                  <CardFrame key={doc.id} title={doc.title} badge={doc.engine}>
                    <DocCard document={doc} />
                  </CardFrame>
                ))}
                {docs.length === 0 && <EmptyCard label="No documents open" />}
              </CardGrid>
            )}
            {activeSurface === 'media' && (
              <CardGrid>
                {medias.map((m) => (
                  <CardFrame key={m.id} title={m.title} badge={m.engine}>
                    <MediaCard media={m} />
                  </CardFrame>
                ))}
                {medias.length === 0 && <EmptyCard label="No media open" />}
              </CardGrid>
            )}
            {activeSurface === 'automation' && (
              <CardGrid>
                {automations.map((a) => (
                  <CardFrame key={a.id} title={a.name} badge={`auto · ${a.trigger.kind}`}>
                    <AutomationCard
                      automation={a}
                      onExecute={async (id) => {
                        await fetch('http://localhost:9420/api/automation/execute', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ automationId: id }),
                        });
                      }}
                    />
                  </CardFrame>
                ))}
                {automations.length === 0 && <EmptyCard label="No automations" />}
              </CardGrid>
            )}
            {activeSurface === 'agents' && (
              <CardGrid>
                {agents.map((a) => (
                  <CardFrame key={a.id} title={a.name} badge="agent">
                    <AgentCard
                      agent={a}
                      onInvoke={async (id) => {
                        await fetch('http://localhost:9420/api/agent/invoke', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ agentId: id }),
                        });
                      }}
                    />
                  </CardFrame>
                ))}
                {agents.length === 0 && <EmptyCard label="No agents" />}
              </CardGrid>
            )}
            {activeSurface === 'shell' && (
              <div style={{ position: 'absolute', inset: 16 }}>
                <ShellCard workspaceId={workspaceId} />
              </div>
            )}
            {activeSurface === 'audit' && <AuditDashboard workspaceId={workspaceId} />}
            {activeSurface === 'rbac' && <RbacManager workspaceId={workspaceId} />}
            {activeSurface === 'templates' && (
              <TemplatesGallery
                onCreated={(wsId) => {
                  setWorkspace(wsId);
                  setActiveSurface('chat');
                }}
              />
            )}
            {activeSurface === 'editor' && (
              <div style={{ position: 'absolute', inset: 16, display: 'flex', gap: 16 }}>
                {docs.length > 0 && (
                  <div style={{ flex: 1, borderRadius: 8, border: '1px solid var(--border)', overflow: 'hidden', background: 'var(--bg-elevated)' }}>
                    <DocEditor document={docs[0]!} />
                  </div>
                )}
                {docs.length === 0 && <EmptyCard label="No documents to edit. Open one from the Documents tab." />}
              </div>
            )}
            {activeSurface === 'zlayers' && (
              <div style={{ padding: 16, overflowY: 'auto' }}>
                <ZLayerPanel workspaceId={workspaceId} />
              </div>
            )}
            </DrawerSystem>
          </div>
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
            setActiveSurface(cmd.slice('switch-surface:'.length) as (typeof SURFACES)[number]['slug']);
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
    </div>
  );
}

function CardGrid({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        padding: 16,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
        gap: 16,
        overflowY: 'auto',
      }}
    >
      {children}
    </div>
  );
}

function CardFrame({
  title,
  badge,
  children,
}: {
  title: string;
  badge: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: 320,
        borderRadius: 8,
        border: '1px solid var(--border)',
        background: 'var(--bg-elevated)',
        boxShadow: 'var(--shadow)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '6px 10px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-subtle)',
          fontSize: 11,
          color: 'var(--text-muted)',
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <strong style={{ color: 'var(--text)' }}>{title}</strong>
        <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10 }}>{badge}</span>
      </div>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

function EmptyCard({ label }: { label: string }) {
  return (
    <div
      style={{
        gridColumn: '1 / -1',
        padding: 48,
        textAlign: 'center',
        color: 'var(--text-subtle)',
        fontSize: 13,
      }}
    >
      {label}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};
const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: '4px 6px',
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--text)',
  borderRadius: 4,
  fontSize: 11,
  fontFamily: 'ui-monospace, monospace',
};
const btnStyle: React.CSSProperties = {
  padding: '4px 8px',
  border: '1px solid var(--border)',
  background: 'var(--bg-subtle)',
  color: 'var(--text)',
  borderRadius: 4,
  fontSize: 11,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
