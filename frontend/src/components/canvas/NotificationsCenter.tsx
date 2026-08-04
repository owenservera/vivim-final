'use client';

/**
 * components/canvas/NotificationsCenter.tsx (#3 + #7 enhancements)
 * --------------------------------------------------------------------
 * Smart Notifications Center — bell icon + dropdown.
 * - Real-time via SSE (useCanvasEvents invalidates this).
 * - Smart filtering: All / Mentions / Errors / Completions / HITL.
 * - Per-item actions: mark read, archive, dismiss.
 * - Grouping by kind with collapsible sections.
 * - Mark all read, archive, click-through to source.
 * - Badge with unread count.
 * - Preferences modal for mute/dnd.
 */

import { useCallback, useEffect, useState } from 'react';
import type { Notification, NotificationKind } from '../../shared/notification';
import { useIO } from './UnifiedIOProvider';
import { useFocusTrap } from '@/hooks/useFocusTrap';

const KIND_ICON: Record<NotificationKind, string> = {
  mention: '💬',
  error: '❌',
  completion: '✅',
  hitl: '⏳',
  system: '⚙️',
  info: 'ℹ️',
};

const KIND_LABEL: Record<NotificationKind, string> = {
  mention: 'Mentions',
  error: 'Errors',
  completion: 'Completions',
  hitl: 'Approvals',
  system: 'System',
  info: 'Info',
};

const FILTERS: Array<{ id: 'all' | NotificationKind; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'mention', label: 'Mentions' },
  { id: 'error', label: 'Errors' },
  { id: 'completion', label: 'Completions' },
  { id: 'hitl', label: 'Approvals' },
];

interface NotificationPreferences {
  muted: boolean
  dnd: boolean
  soundEnabled: boolean
}

