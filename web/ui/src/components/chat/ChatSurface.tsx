'use client';

/**
 * components/chat/ChatSurface.tsx — Composes Moments 1/2/3 into the v9 canvas.
 * --------------------------------------------------------------------
 * A single chat workspace surface wiring:
 *   - Moment 1: HealthIndicator (backend health + auth)
 *   - Moment 3: ConversationList (list / create / delete)
 *   - Moment 2: Composer (send + WS-streamed responses)
 *
 * Subscribes to the `conversation:<id>` WebSocket topic and forwards
 * streamed events to the Composer. Per contracts/websocket.md.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useWebSocket, type WsMessage } from '@/hooks/useWebSocket';
import { HealthIndicator } from './HealthIndicator';
import { ConversationList } from './ConversationList';
import { Composer } from './Composer';

export function ChatSurface({ defaultProviderId }: { defaultProviderId?: string }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [lastWs, setLastWs] = useState<WsMessage | null>(null);

  const handleWs = useCallback((msg: WsMessage) => {
    if (
      msg.type === 'conversation:block' ||
      msg.type === 'conversation:complete' ||
      msg.type === 'conversation:error'
    ) {
      setLastWs(msg);
    }
  }, []);

  const { status, subscribe } = useWebSocket({ autoConnect: true, onMessage: handleWs });

  // Subscribe to the active conversation's topic.
  useEffect(() => {
    if (!activeId) return;
    const off = subscribe(`conversation:${activeId}`);
    return off;
  }, [activeId, subscribe]);

  const handleSelect = useCallback((id: string) => {
    setActiveId(id || null);
  }, []);

  const forwardedWs = useMemo(() => lastWs, [lastWs]);

  return (
    <div
      data-moment-surface="chat"
      style={{
        display: 'grid',
        gridTemplateColumns: '260px 1fr',
        gridTemplateRows: 'auto 1fr',
        gridTemplateAreas: `'health health' 'list composer'`,
        height: '100%',
        width: '100%',
        minHeight: 0,
        fontFamily: 'ui-sans-serif, system-ui',
        background: 'var(--bg)',
        color: 'var(--text)',
      }}
    >
      <div style={{ gridArea: 'health', borderBottom: '1px solid var(--border)' }}>
        <HealthIndicator pollMs={15000} />
      </div>
      <div style={{ gridArea: 'list', borderRight: '1px solid var(--border)', minHeight: 0 }}>
        <ConversationList activeId={activeId} onSelect={handleSelect} defaultProviderId={defaultProviderId} />
      </div>
      <div style={{ gridArea: 'composer', minHeight: 0, display: 'flex' }}>
        <Composer conversationId={activeId} wsStatus={status} wsMessage={forwardedWs} />
      </div>
    </div>
  );
}
