'use client';

/**
 * components/canvas/PresenceIndicator.tsx (#7)
 * --------------------------------------------------------------------
 * Live presence indicators — avatars in the header showing "who's here".
 * Polls /api/presence/list every 5s. Animated cursors on the canvas
 * are a separate component (CanvasCursors).
 */

import { useEffect, useState } from 'react';
import type { PresenceUser, PresenceCursor } from '../../shared/presence';
import { useIO } from './UnifiedIOProvider';

export function PresenceIndicator({ workspaceId }: { workspaceId: string }) {
  const [users, setUsers] = useState<PresenceUser[]>([]);
  const [cursors, setCursors] = useState<PresenceCursor[]>([]);
  const io = useIO();

  useEffect(() => {
    let cancelled = false;
    const fetchPresence = async () => {
      try {
        const res = await io.get<{ ok: boolean; users: PresenceUser[] }>(`/api/presence/list?workspaceId=${encodeURIComponent(workspaceId)}`);
        if (!cancelled && res.data?.ok) setUsers(res.data.users);
        const cRes = await io.get<{ ok: boolean; cursors: PresenceCursor[] }>(`/api/presence/cursors?workspaceId=${encodeURIComponent(workspaceId)}`);
        if (!cancelled && cRes.data?.ok) setCursors(cRes.data.cursors);
      } catch {
  // [audit] log the error with context here
        // ignore
      }
    };
    fetchPresence();
    const t = setInterval(fetchPresence, 5_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [workspaceId, io]);

  const visibleUsers = users.slice(0, 5);
  const overflow = users.length - visibleUsers.length;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {/* Cursor layer (only shown when there are remote cursors) */}
      <CursorLayer cursors={cursors} />
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {visibleUsers.map((u, i) => (
          <div
            key={u.id}
            title={`${u.displayName}${u.id === 'user:1' ? ' (you)' : ''}`}
            style={{
              width: 26,
              height: 26,
              borderRadius: '50%',
              background: u.avatarColor,
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              marginLeft: i === 0 ? 0 : -8,
              border: '2px solid var(--bg-elevated)',
              fontWeight: 600,
            }}
          >
            {u.avatarEmoji}
          </div>
        ))}
        {overflow > 0 && (
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: '50%',
              background: 'var(--bg-subtle)',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 10,
              marginLeft: -8,
              border: '2px solid var(--bg-elevated)',
              fontWeight: 600,
            }}
          >
            +{overflow}
          </div>
        )}
      </div>
      {users.length > 0 && (
        <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 4 }}>
          {users.length} {users.length === 1 ? 'person' : 'people'}
        </span>
      )}
    </div>
  );
}

function CursorLayer({ cursors }: { cursors: PresenceCursor[] }) {
  if (cursors.length === 0) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 900 }}>
      {cursors.map((c) => (
        <div
          key={c.userId}
          style={{
            position: 'absolute',
            left: c.x,
            top: c.y,
            transition: 'left 1.5s ease-out, top 1.5s ease-out',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 2,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20">
            <path d="M2 2 L18 10 L10 11 L8 18 Z" fill={c.user.avatarColor} stroke="white" strokeWidth="1.5" />
          </svg>
          <span
            style={{
              marginTop: 16,
              padding: '1px 6px',
              background: c.user.avatarColor,
              color: 'white',
              borderRadius: 4,
              fontSize: 10,
              fontWeight: 600,
              fontFamily: 'ui-sans-serif, system-ui',
            }}
          >
            {c.user.displayName}
            {c.activity ? ` · ${c.activity}` : ''}
          </span>
        </div>
      ))}
    </div>
  );
}
