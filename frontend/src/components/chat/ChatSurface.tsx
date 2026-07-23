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
 *
 * v2: Uses ChatSlotSurface for slot-driven composition.
 * Each of the 13 chat.* slots resolves via the SDK registry
 * (capabilitySlug > providerSlug > default).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useWebSocket, type WsMessage } from '@/hooks/useWebSocket';
import { bootMlSlots } from '@/ml/ml-boot';
import { useSlotOverrides } from '@/hooks/useSlotOverrides';
import { ChatSlotSurface } from './ChatSlotSurface';

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

  if (!defaultProviderId) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
        No provider selected. Choose one from the provider list to start.
      </div>
    );
  }

  const providerSlug = defaultProviderId;
  useSlotOverrides(providerSlug);

  // Register slot defaults once.
  useEffect(() => {
    bootMlSlots();
  }, []);

  const handleSelect = useCallback((id: string) => {
    setActiveId(id || null);
  }, []);

  // Subscribe to the active conversation's topic.
  useEffect(() => {
    if (!activeId) return;
    const off = subscribe(`conversation:${activeId}`);
    return off;
  }, [activeId, subscribe]);

  const forwardedWs = useMemo(() => lastWs, [lastWs]);

  // Props to forward to slot components
  const slotProps = useMemo(
    () => ({
      'chat.header': {
        workspaceId: 'default',
        paletteOpen: false,
        setPaletteOpen: () => {},
        themeOpen: false,
        setThemeOpen: () => {},
      },
      'chat.sidebar': {
        workspaceId: 'default',
        setWorkspace: () => {},
        providerIds: [providerSlug],
        toggleProvider: () => {},
        accounts: [],
        cycleTier: () => {},
        variant: undefined,
        setVariant: () => {},
      },
      'chat.thread': {
        activeId,
        onSelect: handleSelect,
        defaultProviderId: providerSlug,
      },
      'chat.composer': {
        conversationId: activeId,
        wsStatus: status,
        wsMessage: forwardedWs,
      },
    }),
    [activeId, status, forwardedWs, providerSlug, handleSelect],
  );

  return (
    <ChatSlotSurface
      providerSlug={providerSlug}
      capabilitySlug={undefined}
      slotProps={slotProps}
    />
  );
}
