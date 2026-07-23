'use client';

/**
 * components/canvas/NotificationsCenter.tsx (#3)
 * --------------------------------------------------------------------
 * Smart Notifications Center — bell icon + dropdown.
 * - Real-time via SSE (useCanvasEvents invalidates this).
 * - Smart filtering: All / Mentions / Errors / Completions / HITL.
 * - Mark all read, archive, click-through to source.
 * - Badge with unread count.
 */

import { useCallback, useEffect, useState } from 'react';
import type { Notification, NotificationKind } from '../../shared/notification';

const KIND_ICON: Record<NotificationKind, string> = {
  mention: '',
  error: '',
  completion: '',
  hitl: '',
  system: '',
  info: '',
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

export function NotificationsCenter({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<'all' | NotificationKind>('all');
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch(`/api/notification/list?userId=${encodeURIComponent(userId)}`);
      const data = (await res.json()) as { ok: boolean; notifications: Notification[] };
      if (data.ok) {
        setNotifications(data.notifications);
        setUnreadCount(data.notifications.filter((n) => !n.read).length);
      }
    } catch {
      // ignore
    }
  }, [userId]);

  const fetchUnread = useCallback(async () => {
    try {
      const res = await fetch(`/api/notification/stats?userId=${encodeURIComponent(userId)}`);
      const data = (await res.json()) as { ok: boolean; stats: { unread: number } };
      if (data.ok) setUnreadCount(data.stats.unread);
    } catch {
      // ignore
    }
  }, [userId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchUnread();
    const t = setInterval(fetchUnread, 10_000); // poll every 10s (SSE also triggers)
    return () => clearInterval(t);
  }, [fetchUnread]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) fetchNotifications();
  }, [open, fetchNotifications]);

  const markAllRead = async () => {
    await fetch('/api/notification/mark_all_read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    fetchNotifications();
  };

  const filtered = filter === 'all' ? notifications : notifications.filter((n) => n.kind === filter);

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
            width: 380,
            maxHeight: 500,
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
          <div
            style={{
              padding: '10px 12px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <strong style={{ fontSize: 13 }}>Notifications</strong>
            <button onClick={markAllRead} style={btnStyle} disabled={unreadCount === 0}>
              Mark all read
            </button>
          </div>

          <div style={{ display: 'flex', gap: 2, padding: '6px 8px', borderBottom: '1px solid var(--border)' }}>
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                style={{
                  padding: '3px 8px',
                  border: 'none',
                  background: filter === f.id ? 'var(--accent-subtle)' : 'transparent',
                  color: filter === f.id ? 'var(--accent)' : 'var(--text-muted)',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontSize: 11,
                  fontWeight: filter === f.id ? 600 : 400,
                  fontFamily: 'inherit',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', maxHeight: 380 }}>
            {filtered.length === 0 && (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-subtle)', fontSize: 12 }}>
                No notifications
              </div>
            )}
            {filtered.map((n) => (
              <div
                key={n.id}
                style={{
                  padding: '8px 12px',
                  borderBottom: '1px solid var(--border)',
                  background: n.read ? 'transparent' : 'var(--accent-subtle)',
                  display: 'flex',
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 16 }}>{KIND_ICON[n.kind]}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: n.read ? 400 : 600 }}>{n.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{n.body}</div>
                  <div style={{ fontSize: 9, color: 'var(--text-subtle)', marginTop: 3 }}>
                    {KIND_LABEL[n.kind]} · {formatTime(n.createdAt)}
                    {n.traceId && ` · trace ${n.traceId.slice(0, 8)}…`}
                  </div>
                </div>
                {!n.read && (
                  <div style={{ width: 6, height: 6, background: 'var(--accent)', borderRadius: '50%', marginTop: 6, flexShrink: 0 }} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function formatTime(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

const btnStyle: React.CSSProperties = {
  padding: '3px 8px',
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--text-muted)',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 10,
  fontFamily: 'inherit',
};
