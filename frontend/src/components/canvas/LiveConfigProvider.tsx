'use client';

/**
 * components/canvas/LiveConfigProvider.tsx (G2 frontend)
 * --------------------------------------------------------------------
 * React provider exposing `patch()` + `useResolvedNodes()` (re-render
 * via useSyncExternalStore on bus version bumps).
 *
 * The provider holds the current RouteContext (workspace + providers +
 * accounts + variant). When the context changes, the backend
 * re-resolves and the frontend re-renders only the diff (bundle 02 §D).
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { ResolvedSurface, RouteContext, AccountContext } from '../../shared/route-context';
import { useResolvedNodes } from './use-resolved-nodes';
import { useCanvasEvents } from './use-canvas-events';
import { getCanvasEventBus } from './use-canvas-events';

export interface LiveConfigContextValue {
  surface: ResolvedSurface | undefined;
  isLoading: boolean;
  error: Error | null;
  workspaceId: string;
  setWorkspace: (id: string) => void;
  providerIds: string[];
  setProviderIds: (ids: string[]) => void;
  accounts: AccountContext[];
  setAccounts: (a: AccountContext[]) => void;
  variant?: string;
  setVariant: (v?: string) => void;
  patchDefinition: (id: string, patch: Record<string, unknown>) => Promise<void>;
}

const Ctx = createContext<LiveConfigContextValue | null>(null);

export interface LiveConfigProviderProps {
  initialWorkspaceId?: string;
  initialUserId?: string;
  initialProviderIds?: string[];
  initialAccounts?: AccountContext[];
  initialSlotIds?: string[];
  initialVariant?: string;
  children: ReactNode;
}

export function LiveConfigProvider(props: LiveConfigProviderProps) {
  const [workspaceId, setWorkspace] = useState(props.initialWorkspaceId ?? 'ws:default');
  const [providerIds, setProviderIds] = useState<string[]>(props.initialProviderIds ?? []);
  const [accounts, setAccounts] = useState(props.initialAccounts ?? []);
  const [variant, setVariant] = useState(props.initialVariant);
  const userId = props.initialUserId ?? 'user:1';

  const slotIds = props.initialSlotIds ?? [
    'chat.header', 'chat.sidebar', 'chat.thread', 'chat.composer', 'chat.send',
    'chat.attach', 'chat.streaming', 'chat.result', 'chat.actionBar',
  ];

  const { data, isLoading, error, refetch } = useResolvedNodes({
    workspaceId,
    userId,
    providerIds,
    accounts,
    slotIds,
    variant,
  });

  useCanvasEvents(workspaceId);

  // Live re-render: when a canvas:def:updated or workspace:reresolved
  // event arrives, refetch the resolve query. The TanStack Query cache
  // invalidates and React re-renders only the changed nodes.
  const bus = getCanvasEventBus();
  useEffect(() => {
    const unsub1 = bus.on('canvas:def:updated', () => refetch());
    const unsub2 = bus.on('workspace:reresolved', () => refetch());
    return () => {
      unsub1();
      unsub2();
    };
  }, [bus, refetch]);

  const patchDefinition = useCallback(
    async (id: string, patch: Record<string, unknown>) => {
      await fetch(`/api/canvas/definition/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      // The backend emits canvas:def:updated; the SSE subscription
      // triggers refetch. We also refetch optimistically here.
      await refetch();
    },
    [refetch],
  );

  const value = useMemo<LiveConfigContextValue>(
    () => ({
      surface: data,
      isLoading,
      error: error as Error | null,
      workspaceId,
      setWorkspace,
      providerIds,
      setProviderIds,
      accounts,
      setAccounts,
      variant,
      setVariant,
      patchDefinition,
    }),
    [data, isLoading, error, workspaceId, providerIds, accounts, variant, patchDefinition],
  );

  return <Ctx.Provider value={value}>{props.children}</Ctx.Provider>;
}

export function useLiveConfig(): LiveConfigContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useLiveConfig must be used inside <LiveConfigProvider>');
  return v;
}
