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

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { ResolvedSurface, RouteContext, AccountContext } from '../../shared/route-context';
import { useResolvedNodes } from './use-resolved-nodes';
import { useCanvasEvents } from './use-canvas-events';
import { useIO } from './UnifiedIOProvider';

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
  slotIds?: string[];
  children: ReactNode;
}

export function LiveConfigProvider(props: LiveConfigProviderProps) {
  const [workspaceId, setWorkspace] = useState(props.initialWorkspaceId ?? 'ws:default');
  const [providerIds, setProviderIds] = useState<string[]>(props.initialProviderIds ?? []);
  const [accounts, setAccounts] = useState(props.initialAccounts ?? []);
  const [variant, setVariant] = useState(props.initialVariant);
  const userId = props.initialUserId ?? 'user:1';
  const io = useIO();

  const slotIds = props.slotIds ?? props.initialSlotIds ?? [
    'chat.header', 'chat.sidebar', 'chat.thread', 'chat.composer', 'chat.send',
    'chat.attach', 'chat.streaming', 'chat.result', 'chat.actionBar',
  ];

  // Memoize the resolve request so inline-created objects with the same
  // values don't trigger needless re-fetches from TanStack Query.
  const resolveReq = useMemo(
    () => ({ workspaceId, userId, providerIds, accounts, slotIds, variant }),
    [workspaceId, userId, providerIds, accounts, slotIds, variant],
  );

  const { data, isLoading, error } = useResolvedNodes(resolveReq);

  useCanvasEvents(workspaceId);

  const patchDefinition = useCallback(
    async (id: string, patch: Record<string, unknown>) => {
      await io.patch(`/api/canvas/definition/${id}`, patch);
      // The backend emits canvas:def:updated; the SSE subscription
      // in useCanvasEvents invalidates the query automatically.
    },
    [io], // io dependency for stable reference
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