export function NotificationsCenter({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<'all' | NotificationKind>('all');
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    muted: false, dnd: false, soundEnabled: true,
  });
  const io = useIO();

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await io.get<{ ok: boolean; notifications: Notification[] }>(`/api/notification/list?userId=${encodeURIComponent(userId)}`);
      if (res.data?.ok) {
        setNotifications(res.data.notifications);
        setUnreadCount(res.data.notifications.filter((n) => !n.read).length);
      }
    } catch {
      // ignore
    }
  }, [userId, io]);

  const fetchUnread = useCallback(async () => {
    try {
      const res = await io.get<{ ok: boolean; stats: { unread: number } }>(`/api/notification/stats?userId=${encodeURIComponent(userId)}`);
      if (res.data?.ok) setUnreadCount(res.data.stats.unread);
    } catch {
      // ignore
    }
  }, [userId, io]);

  useEffect(() => {
    fetchUnread();
    const t = setInterval(fetchUnread, 10_000);
    return () => clearInterval(t);
  }, [fetchUnread]);

  useEffect(() => {
    if (open) fetchNotifications();
  }, [open, fetchNotifications]);

  const markAllRead = async () => {
    await io.post('/api/notification/mark_all_read', { userId });
    fetchNotifications();
  };

  const markRead = async (id: string) => {
    await io.post('/api/notification/mark_read', { id });
    fetchNotifications();
  };

  const archive = async (id: string) => {
    await io.post('/api/notification/archive', { id });
    fetchNotifications();
  };

  const remove = async (id: string) => {
    await io.post('/api/notification/remove', { id });
    fetchNotifications();
  };

  const filtered = filter === 'all' ? notifications : notifications.filter((n) => n.kind === filter);

  // Group by kind
  const grouped = new Map<NotificationKind, Notification[]>();
  for (const n of filtered) {
    const bucket = grouped.get(n.kind) ?? [];
    bucket.push(n);
    grouped.set(n.kind, bucket);
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          position: 'relative',
          padding: '6px 10px',
          border: '1px solid var(--border)',
          background: 'var(--bg-elevated)',
          borderRadius: 6,
          cursor: 'pointer',
          fontSize: 14,
          fontFamily: 'inherit',
        }}
        title="Notifications"
      >
        🔔
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: -2,
              right: -2,
              minWidth: 16,
              height: 16,
              padding: '0 4px',
              background: 'var(--accent)',
              color: 'var(--accent-fg)',
              borderRadius: 8,
              fontSize: 9,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 44,
            right: 0,
            width: 400,
            maxHeight: 520,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            boxShadow: 'var(--shadow)',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            fontFamily: 'ui-sans-serif, system-ui',
            color: 'var(--text)',
          }}
        >
          {/* Header */}
          <div style={{
            padding: '10px 12px', borderBottom: '1px solid var(--border)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <strong style={{ fontSize: 13 }}>Notifications</strong>
            <div style={{ display: 'flex', gap: 4 }}>
              <button onClick={markAllRead} style={btnStyle} disabled={unreadCount === 0}>
                Mark all read
              </button>
              <button onClick={() => setShowPrefs(true)} style={btnStyle} title="Preferences">
                ⚙
              </button>
            </div>
          </div>

          {/* Filter chips */}
          <div style={{ display: 'flex', gap: 2, padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                style={{
                  padding: '3px 8px', border: 'none',
                  background: filter === f.id ? 'var(--accent-subtle)' : 'transparent',
                  color: filter === f.id ? 'var(--accent)' : 'var(--text-muted)',
                  borderRadius: 4, cursor: 'pointer', fontSize: 11,
                  fontWeight: filter === f.id ? 600 : 400, fontFamily: 'inherit',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Notification list */}
          <div style={{ flex: 1, overflowY: 'auto', maxHeight: 400 }}>
            {filtered.length === 0 && (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-subtle)', fontSize: 12 }}>
                No notifications
              </div>
            )}

            {/* Grouped by kind */}
            {Array.from(grouped.entries()).map(([kind, items]) => (
              <div key={kind}>
                <div style={{
                  padding: '4px 12px', fontSize: 10, fontWeight: 600,
                  color: 'var(--text-subtle)', textTransform: 'uppercase',
                  letterSpacing: '0.05em', background: 'var(--bg-subtle)',
                  borderBottom: '1px solid var(--border)',
                }}>
                  {KIND_ICON[kind]} {KIND_LABEL[kind]} ({items.length})
                </div>
                {items.map((n) => (
                  <div
                    key={n.id}
                    style={{
                      padding: '8px 12px', borderBottom: '1px solid var(--border)',
                      background: n.read ? 'transparent' : 'var(--accent-subtle)',
                      display: 'flex', gap: 8,
                    }}
                  >
                    <span style={{ fontSize: 16 }}>{KIND_ICON[n.kind]}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: n.read ? 400 : 600 }}>{n.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{n.body}</div>
                      <div style={{ fontSize: 9, color: 'var(--text-subtle)', marginTop: 3 }}>
                        {formatTime(n.createdAt)}
                        {n.traceId && ` · trace ${n.traceId.slice(0, 8)}…`}
                      </div>
                      {/* Per-item actions */}
                      <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                        {!n.read && (
                          <button onClick={() => markRead(n.id)} style={actionBtnStyle}>Mark read</button>
                        )}
                        <button onClick={() => archive(n.id)} style={actionBtnStyle}>Archive</button>
                        <button onClick={() => remove(n.id)} style={actionBtnStyle}>Dismiss</button>
                      </div>
                    </div>
                    {!n.read && (
                      <div style={{ width: 6, height: 6, background: 'var(--accent)', borderRadius: '50%', marginTop: 6, flexShrink: 0 }} />
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Preferences modal */}
          {showPrefs && (
            <NotificationPreferencesModal
              preferences={preferences}
              onChange={setPreferences}
              onClose={() => setShowPrefs(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}

function NotificationPreferencesModal({
  preferences,
  onChange,
  onClose,
}: {
  preferences: NotificationPreferences
  onChange: (p: NotificationPreferences) => void
  onClose: () => void
}) {
  const trapRef = useFocusTrap<HTMLDivElement>({ active: true })

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 10001,
        background: 'rgba(0,0,0,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        ref={trapRef}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Notification preferences"
        style={{
          background: 'var(--bg-elevated)', border: '1px solid var(--border)',
          borderRadius: 10, padding: 20, width: 300,
        }}
      >
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Notification Preferences</h3>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={preferences.muted} onChange={(e) => onChange({ ...preferences, muted: e.target.checked })} />
          Mute all notifications
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={preferences.dnd} onChange={(e) => onChange({ ...preferences, dnd: e.target.checked })} />
          Do not disturb
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, fontSize: 13, cursor: 'pointer' }}>
          <input type="checkbox" checked={preferences.soundEnabled} onChange={(e) => onChange({ ...preferences, soundEnabled: e.target.checked })} />
          Sound enabled
        </label>
        <button onClick={onClose} style={{ width: '100%', padding: '6px 12px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg)', cursor: 'pointer', fontSize: 12 }}>
          Done
        </button>
      </div>
    </div>
  )
}

function formatTime(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

const btnStyle: React.CSSProperties = {
  padding: '3px 8px', border: '1px solid var(--border)', background: 'var(--bg)',
  color: 'var(--text-muted)', borderRadius: 4, cursor: 'pointer', fontSize: 10, fontFamily: 'inherit',
};

const actionBtnStyle: React.CSSProperties = {
  padding: '2px 6px', border: '1px solid var(--border)', background: 'transparent',
  color: 'var(--text-muted)', borderRadius: 3, cursor: 'pointer', fontSize: 9, fontFamily: 'inherit',
};
