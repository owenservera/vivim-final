'use client'

/**
 * components/canvas/use-resolved-nodes.ts
 * --------------------------------------------------------------------
 * React hook that fetches the resolved surface from `/api/canvas/resolve`
 * and rebuilds the node tree whenever the workspace / providers / accounts
 * change. Powered by TanStack Query for caching + invalidation.
 *
 * The shell is dumb: it just renders what the resolver returns. No
 * provider conditionals (Frontend=Backend, invariant 3).
 */

import { useQuery } from '@tanstack/react-query'
import type { ResolvedSurface, RouteContext } from '../../shared/route-context'
import { useIO } from './UnifiedIOProvider'

export interface ResolveRequest {
  workspaceId: string
  userId: string
  providerIds: string[]
  accounts: RouteContext['accounts']
  slotIds: string[]
  variant?: string
}

// Module-level: the traceId of the LAST resolve response this client received.
// useCanvasEvents reads this to skip SSE `canvas:surface:resolved` events that
// are THIS component's own resolve echoing back — breaking the
// resolve→SSE→invalidate→refetch self-loop while keeping genuine cross-tab
// updates (those carry a different traceId).
let lastResolveTraceId: string | undefined

export function setLastResolveTraceId(traceId?: string) {
  lastResolveTraceId = traceId
}

export function getLastResolveTraceId() {
  return lastResolveTraceId
}

export function useResolvedNodes(req: ResolveRequest) {
  const io = useIO()

  return useQuery<ResolvedSurface>({
    queryKey: [
      'canvas:resolve',
      req.workspaceId,
      req.userId,
      req.providerIds,
      req.accounts,
      req.slotIds,
      req.variant,
    ],
    queryFn: async () => {
      const { data } = await io.post<ResolvedSurface>('/api/canvas/resolve', req)
      setLastResolveTraceId(data.traceId)
      return data
    },
    staleTime: 10_000,
    retry: 1,
    refetchOnWindowFocus: false,
  })
}
