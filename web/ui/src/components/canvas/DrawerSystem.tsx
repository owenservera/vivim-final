'use client';

/**
 * components/canvas/DrawerSystem.tsx (E3)
 * --------------------------------------------------------------------
 * Edge drawer system. 4 configurable drawers (left/right/top/bottom),
 * each holding panels (messenger, agents, conversations, todos,
 * priorities, hits-tips-tricks, notifications, presence, audit).
 *
 * Drawers are:
 *   - Pinned or floating
 *   - Resizable (drag the edge — stubbed)
 *   - Collapsible (click header to fold)
 *   - Multi-panel (tabs inside a drawer)
 *
 * Data-driven from /api/drawer.
 */

import { useEffect, useState } from 'react';
import type { WorkspaceDrawerConfig, DrawerConfig, DrawerEdge, DrawerPanel } from '../../shared/drawer';
import { useIO } from './UnifiedIOProvider';

export function DrawerSystem({ workspaceId, children }: { workspaceId: string; children: React.ReactNode }) {
  const io = useIO();
  const [config, setConfig] = useState<WorkspaceDrawerConfig | null>(null);

  const fetchConfig = async () => {
    const res = await io.get<{ config: WorkspaceDrawerConfig }>(`/api/drawer/get?workspaceId=${encodeURIComponent(workspaceId)}`);
    if (res.ok) setConfig(res.data.config);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchConfig();
  }, [workspaceId]);

  const toggle = async (edge: DrawerEdge) => {
    if (!config) return;
    const updated = { ...config, drawers: { ...config.drawers, [edge]: { ...config.drawers[edge], collapsed: !config.drawers[edge].collapsed } } };
    setConfig(updated);
    await io.post('/api/drawer/toggle', { workspaceId, edge });
  };

  const setActivePanel = async (edge: DrawerEdge, panelId: string) => {
    if (!config) return;
    const updated = { ...config, drawers: { ...config.drawers, [edge]: { ...config.drawers[edge], activePanelId: panelId } } };
    setConfig(updated);
    await io.post('/api/drawer/set_active_panel', { workspaceId, edge, panelId });
  };

  if (!config) return <>{children}</>;

  const left = config.drawers.left;
  const right = config.drawers.right;
  const bottom = config.drawers.bottom;

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Left drawer */}
        {left.visible && left.panels.length > 0 && (
          <DrawerContainer
            config={left}
            onToggle={() => toggle('left')}
            onPanelClick={(id) => setActivePanel('left', id)}
            workspaceId={workspaceId}
          />
        )}

        {/* Main content */}
        <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>{children}</div>

        {/* Right drawer */}
        {right.visible && right.panels.length > 0 && (
          <DrawerContainer
            config={right}
            onToggle={() => toggle('right')}
            onPanelClick={(id) => setActivePanel('right', id)}
            workspaceId={workspaceId}
          />
        )}
      </div>

      {/* Bottom drawer */}
      {bottom.visible && bottom.panels.length > 0 && (
        <BottomDrawer
          config={bottom}
          onToggle={() => toggle('bottom')}
          onPanelClick={(id) => setActivePanel('bottom', id)}
          workspaceId={workspaceId}
        />
      )}
    </div>
  );
}

