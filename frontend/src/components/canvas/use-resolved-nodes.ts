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
      return data
    },
    staleTime: 10_000,
    retry: 1,
    refetchOnWindowFocus: false,
  })
}