function DrawerContainer({
  config,
  onToggle,
  onPanelClick,
  workspaceId,
}: {
  config: DrawerConfig;
  onToggle: () => void;
  onPanelClick: (panelId: string) => void;
  workspaceId: string;
}) {
  const isLeft = config.edge === 'left';
  if (config.collapsed) {
    return (
      <div
        style={{
          width: 32,
          background: 'var(--bg-elevated)',
          borderRight: isLeft ? '1px solid var(--border)' : 'none',
          borderLeft: !isLeft ? '1px solid var(--border)' : 'none',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingTop: 8,
          gap: 8,
        }}
      >
        <button onClick={onToggle} style={collapseBtn} title="Expand">
          {isLeft ? '▶' : '◀'}
        </button>
        {config.panels.map((p) => (
          <div key={p.id} style={{ fontSize: 14, cursor: 'pointer' }} title={p.title} onClick={onToggle}>
            {p.icon}
            {p.badge ? (
              <span style={{ ...badgeStyle, position: 'absolute', transform: 'translate(8px, -8px)' }}>{p.badge}</span>
            ) : null}
          </div>
        ))}
      </div>
    );
  }
  return (
    <div
      style={{
        width: config.size,
        background: 'var(--bg-elevated)',
        borderRight: isLeft ? '1px solid var(--border)' : 'none',
        borderLeft: !isLeft ? '1px solid var(--border)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}
    >
      {/* Tab header */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
        {config.panels.map((p) => (
          <button
            key={p.id}
            onClick={() => onPanelClick(p.id)}
            style={{
              flex: 1,
              padding: '6px 4px',
              border: 'none',
              borderBottom: config.activePanelId === p.id ? '2px solid var(--accent)' : '2px solid transparent',
              background: 'transparent',
              color: config.activePanelId === p.id ? 'var(--text)' : 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: 10,
              fontFamily: 'inherit',
              position: 'relative',
            }}
          >
            {p.icon} {p.title}
            {p.badge ? <span style={badgeStyle}>{p.badge}</span> : null}
          </button>
        ))}
        <button onClick={onToggle} style={collapseBtn} title="Collapse">
          {isLeft ? '◀' : '▶'}
        </button>
      </div>
      {/* Active panel body */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <PanelBody panel={config.panels.find((p) => p.id === config.activePanelId) ?? config.panels[0]!} workspaceId={workspaceId} />
      </div>
    </div>
  );
}

function BottomDrawer({
  config,
  onToggle,
  onPanelClick,
  workspaceId,
}: {
  config: DrawerConfig;
  onToggle: () => void;
  onPanelClick: (panelId: string) => void;
  workspaceId: string;
}) {
  if (config.collapsed) {
    return (
      <div
        style={{
          height: 28,
          background: 'var(--bg-elevated)',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          fontSize: 11,
          color: 'var(--text-muted)',
          cursor: 'pointer',
        }}
        onClick={onToggle}
      >
        {config.panels.map((p) => (
          <span key={p.id}>
            {p.icon} {p.title}
            {p.badge ? <span style={badgeStyle}>{p.badge}</span> : null}
          </span>
        ))}
        <span>▲</span>
      </div>
    );
  }
  return (
    <div style={{ height: config.size, background: 'var(--bg-elevated)', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
        {config.panels.map((p) => (
          <button
            key={p.id}
            onClick={() => onPanelClick(p.id)}
            style={{
              flex: 1,
              padding: '4px',
              border: 'none',
              borderBottom: config.activePanelId === p.id ? '2px solid var(--accent)' : '2px solid transparent',
              background: 'transparent',
              color: config.activePanelId === p.id ? 'var(--text)' : 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: 10,
              fontFamily: 'inherit',
              position: 'relative',
            }}
          >
            {p.icon} {p.title}
            {p.badge ? <span style={badgeStyle}>{p.badge}</span> : null}
          </button>
        ))}
        <button onClick={onToggle} style={collapseBtn} title="Collapse">▼</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <PanelBody panel={config.panels.find((p) => p.id === config.activePanelId) ?? config.panels[0]!} workspaceId={workspaceId} />
      </div>
    </div>
  );
}

function PanelBody({ panel, workspaceId }: { panel: DrawerPanel; workspaceId: string }) {
  switch (panel.kind) {
    case 'conversations':
      return <ConversationsPanel workspaceId={workspaceId} />;
    case 'agents':
      return <AgentsPanel workspaceId={workspaceId} />;
    case 'todos':
      return <TodosPanel />;
    case 'priorities':
      return <PrioritiesPanel />;
    case 'hits-tips-tricks':
      return <HitsTipsPanel />;
    case 'notifications':
      return <NotificationsPanel />;
    case 'presence':
      return <PresencePanel workspaceId={workspaceId} />;
    case 'audit':
      return <AuditPanel />;
    case 'messenger':
      return <MessengerPanel />;
    default:
      return <div style={{ padding: 12, fontSize: 11, color: 'var(--text-muted)' }}>{panel.title} panel (custom)</div>;
  }
}

// ── Panel implementations ──────────────────────────────────────────────

function ConversationsPanel({ workspaceId }: { workspaceId: string }) {
  return (
    <div style={{ padding: 8 }}>
      {['conv:01HX…  chatgpt   4 msgs', 'conv:01HY…  claude    2 msgs', 'conv:01HZ…  gemini    8 msgs'].map((c, i) => (
        <div key={i} style={{ padding: '6px 8px', borderRadius: 4, fontSize: 11, cursor: 'pointer', color: 'var(--text)' }} onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--accent-subtle)')} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
          {c}
        </div>
      ))}
      <div style={{ fontSize: 9, color: 'var(--text-subtle)', marginTop: 8, padding: '0 8px' }}>workspace: {workspaceId.slice(0, 24)}</div>
    </div>
  );
}

function AgentsPanel({ workspaceId }: { workspaceId: string }) {
  const [agents, setAgents] = useState<Array<{ name: string; status: string; steps: number }>>([]);
  useEffect(() => {
    fetch(`/api/agent/list?workspaceId=${encodeURIComponent(workspaceId)}`)
      .then((r) => r.json())
      .then((d: { ok: boolean; agents: Array<{ name: string; status: string; steps: unknown[] }> }) => {
        if (d.ok) setAgents(d.agents.map((a) => ({ name: a.name, status: a.status, steps: a.steps.length })));
      })
      .catch(() => {});
  }, [workspaceId]);
  return (
    <div style={{ padding: 8 }}>
      {agents.length === 0 && <div style={{ fontSize: 11, color: 'var(--text-muted)', padding: 8 }}>No agents in this workspace.</div>}
      {agents.map((a, i) => (
        <div key={i} style={{ padding: '6px 8px', borderRadius: 4, fontSize: 11, color: 'var(--text)' }}>
          🤖 {a.name} <span style={{ color: 'var(--text-muted)' }}>· {a.steps} steps · {a.status}</span>
        </div>
      ))}
    </div>
  );
}

function TodosPanel() {
  const todos = [
    { id: 1, text: 'Review research plan', done: false },
    { id: 2, text: 'Transcribe video clip', done: false },
    { id: 3, text: 'Approve agent output', done: true },
  ];
  return (
    <div style={{ padding: 8 }}>
      {todos.map((t) => (
        <label key={t.id} style={{ display: 'flex', gap: 6, padding: '4px 8px', fontSize: 11, color: t.done ? 'var(--text-muted)' : 'var(--text)', textDecoration: t.done ? 'line-through' : 'none', cursor: 'pointer' }}>
          <input type="checkbox" defaultChecked={t.done} style={{ accentColor: 'var(--accent)' }} />
          {t.text}
        </label>
      ))}
    </div>
  );
}

function PrioritiesPanel() {
  const items = [
    { id: 1, label: 'P0: Approve HITL gate', color: '#ef4444' },
    { id: 2, label: 'P1: Draft blog post', color: '#f59e0b' },
  ];
  return (
    <div style={{ padding: 8 }}>
      {items.map((p) => (
        <div key={p.id} style={{ padding: '6px 8px', borderLeft: `3px solid ${p.color}`, background: 'var(--bg-subtle)', borderRadius: 4, fontSize: 11, color: 'var(--text)', marginBottom: 4 }}>
          {p.label}
        </div>
      ))}
    </div>
  );
}

function HitsTipsPanel() {
  const tips = [
    '💡 Press ⌘K to open the command palette.',
    '💡 Right-click anywhere for quick actions.',
    '💡 Switch workspaces to re-resolve the canvas under a new traceId.',
    '💡 Use the Shell tab to run CLI commands from the canvas.',
    '💡 Toggle Z-layers in the panel to focus on one layer at a time.',
  ];
  return (
    <div style={{ padding: 8 }}>
      {tips.map((t, i) => (
        <div key={i} style={{ padding: '6px 8px', fontSize: 11, color: 'var(--text)', lineHeight: 1.4, borderBottom: i < tips.length - 1 ? '1px solid var(--border)' : 'none' }}>
          {t}
        </div>
      ))}
    </div>
  );
}

function NotificationsPanel() {
  const [items, setItems] = useState<Array<{ title: string; kind: string; createdAt: number }>>([]);
  useEffect(() => {
    fetch('http://localhost:9420/api/notification/list?userId=user:demo&limit=10')
      .then((r) => r.json())
      .then((d: { ok: boolean; notifications: Array<{ title: string; kind: string; createdAt: number }> }) => {
        if (d.ok) setItems(d.notifications);
      })
      .catch(() => {});
  }, []);
  return (
    <div style={{ padding: 8 }}>
      {items.length === 0 && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>No activity.</div>}
      {items.map((n, i) => (
        <div key={i} style={{ padding: '4px 8px', fontSize: 10, color: 'var(--text)', borderBottom: '1px solid var(--border)' }}>
          {n.title}
        </div>
      ))}
    </div>
  );
}

function PresencePanel({ workspaceId }: { workspaceId: string }) {
  const [users, setUsers] = useState<Array<{ displayName: string; avatarEmoji: string; avatarColor: string }>>([]);
  useEffect(() => {
    fetch(`/api/presence/list?workspaceId=${encodeURIComponent(workspaceId)}`)
      .then((r) => r.json())
      .then((d: { ok: boolean; users: Array<{ displayName: string; avatarEmoji: string; avatarColor: string }> }) => {
        if (d.ok) setUsers(d.users);
      })
      .catch(() => {});
  }, [workspaceId]);
  return (
    <div style={{ padding: 8 }}>
      {users.map((u, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', fontSize: 11, color: 'var(--text)' }}>
          <span style={{ width: 20, height: 20, borderRadius: '50%', background: u.avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>{u.avatarEmoji}</span>
          {u.displayName}
        </div>
      ))}
    </div>
  );
}

function AuditPanel() {
  const [entries, setEntries] = useState<Array<{ engine: string; method: string; ok: boolean; durationMs: number }>>([]);
  useEffect(() => {
    fetch('http://localhost:9420/api/audit/list?limit=10')
      .then((r) => r.json())
      .then((d: { ok: boolean; entries: Array<{ engine: string; method: string; ok: boolean; durationMs: number }> }) => {
        if (d.ok) setEntries(d.entries);
      })
      .catch(() => {});
  }, []);
  return (
    <div style={{ padding: 8 }}>
      {entries.length === 0 && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>No audit events.</div>}
      {entries.map((e, i) => (
        <div key={i} style={{ padding: '3px 8px', fontSize: 10, color: 'var(--text)', borderLeft: `2px solid ${e.ok ? '#10b981' : '#ef4444'}`, marginBottom: 2 }}>
          {e.engine} · {e.method} · {e.durationMs}ms
        </div>
      ))}
    </div>
  );
}

function MessengerPanel() {
  return (
    <div style={{ padding: 8, fontSize: 11, color: 'var(--text-muted)' }}>
      <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>#general</div>
      <div style={{ padding: 4 }}>Maya: just pushed the new doc layout</div>
      <div style={{ padding: 4 }}>Theo: looks great 👍</div>
      <div style={{ padding: 4 }}>Sage: ship it</div>
    </div>
  );
}

const collapseBtn: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: 'var(--text-muted)',
  cursor: 'pointer',
  fontSize: 11,
  padding: '4px 8px',
  fontFamily: 'inherit',
};
const badgeStyle: React.CSSProperties = {
  display: 'inline-block',
  minWidth: 14,
  height: 14,
  padding: '0 3px',
  background: 'var(--accent)',
  color: 'var(--accent-fg)',
  borderRadius: 7,
  fontSize: 9,
  fontWeight: 700,
  lineHeight: '14px',
  textAlign: 'center',
};
